<script lang="ts">
  import { onMount } from 'svelte';
  import type { Branch, BuildingElement, Project } from '@tim/shared';
  import { api } from './lib/api.js';
  import { createCollisionDetector } from '@tim/core';
  import Viewer3D from './lib/components/Viewer3D.svelte';
  import ModelTree from './lib/components/ModelTree.svelte';
  import PropertiesPanel from './lib/components/PropertiesPanel.svelte';
  import BranchPanel from './lib/components/BranchPanel.svelte';
  import FamilyLibrary from './lib/components/FamilyLibrary.svelte';
  import NodeEditor from './lib/components/NodeEditor.svelte';

  let projects = $state<Project[]>([]);
  let activeProject = $state<Project | null>(null);
  let branches = $state<Branch[]>([]);
  let elements = $state<BuildingElement[]>([]);
  let activeBranchId = $state('');
  let selectedId = $state<string | null>(null);
  let collisionIds = $state(new Set<string>());
  let activeTab = $state<'branches' | 'families' | 'nodes'>('branches');
  let loading = $state(true);
  let error = $state('');
  let webgpuAvailable = $state(false);

  const selectedElement = $derived(elements.find(e => e.id === selectedId) ?? null);

  async function loadProject(project: Project) {
    activeProject = project;
    branches = await api.getBranches(project.id);
    activeBranchId = project.mainBranchId;
    await loadElements();
  }

  async function loadElements() {
    if (!activeProject) return;
    elements = await api.getElements(activeProject.id, activeBranchId);
    await detectCollisions();
  }

  async function detectCollisions() {
    if (elements.length < 2) {
      collisionIds = new Set();
      return;
    }
    try {
      const detector = await createCollisionDetector();
      const pairs = await detector.checkCollisions(elements);
      detector.dispose();
      const ids = new Set<string>();
      for (const p of pairs) {
        ids.add(p.elementAId);
        ids.add(p.elementBId);
      }
      collisionIds = ids;
    } catch {
      collisionIds = new Set();
    }
  }

  async function init() {
    try {
      projects = await api.getProjects();
      if (projects.length > 0) await loadProject(projects[0]);
      webgpuAvailable = 'gpu' in navigator;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(init);
</script>

<div class="app">
  <header class="toolbar">
    <div class="brand">
      <span class="logo">TIM</span>
      <span class="subtitle">BIM Graph Platform</span>
    </div>

    {#if activeProject}
      <div class="project-info">
        <span class="project-name">{activeProject.name}</span>
        <span class="branch-indicator">
          {branches.find(b => b.id === activeBranchId)?.name ?? 'main'}
        </span>
      </div>
    {/if}

    <div class="toolbar-right">
      {#if webgpuAvailable}
        <span class="gpu-badge" title="WebGPU available for collision detection">WebGPU</span>
      {/if}
      {#if collisionIds.size > 0}
        <span class="badge collision">{collisionIds.size} collisions</span>
      {/if}
    </div>
  </header>

  {#if loading}
    <div class="loading">Loading project...</div>
  {:else if error}
    <div class="error">
      <p>Cannot connect to API: {error}</p>
      <p class="hint">Run <code>npm run docker:up</code> or <code>npm run dev:api</code></p>
    </div>
  {:else}
    <main class="workspace">
      <aside class="sidebar left">
        <ModelTree
          {elements}
          {selectedId}
          {collisionIds}
          onselect={(id) => { selectedId = id; }}
        />
      </aside>

      <section class="viewer-area">
        <Viewer3D
          {elements}
          {collisionIds}
          {selectedId}
          onselect={(id) => { selectedId = id; }}
        />
      </section>

      <aside class="sidebar right">
        <div class="tab-bar">
          <button class:active={activeTab === 'branches'} onclick={() => activeTab = 'branches'}>Branches</button>
          <button class:active={activeTab === 'families'} onclick={() => activeTab = 'families'}>Families</button>
          <button class:active={activeTab === 'nodes'} onclick={() => activeTab = 'nodes'}>Nodes</button>
        </div>

        <div class="tab-content">
          {#if activeTab === 'branches'}
            <BranchPanel
              {branches}
              {activeBranchId}
              projectId={activeProject?.id ?? ''}
              onbranchchange={(id) => { activeBranchId = id; loadElements(); }}
              onrefresh={loadElements}
            />
          {:else if activeTab === 'families'}
            <FamilyLibrary />
          {:else}
            <NodeEditor />
          {/if}
        </div>

        <div class="props-section">
          <PropertiesPanel element={selectedElement} />
        </div>
      </aside>
    </main>
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 0 16px;
    height: 48px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .brand { display: flex; align-items: baseline; gap: 10px; }
  .logo {
    font-size: 18px;
    font-weight: 800;
    color: var(--accent);
    letter-spacing: -0.02em;
  }
  .subtitle { font-size: 12px; color: var(--text-secondary); }

  .project-info { display: flex; align-items: center; gap: 10px; }
  .project-name { font-weight: 600; font-size: 14px; }
  .branch-indicator {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--accent);
    background: rgba(59,130,246,0.1);
    padding: 2px 8px;
    border-radius: 4px;
  }

  .toolbar-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .gpu-badge {
    font-size: 11px;
    background: rgba(34,197,94,0.15);
    color: var(--success);
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

  .workspace {
    display: grid;
    grid-template-columns: 260px 1fr 320px;
    flex: 1;
    overflow: hidden;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid var(--border);
  }
  .sidebar.right {
    border-right: none;
    border-left: 1px solid var(--border);
  }

  .viewer-area { position: relative; overflow: hidden; }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tab-bar button {
    flex: 1;
    padding: 8px;
    background: transparent;
    color: var(--text-secondary);
    border-radius: 0;
    font-size: 12px;
    border-bottom: 2px solid transparent;
  }
  .tab-bar button.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-content { flex: 1; overflow: hidden; min-height: 0; }
  .props-section {
    height: 280px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    overflow: hidden;
  }

  .loading, .error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-secondary);
  }
  .error p { font-size: 14px; }
  .hint { font-size: 12px; }
  .hint code {
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--font-mono);
  }
</style>
