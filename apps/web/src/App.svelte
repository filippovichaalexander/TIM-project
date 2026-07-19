<script lang="ts">
  import { onMount } from 'svelte';
  import type { Branch, BuildingElement, Collision, Project, User } from '@tim/shared';
  import { api } from './lib/api.js';
  import { createCollisionDetector, detectCollisionsCPU } from '@tim/core';
  import Viewer3D from './lib/components/Viewer3D.svelte';
  import ModelTree from './lib/components/ModelTree.svelte';
  import PropertiesPanel from './lib/components/PropertiesPanel.svelte';
  import BranchPanel from './lib/components/BranchPanel.svelte';
  import FamilyLibrary from './lib/components/FamilyLibrary.svelte';
  import NodeEditor from './lib/components/NodeEditor.svelte';

  let projects = $state<Project[]>([]);
  let users = $state<User[]>([]);
  let currentUser = $state<User | null>(null);
  let activeProject = $state<Project | null>(null);
  let branches = $state<Branch[]>([]);
  let elements = $state<BuildingElement[]>([]);
  let mainElements = $state<BuildingElement[]>([]);
  let activeBranchId = $state('');
  let selectedId = $state<string | null>(null);
  let collisionIds = $state(new Set<string>());
  let activeTab = $state<'branches' | 'families' | 'nodes'>('branches');
  let loading = $state(true);
  let error = $state('');
  let webgpuAvailable = $state(false);

  // Ghost overlay of main + region collision inspection
  let showMainGhost = $state(false);
  let regionCollisions = $state<Collision[]>([]);
  let regionConnectionPairs = $state<Array<[string, string]>>([]);
  let regionCollisionIds = $state(new Set<string>());
  let regionSelectedCount = $state(0);
  let checkingRegion = $state(false);
  let regionMode = $state(false);
  let selectedCollision = $state<Collision | null>(null);
  let focusRequest = $state<{ id: string; index: number; n: number } | null>(null);
  let focusNonce = 0;

  /** Always exactly these two roles in the toolbar — never depends on API success */
  const ROLE_OPTIONS: User[] = [
    { id: 'user-1', email: 'user@tim.bim', name: 'User', role: 'architect', createdAt: '' },
    { id: 'user-approver', email: 'approver@tim.bim', name: 'Approval User', role: 'approval_user', createdAt: '' },
  ];

  const selectedElement = $derived(elements.find(e => e.id === selectedId) ?? null);
  const activeBranch = $derived(branches.find(b => b.id === activeBranchId) ?? null);
  const isMainBranch = $derived(activeBranch?.isMain ?? true);
  const viewerCollisionIds = $derived(new Set<string>([...collisionIds, ...regionCollisionIds]));
  const ghostElements = $derived(showMainGhost && !isMainBranch ? mainElements : []);
  const elementName = (id: string) =>
    elements.find(e => e.id === id)?.name ??
    mainElements.find(e => e.id === id)?.name ?? id;

  async function loadProject(project: Project) {
    activeProject = project;
    branches = await api.getBranches(project.id);
    activeBranchId = project.mainBranchId;
    await loadElements();
  }

  async function loadElements() {
    if (!activeProject) return;
    elements = await api.getElements(activeProject.id, activeBranchId);
    clearRegion();
    await loadMainElements();
    await detectCollisions();
  }

  async function loadMainElements() {
    if (!activeProject) return;
    if (activeBranch?.isMain) {
      mainElements = elements;
      return;
    }
    mainElements = await api.getElements(activeProject.id, activeProject.mainBranchId);
  }

  function clearRegion() {
    regionCollisions = [];
    regionConnectionPairs = [];
    regionCollisionIds = new Set();
    regionSelectedCount = 0;
    selectedCollision = null;
  }

  /** Region selection from the 3D viewer: check branch vs main only inside the box. */
  async function handleRegionSelect(ids: string[]) {
    regionMode = false; // disarm after one selection
    regionSelectedCount = ids.length;
    if (ids.length === 0) { clearRegion(); return; }
    checkingRegion = true;
    try {
      const idSet = new Set(ids);
      const selected = elements.filter(e => idSet.has(e.id));
      const others = mainElements.filter(m => !idSet.has(m.id));
      const pool = [...selected, ...others];
      const pairs = detectCollisionsCPU(pool)
        .filter(p => idSet.has(p.elementAId) || idSet.has(p.elementBId));

      regionConnectionPairs = pairs.map(p => [p.elementAId, p.elementBId]);
      regionCollisionIds = new Set(pairs.flatMap(p => [p.elementAId, p.elementBId]));
      regionCollisions = pairs.map((p, i) => ({
        id: `region-${i}`,
        elementAId: p.elementAId,
        elementBId: p.elementBId,
        branchId: activeBranchId,
        severity: 'critical' as const,
        resolved: false,
        detectedAt: new Date().toISOString(),
      }));
    } finally {
      checkingRegion = false;
    }
  }

  function focusCollision(c: Collision, index: number) {
    focusRequest = { id: c.elementAId, index, n: ++focusNonce };
    selectedCollision = c;
    selectedId = null;
  }

  function selectElement(id: string | null) {
    selectedId = id;
    selectedCollision = null;
  }

  const collisionA = $derived(
    selectedCollision
      ? (elements.find(e => e.id === selectedCollision!.elementAId)
          ?? mainElements.find(e => e.id === selectedCollision!.elementAId) ?? null)
      : null
  );
  const collisionB = $derived(
    selectedCollision
      ? (elements.find(e => e.id === selectedCollision!.elementBId)
          ?? mainElements.find(e => e.id === selectedCollision!.elementBId) ?? null)
      : null
  );

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
    currentUser = ROLE_OPTIONS[0];
    try {
      const apiUsers = await api.getUsers();
      users = apiUsers.length > 0 ? apiUsers : ROLE_OPTIONS;
      // Prefer our two switchable roles from API if present
      const fromApi = ROLE_OPTIONS.map(opt =>
        apiUsers.find(u => u.role === opt.role) ?? opt
      );
      currentUser = fromApi[0];
      // Keep ROLE_OPTIONS ids for switch; map to API users by role when available
      projects = await api.getProjects();
      if (projects.length > 0) await loadProject(projects[0]);
      webgpuAvailable = 'gpu' in navigator;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  function switchRole(role: 'architect' | 'approval_user') {
    const fromApi = users.find(u => u.role === role);
    currentUser = fromApi ?? ROLE_OPTIONS.find(u => u.role === role) ?? null;
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
      <div class="role-switch" title="Switch between User and Approval User">
        <span class="role-label">Role</span>
        <div class="role-toggle" role="group" aria-label="Switch role">
          <button
            type="button"
            class="role-btn"
            class:active={currentUser?.role === 'architect'}
            onclick={() => switchRole('architect')}
          >
            User
          </button>
          <button
            type="button"
            class="role-btn"
            class:active={currentUser?.role === 'approval_user'}
            onclick={() => switchRole('approval_user')}
          >
            Approval User
          </button>
        </div>
      </div>
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
          onselect={(id) => selectElement(id)}
        />
      </aside>

      <section class="viewer-area">
        <div class="viewer-overlay">
          {#if !isMainBranch}
            <label class="ghost-toggle" title="Полупрозрачные объёмы main для ориентации в пространстве">
              <input type="checkbox" bind:checked={showMainGhost} />
              <span>Показывать main (голубой призрак)</span>
            </label>
          {/if}
          <button
            class="region-btn"
            class:active={regionMode}
            onclick={() => regionMode = !regionMode}
            title="Нарисуйте рамку мышью, чтобы проверить коллизии с main"
          >
            ◫ {regionMode ? 'Рисуйте рамку…' : 'Выделить область коллизий'}
          </button>
          <span class="hint-pill">или Ctrl + рамка мышью</span>
        </div>

        <Viewer3D
          {elements}
          collisionIds={viewerCollisionIds}
          {selectedId}
          {ghostElements}
          connectionPairs={regionConnectionPairs}
          {focusRequest}
          regionArmed={regionMode}
          onselect={(id) => selectElement(id)}
          onregionselect={handleRegionSelect}
        />

        {#if regionSelectedCount > 0}
          <div class="collision-inspector panel">
            <div class="panel-header">
              Коллизии в области
              <button class="ghost close-btn" onclick={clearRegion}>✕</button>
            </div>
            <div class="ci-content">
              <p class="ci-summary">
                Выбрано объектов: {regionSelectedCount}
                {#if checkingRegion}· проверка…{/if}
              </p>
              {#if regionCollisions.length === 0 && !checkingRegion}
                <p class="ci-ok">Коллизий с main не найдено</p>
              {:else}
                <ul class="ci-list">
                  {#each regionCollisions as c, i (c.id)}
                    <button
                      class="ci-row"
                      class:active={focusRequest?.id === c.elementAId && focusRequest?.index === i}
                      onclick={() => focusCollision(c, i)}
                    >
                      <span class="ci-dot"></span>
                      <span class="ci-pair">{elementName(c.elementAId)} ↔ {elementName(c.elementBId)}</span>
                    </button>
                  {/each}
                </ul>
              {/if}
            </div>
          </div>
        {/if}
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
              {currentUser}
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
          <PropertiesPanel
            element={selectedElement}
            collision={selectedCollision}
            {collisionA}
            {collisionB}
          />
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

  .toolbar-right { margin-left: auto; display: flex; gap: 12px; align-items: center; }
  .role-switch {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .role-label {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .role-toggle {
    display: flex;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 2px;
    gap: 2px;
  }
  .role-btn {
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
  }
  .role-btn:hover {
    color: var(--text-primary);
  }
  .role-btn.active {
    background: var(--accent);
    color: white;
  }
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

  .viewer-overlay {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
  .ghost-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0,0,0,0.6);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-primary);
    cursor: pointer;
    border: 1px solid var(--border);
  }
  .ghost-toggle input { accent-color: var(--accent); }
  .region-btn {
    background: rgba(0,0,0,0.6);
    border: 1px solid var(--border);
    color: var(--text-primary);
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 6px;
  }
  .region-btn:hover { background: var(--bg-tertiary); }
  .region-btn.active {
    background: var(--warning);
    color: #000;
    border-color: var(--warning);
  }
  .hint-pill {
    background: rgba(0,0,0,0.55);
    color: var(--text-secondary);
    font-size: 11px;
    padding: 4px 9px;
    border-radius: 6px;
  }

  .collision-inspector {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 260px;
    max-height: 60%;
    z-index: 6;
    display: flex;
    flex-direction: column;
    box-shadow: 0 6px 24px rgba(0,0,0,0.4);
  }
  .close-btn { padding: 0 6px; font-size: 12px; }
  .ci-content { padding: 10px; overflow-y: auto; }
  .ci-summary { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
  .ci-ok { font-size: 12px; color: var(--success); }
  .ci-list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
  .ci-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border-radius: 6px;
    text-align: left;
    font-size: 12px;
    font-family: var(--font-mono);
  }
  .ci-row:hover { background: rgba(239,68,68,0.15); }
  .ci-row.active { background: rgba(239,68,68,0.25); outline: 1px solid var(--danger); }
  .ci-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--danger); flex-shrink: 0;
  }
  .ci-pair { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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
