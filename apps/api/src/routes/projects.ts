import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { store } from '../db.js';

export const projectsRouter = Router();

projectsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json({ data: store.projects });
}));

projectsRouter.get('/:id', asyncHandler(async (req, res) => {
  const project = store.projects.find(p => p.id === req.params.id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json({ data: project });
}));

projectsRouter.get('/:id/elements', asyncHandler(async (req, res) => {
  const branchId = req.query.branchId as string | undefined;
  const project = store.projects.find(p => p.id === req.params.id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const targetBranch = branchId ?? project.mainBranchId;
  const els = store.elements.filter(e => e.branchId === targetBranch);
  res.json({ data: els });
}));
