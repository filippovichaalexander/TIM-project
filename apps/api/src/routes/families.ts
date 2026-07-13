import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { asyncHandler } from '../middleware/error.js';
import { store } from '../db.js';
import type { Family } from '@tim/shared';

export const familiesRouter = Router();

familiesRouter.get('/', asyncHandler(async (_req, res) => {
  res.json({ data: store.families });
}));

familiesRouter.post('/upload', asyncHandler(async (req, res) => {
  const { name, category, parameters } = req.body;
  const family: Family = {
    id: uuid(),
    name,
    category,
    parameters: parameters ?? [],
    source: 'upload',
    createdAt: new Date().toISOString(),
  };
  store.families.push(family);
  res.status(201).json({ data: family });
}));

familiesRouter.get('/library', asyncHandler(async (_req, res) => {
  const library = store.families.filter(f => f.source === 'builtin' || f.source === 'library');
  res.json({ data: library });
}));
