import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import {
  detectCollisionsCPU,
  detectCrossBranchCollisions,
  previewMerge,
  resolveCollisionByMove,
} from '@tim/core';
import { asyncHandler, AppError } from '../middleware/error.js';
import { store } from '../db.js';
import type { User } from '@tim/shared';

export const mergeRouter = Router();

function findUser(userId: string | undefined): User {
  const user = store.users.find(u => u.id === userId);
  if (!user) throw new AppError(401, 'User not found');
  return user;
}

function requireApprovalUser(userId: string | undefined): User {
  const user = findUser(userId);
  if (user.role !== 'approval_user') {
    throw new AppError(403, 'Only ApprovalUser may merge to main or fix collisions');
  }
  return user;
}

function recomputeMrCollisions(mr: (typeof store.mergeRequests)[number]): void {
  const sourceEls = store.elements.filter(e => e.branchId === mr.sourceBranchId);
  const targetEls = store.elements.filter(e => e.branchId === mr.targetBranchId);
  const cross = detectCrossBranchCollisions(sourceEls, targetEls);
  const withinTarget = detectCollisionsCPU(targetEls);
  const allPairs = [...cross, ...withinTarget];
  // de-dupe by element pair key
  const seen = new Set<string>();
  mr.collisions = allPairs
    .filter(p => {
      const key = [p.elementAId, p.elementBId].sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((pair, i) => ({
      id: `col-${mr.id}-${i}`,
      elementAId: pair.elementAId,
      elementBId: pair.elementBId,
      branchId: mr.sourceBranchId,
      severity: 'critical' as const,
      resolved: false,
      detectedAt: new Date().toISOString(),
    }));
  mr.updatedAt = new Date().toISOString();
}

mergeRouter.get('/project/:projectId', asyncHandler(async (req, res) => {
  const mrs = store.mergeRequests.filter(m => m.projectId === req.params.projectId);
  res.json({ data: mrs });
}));

mergeRouter.post('/preview', asyncHandler(async (req, res) => {
  const { sourceBranchId, targetBranchId } = req.body;
  const sourceBranch = store.branches.find(b => b.id === sourceBranchId);
  const targetBranch = store.branches.find(b => b.id === targetBranchId);
  if (!sourceBranch || !targetBranch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }

  const sourceEls = store.elements.filter(e => e.branchId === sourceBranchId);
  const targetEls = store.elements.filter(e => e.branchId === targetBranchId);
  const cross = detectCrossBranchCollisions(sourceEls, targetEls);
  const withinTarget = detectCollisionsCPU(targetEls);
  const pairs = [...cross, ...withinTarget];
  const preview = previewMerge(sourceEls, targetEls, sourceBranch, targetBranch, pairs);
  res.json({
    data: {
      ...preview,
      crossBranchCount: cross.length,
      withinMainCount: withinTarget.length,
    },
  });
}));

mergeRouter.post('/', asyncHandler(async (req, res) => {
  const { projectId, sourceBranchId, targetBranchId, authorId, message } = req.body;
  const sourceBranch = store.branches.find(b => b.id === sourceBranchId);
  const targetBranch = store.branches.find(b => b.id === targetBranchId);
  if (!sourceBranch || !targetBranch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }
  if (!targetBranch.isMain) {
    res.status(400).json({ error: 'Merge requests target main only' });
    return;
  }

  const sourceEls = store.elements.filter(e => e.branchId === sourceBranchId);
  const targetEls = store.elements.filter(e => e.branchId === targetBranchId);
  const cross = detectCrossBranchCollisions(sourceEls, targetEls);
  const withinTarget = detectCollisionsCPU(targetEls);
  const preview = previewMerge(
    sourceEls,
    targetEls,
    sourceBranch,
    targetBranch,
    [...cross, ...withinTarget]
  );

  // Architects may open an MR even with collisions; ApprovalUser must fix before merge
  const mr = {
    id: uuid(),
    projectId,
    sourceBranchId,
    targetBranchId,
    authorId,
    status: 'open' as const,
    collisions: preview.collisions,
    message: message ?? 'Merge request',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.mergeRequests.push(mr);
  res.status(201).json({ data: mr });
}));

mergeRouter.post('/:id/approve', asyncHandler(async (req, res) => {
  const mr = store.mergeRequests.find(m => m.id === req.params.id);
  if (!mr) { res.status(404).json({ error: 'Merge request not found' }); return; }

  const approver = requireApprovalUser(req.body.reviewerId);
  recomputeMrCollisions(mr);

  const unresolved = mr.collisions.filter(c => !c.resolved);
  if (unresolved.length > 0) {
    res.status(409).json({
      error: 'Cannot approve: unresolved collisions — ApprovalUser must fix them first',
      collisions: unresolved,
    });
    return;
  }

  const sourceEls = store.elements.filter(e => e.branchId === mr.sourceBranchId);
  for (const el of sourceEls) {
    el.branchId = mr.targetBranchId;
    el.updatedAt = new Date().toISOString();
  }

  mr.status = 'merged';
  mr.reviewerId = approver.id;
  mr.updatedAt = new Date().toISOString();
  res.json({ data: mr });
}));

mergeRouter.post('/:id/reject', asyncHandler(async (req, res) => {
  const mr = store.mergeRequests.find(m => m.id === req.params.id);
  if (!mr) { res.status(404).json({ error: 'Merge request not found' }); return; }

  const approver = requireApprovalUser(req.body.reviewerId);
  mr.status = 'rejected';
  mr.reviewerId = approver.id;
  mr.updatedAt = new Date().toISOString();
  res.json({ data: mr });
}));

/** ApprovalUser moves/resolves a colliding source element off main geometry */
mergeRouter.post('/:id/fix-collision', asyncHandler(async (req, res) => {
  const mr = store.mergeRequests.find(m => m.id === req.params.id);
  if (!mr) { res.status(404).json({ error: 'Merge request not found' }); return; }
  if (mr.status !== 'open') {
    res.status(400).json({ error: 'Can only fix collisions on open merge requests' });
    return;
  }

  requireApprovalUser(req.body.userId);

  const { collisionId } = req.body as { collisionId: string };
  const collision = mr.collisions.find(c => c.id === collisionId);
  if (!collision) {
    res.status(404).json({ error: 'Collision not found' });
    return;
  }

  const sourceIds = new Set(
    store.elements.filter(e => e.branchId === mr.sourceBranchId).map(e => e.id)
  );
  const targetEls = store.elements.filter(e => e.branchId === mr.targetBranchId);

  // Prefer nudging the source-branch element; for main↔main pairs nudge the second element
  let moveId = sourceIds.has(collision.elementAId)
    ? collision.elementAId
    : sourceIds.has(collision.elementBId)
      ? collision.elementBId
      : collision.elementBId;

  const idx = store.elements.findIndex(e => e.id === moveId);
  if (idx < 0) {
    res.status(404).json({ error: 'Element not found' });
    return;
  }

  const others = [
    ...targetEls.filter(e => e.id !== moveId),
    ...store.elements.filter(e => e.branchId === mr.sourceBranchId && e.id !== moveId),
  ];

  store.elements[idx] = resolveCollisionByMove(store.elements[idx], others);
  collision.resolved = true;
  recomputeMrCollisions(mr);

  res.json({
    data: {
      mergeRequest: mr,
      movedElement: store.elements[idx],
    },
  });
}));
