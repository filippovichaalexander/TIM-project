-- TIM BIM Platform — initial schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'architect',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  owner_id        TEXT NOT NULL REFERENCES users(id),
  main_branch_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  parent_branch_id  TEXT,
  head_commit_id    TEXT,
  author_id         TEXT NOT NULL REFERENCES users(id),
  is_main           BOOLEAN NOT NULL DEFAULT FALSE,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS commits (
  id                TEXT PRIMARY KEY,
  branch_id         TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  parent_commit_id  TEXT,
  message           TEXT NOT NULL,
  author_id         TEXT NOT NULL REFERENCES users(id),
  element_ids       JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS elements (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  parameters  JSONB NOT NULL DEFAULT '{}',
  bbox        JSONB NOT NULL,
  branch_id   TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  family_id   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collisions (
  id            TEXT PRIMARY KEY,
  element_a_id  TEXT NOT NULL REFERENCES elements(id),
  element_b_id  TEXT NOT NULL REFERENCES elements(id),
  branch_id     TEXT NOT NULL REFERENCES branches(id),
  severity      TEXT NOT NULL DEFAULT 'warning',
  resolved      BOOLEAN NOT NULL DEFAULT FALSE,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merge_requests (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id),
  source_branch_id  TEXT NOT NULL REFERENCES branches(id),
  target_branch_id  TEXT NOT NULL REFERENCES branches(id),
  author_id         TEXT NOT NULL REFERENCES users(id),
  reviewer_id       TEXT REFERENCES users(id),
  status            TEXT NOT NULL DEFAULT 'open',
  collisions        JSONB NOT NULL DEFAULT '[]',
  message           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS families (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  parameters    JSONB NOT NULL DEFAULT '[]',
  thumbnail_url TEXT,
  source        TEXT NOT NULL DEFAULT 'builtin',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed demo data
INSERT INTO users (id, email, name, role) VALUES
  ('user-lead', 'lead@tim.bim', 'Lead Architect', 'lead_architect'),
  ('user-arch-1', 'arch1@tim.bim', 'Anna Petrova', 'architect')
ON CONFLICT DO NOTHING;

INSERT INTO projects (id, name, description, owner_id, main_branch_id) VALUES
  ('proj-demo', 'Office Building Alpha', 'Demo BIM project with branch workflow', 'user-lead', 'branch-main')
ON CONFLICT DO NOTHING;

INSERT INTO branches (id, project_id, name, author_id, is_main, status) VALUES
  ('branch-main', 'proj-demo', 'main', 'user-lead', TRUE, 'active'),
  ('branch-anna', 'proj-demo', 'anna/west-wing', 'user-arch-1', FALSE, 'active')
ON CONFLICT DO NOTHING;

UPDATE branches SET parent_branch_id = 'branch-main' WHERE id = 'branch-anna';

INSERT INTO elements (id, name, category, parameters, bbox, branch_id, family_id) VALUES
  ('el-wall-1', 'Exterior Wall N', 'wall',
   '{"width":{"name":"width","value":12,"unit":"m"},"height":{"name":"height","value":3.2,"unit":"m"},"depth":{"name":"depth","value":0.3,"unit":"m"}}',
   '{"min":{"x":-6,"y":-0.15,"z":0},"max":{"x":6,"y":0.15,"z":3.2}}',
   'branch-main', 'fam-wall-basic'),
  ('el-col-1', 'Column C1', 'column',
   '{"width":{"name":"width","value":0.4,"unit":"m"},"height":{"name":"height","value":3.5,"unit":"m"}}',
   '{"min":{"x":-0.2,"y":-0.2,"z":0},"max":{"x":0.2,"y":0.2,"z":3.5}}',
   'branch-main', 'fam-column-round'),
  ('el-wall-anna', 'West Wing Partition', 'wall',
   '{"width":{"name":"width","value":8,"unit":"m"},"height":{"name":"height","value":3,"unit":"m"},"depth":{"name":"depth","value":0.2,"unit":"m"}}',
   '{"min":{"x":-0.1,"y":-0.1,"z":0},"max":{"x":0.1,"y":0.1,"z":3}}',
   'branch-anna', 'fam-wall-basic')
ON CONFLICT DO NOTHING;

INSERT INTO families (id, name, category, parameters, source) VALUES
  ('fam-wall-basic', 'Basic Wall', 'wall',
   '[{"name":"width","value":5,"unit":"m"},{"name":"height","value":3,"unit":"m"},{"name":"depth","value":0.3,"unit":"m"}]', 'builtin'),
  ('fam-column-round', 'Round Column', 'column',
   '[{"name":"width","value":0.4,"unit":"m"},{"name":"height","value":3.5,"unit":"m"}]', 'builtin'),
  ('fam-window-standard', 'Standard Window', 'window',
   '[{"name":"width","value":1.2,"unit":"m"},{"name":"height","value":1.8,"unit":"m"}]', 'builtin')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_elements_branch ON elements(branch_id);
CREATE INDEX IF NOT EXISTS idx_branches_project ON branches(project_id);
CREATE INDEX IF NOT EXISTS idx_commits_branch ON commits(branch_id);
