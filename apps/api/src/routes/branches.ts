import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { asyncHandler } from '../middleware/error.js';
import { store } from '../db.js';

export const branchesRouter = Router();

branchesRouter.get('/project/:projectId', asyncHandler(async (req, res) => {
  const branches = store.branches.filter(b => b.projectId === req.params.projectId);
  res.json({ data: branches });
}));

branchesRouter.post('/', asyncHandler(async (req, res) => {
  const { projectId, name, authorId, parentBranchId } = req.body;
  const branch = {
    id: uuid(),
    projectId,
    name,
    parentBranchId,
    authorId,
    isMain: false,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.branches.push(branch);
  res.status(201).json({ data: branch });
}));

branchesRouter.post('/:id/commit', asyncHandler(async (req, res) => {
  const branch = store.branches.find(b => b.id === req.params.id);
  if (!branch) { res.status(404).json({ error: 'Branch not found' }); return; }

  const commit = {
    id: uuid(),
    branchId: branch.id,
    parentCommitId: branch.headCommitId,
    message: req.body.message ?? 'Update',
    authorId: req.body.authorId,
    elementIds: store.elements.filter(e => e.branchId === branch.id).map(e => e.id),
    createdAt: new Date().toISOString(),
  };
  store.commits.push(commit);
  branch.headCommitId = commit.id;
  branch.updatedAt = new Date().toISOString();
  res.status(201).json({ data: commit });
}));

branchesRouter.get('/:id/commits', asyncHandler(async (req, res) => {
  const commits = store.commits.filter(c => c.branchId === req.params.id);
  res.json({ data: commits });
}));
