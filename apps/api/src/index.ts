import express from 'express';
import cors from 'cors';
import { initDb, store } from './db.js';
import { errorHandler } from './middleware/error.js';
import { projectsRouter } from './routes/projects.js';
import { branchesRouter } from './routes/branches.js';
import { mergeRouter } from './routes/merge.js';
import { familiesRouter } from './routes/families.js';
import { usersRouter } from './routes/users.js';

const app = express();
const PORT = Number(process.env.API_PORT ?? 3001);
const HOST = process.env.API_HOST ?? '0.0.0.0';

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tim-api', version: '0.1.0' });
});

app.use('/api/projects', projectsRouter);
app.use('/api/branches', branchesRouter);
app.use('/api/merge', mergeRouter);
app.use('/api/families', familiesRouter);
app.use('/api/users', usersRouter);

app.use(errorHandler);

async function start() {
  try {
    await initDb();
    await store.syncFromDb();
    console.log('Database connected');
  } catch (err) {
    console.warn('Database not available, using in-memory seed data:', (err as Error).message);
  }

  app.listen(PORT, HOST, () => {
    console.log(`TIM API running at http://${HOST}:${PORT}`);
  });
}

start();
