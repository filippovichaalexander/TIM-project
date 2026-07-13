import pg from 'pg';
import type {
  Branch, BuildingElement, Commit, Family, MergeRequest, Project, User,
} from '@tim/shared';
import { BUILTIN_FAMILIES } from '@tim/core';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://tim:tim_secret@localhost:5432/tim_bim',
});

export { pool };

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
  await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

// ── In-memory seed data (persisted to PG when tables exist) ──

const users: User[] = [
  { id: 'user-lead', email: 'lead@tim.bim', name: 'Lead Architect', role: 'lead_architect', createdAt: new Date().toISOString() },
  { id: 'user-arch-1', email: 'arch1@tim.bim', name: 'Anna Petrova', role: 'architect', createdAt: new Date().toISOString() },
];

const projects: Project[] = [
  {
    id: 'proj-demo',
    name: 'Office Building Alpha',
    description: 'Demo BIM project with branch workflow',
    ownerId: 'user-lead',
    mainBranchId: 'branch-main',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const branches: Branch[] = [
  {
    id: 'branch-main',
    projectId: 'proj-demo',
    name: 'main',
    authorId: 'user-lead',
    isMain: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'branch-anna',
    projectId: 'proj-demo',
    name: 'anna/west-wing',
    parentBranchId: 'branch-main',
    authorId: 'user-arch-1',
    isMain: false,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const elements: BuildingElement[] = [
  {
    id: 'el-wall-1',
    name: 'Exterior Wall N',
    category: 'wall',
    parameters: { width: { name: 'width', value: 12, unit: 'm' }, height: { name: 'height', value: 3.2, unit: 'm' }, depth: { name: 'depth', value: 0.3, unit: 'm' } },
    bbox: { min: { x: -6, y: -0.15, z: 0 }, max: { x: 6, y: 0.15, z: 3.2 } },
    branchId: 'branch-main',
    familyId: 'fam-wall-basic',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'el-col-1',
    name: 'Column C1',
    category: 'column',
    parameters: { width: { name: 'width', value: 0.4, unit: 'm' }, height: { name: 'height', value: 3.5, unit: 'm' } },
    bbox: { min: { x: -0.2, y: -0.2, z: 0 }, max: { x: 0.2, y: 0.2, z: 3.5 } },
    branchId: 'branch-main',
    familyId: 'fam-column-round',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'el-wall-anna',
    name: 'West Wing Partition',
    category: 'wall',
    parameters: { width: { name: 'width', value: 8, unit: 'm' }, height: { name: 'height', value: 3, unit: 'm' }, depth: { name: 'depth', value: 0.2, unit: 'm' } },
    bbox: { min: { x: -0.1, y: -0.1, z: 0 }, max: { x: 0.1, y: 0.1, z: 3 } },
    branchId: 'branch-anna',
    familyId: 'fam-wall-basic',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const commits: Commit[] = [];
const mergeRequests: MergeRequest[] = [];
const families: Family[] = [...BUILTIN_FAMILIES];

export const store = {
  users, projects, branches, elements, commits, mergeRequests, families,

  async syncFromDb(): Promise<void> {
    try {
      const { rows: projRows } = await pool.query('SELECT * FROM projects LIMIT 100');
      if (projRows.length > 0) {
        projects.length = 0;
        projects.push(...projRows.map(rowToProject));
      }
      const { rows: branchRows } = await pool.query('SELECT * FROM branches LIMIT 100');
      if (branchRows.length > 0) {
        branches.length = 0;
        branches.push(...branchRows.map(rowToBranch));
      }
      const { rows: elRows } = await pool.query('SELECT * FROM elements LIMIT 1000');
      if (elRows.length > 0) {
        elements.length = 0;
        elements.push(...elRows.map(rowToElement));
      }
    } catch {
      // tables may not exist yet in dev without docker
    }
  },
};

function rowToProject(r: Record<string, unknown>): Project {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string | undefined,
    ownerId: r.owner_id as string,
    mainBranchId: r.main_branch_id as string,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

function rowToBranch(r: Record<string, unknown>): Branch {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    name: r.name as string,
    parentBranchId: r.parent_branch_id as string | undefined,
    headCommitId: r.head_commit_id as string | undefined,
    authorId: r.author_id as string,
    isMain: r.is_main as boolean,
    status: r.status as Branch['status'],
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

function rowToElement(r: Record<string, unknown>): BuildingElement {
  return {
    id: r.id as string,
    name: r.name as string,
    category: r.category as BuildingElement['category'],
    parameters: r.parameters as BuildingElement['parameters'],
    bbox: r.bbox as BuildingElement['bbox'],
    branchId: r.branch_id as string,
    familyId: r.family_id as string | undefined,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}
