import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { detectCollisionsCPU, previewMerge } from '@tim/core';
import { asyncHandler } from '../middleware/error.js';
import { store } from '../db.js';

export const mergeRouter = Router();

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
  const allEls = [...targetEls, ...sourceEls];
  const pairs = detectCollisionsCPU(allEls);
  const preview = previewMerge(sourceEls, targetEls, sourceBranch, targetBranch, pairs);
  res.json({ data: preview });
}));

mergeRouter.post('/', asyncHandler(async (req, res) => {
  const { projectId, sourceBranchId, targetBranchId, authorId, message } = req.body;
  const sourceBranch = store.branches.find(b => b.id === sourceBranchId);
  const targetBranch = store.branches.find(b => b.id === targetBranchId);
  if (!sourceBranch || !targetBranch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }

  const sourceEls = store.elements.filter(e => e.branchId === sourceBranchId);
  const targetEls = store.elements.filter(e => e.branchId === targetBranchId);
  const pairs = detectCollisionsCPU([...targetEls, ...sourceEls]);
  const preview = previewMerge(sourceEls, targetEls, sourceBranch, targetBranch, pairs);

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

  if (mr.collisions.length > 0) {
    res.status(409).json({ error: 'Cannot approve: unresolved collisions', collisions: mr.collisions });
    return;
  }

  const sourceEls = store.elements.filter(e => e.branchId === mr.sourceBranchId);
  for (const el of sourceEls) {
    el.branchId = mr.targetBranchId;
    el.updatedAt = new Date().toISOString();
  }

  mr.status = 'merged';
  mr.reviewerId = req.body.reviewerId;
  mr.updatedAt = new Date().toISOString();
  res.json({ data: mr });
}));

mergeRouter.post('/:id/reject', asyncHandler(async (req, res) => {
  const mr = store.mergeRequests.find(m => m.id === req.params.id);
  if (!mr) { res.status(404).json({ error: 'Merge request not found' }); return; }
  mr.status = 'rejected';
  mr.reviewerId = req.body.reviewerId;
  mr.updatedAt = new Date().toISOString();
  res.json({ data: mr });
}));
