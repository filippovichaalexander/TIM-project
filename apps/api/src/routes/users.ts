import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { store } from '../db.js';

export const usersRouter = Router();

usersRouter.get('/', asyncHandler(async (_req, res) => {
  // Expose only the two app roles for the UI switcher
  const roles = store.users.filter(u => u.role === 'architect' || u.role === 'approval_user');
  // Ensure both exist even if Postgres still has legacy seed rows
  const architect = roles.find(u => u.role === 'architect') ?? {
    id: 'user-1',
    email: 'user@tim.bim',
    name: 'User',
    role: 'architect' as const,
    createdAt: new Date().toISOString(),
  };
  const approver = roles.find(u => u.role === 'approval_user') ?? {
    id: 'user-approver',
    email: 'approver@tim.bim',
    name: 'Approval User',
    role: 'approval_user' as const,
    createdAt: new Date().toISOString(),
  };
  res.json({ data: [
    { ...architect, name: 'User' },
    { ...approver, name: 'Approval User' },
  ] });
}));

usersRouter.get('/:id', asyncHandler(async (req, res) => {
  const user = store.users.find(u => u.id === req.params.id);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ data: user });
}));
