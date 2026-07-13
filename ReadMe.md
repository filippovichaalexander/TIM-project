# TIM BIM Platform

Cross-browser BIM graph platform for building architects — collaborate online, manage per-user branches, detect construction collisions, and merge changes with lead-architect approval.

## Architecture

```
Browser (Svelte 5 + Three.js/WebGL)
    ↓
@tim/core (WebGPU collisions, parametric families, SNiP validation)
    ↓
@tim/api (Express + PostgreSQL)
```

**Performance target:** `TR = T1 (load) + T2 (process)` — WebGPU compute shaders for collision detection (10–50× faster than CPU), WASM-ready geometry core, instanced WebGL rendering.

## Quick Start (Docker)

```bash
cp .env.example .env
npm install
npm run docker:up
```

| Service  | URL                    |
|----------|------------------------|
| Web UI   | http://localhost:5173  |
| API      | http://localhost:3001  |
| Postgres | localhost:5432         |

## Local Development

```bash
npm install

# Terminal 1 — API (works without DB, uses in-memory seed)
npm run dev:api

# Terminal 2 — Web
npm run dev:web
```

## Branch Workflow (Git for BIM)

1. Each architect works on their own **local branch** (e.g. `anna/west-wing`)
2. Architect **commits** changes and **pushes** a merge request to `main`
3. System runs **collision preview** against main branch elements
4. **Lead architect approves** merge (blocked if collisions exist)
5. Elements move to `main` branch

## Project Structure

```
apps/
  api/          Express REST API
  web/          Svelte 5 frontend
packages/
  core/         Collision (CPU/WebGPU), families, merge, SNiP
  shared/       TypeScript domain types
docker/
  postgres/     DB schema + seed data
  api/          API container
  web/          Web container
```

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| UI           | Svelte 5 (no virtual DOM)           |
| 3D Rendering | Three.js / WebGL                    |
| Collisions   | WebGPU Compute + CPU fallback       |
| Node Editor  | LiteGraph.js (Dynamo-like)          |
| API          | Node.js 22 + Express 5              |
| Database     | PostgreSQL 17                       |
| Containers   | Docker Compose                      |

## API Endpoints

- `GET  /api/projects` — list projects
- `GET  /api/branches/project/:id` — list branches
- `POST /api/branches/:id/commit` — commit branch snapshot
- `POST /api/merge/preview` — collision preview before merge
- `POST /api/merge/:id/approve` — lead architect approves merge
- `GET  /api/families/library` — built-in + open family library

## License

MIT
