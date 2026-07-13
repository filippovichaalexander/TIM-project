<script lang="ts">
  import type { Branch, MergePreview, MergeRequest } from '@tim/shared';
  import { api } from '../api.js';

  interface Props {
    branches?: Branch[];
    activeBranchId?: string;
    projectId?: string;
    onbranchchange?: (branchId: string) => void;
    onrefresh?: () => void;
  }

  let {
    branches = [],
    activeBranchId = '',
    projectId = '',
    onbranchchange,
    onrefresh,
  }: Props = $props();

  let mergeRequests = $state<MergeRequest[]>([]);
  let preview = $state<MergePreview | null>(null);
  let loading = $state(false);
  let message = $state('');

  const activeBranch = $derived(branches.find(b => b.id === activeBranchId));
  const mainBranch = $derived(branches.find(b => b.isMain));

  async function loadMergeRequests() {
    if (!projectId) return;
    mergeRequests = await api.getMergeRequests(projectId);
  }

  async function handlePreview() {
    if (!activeBranch || !mainBranch || activeBranch.isMain) return;
    loading = true;
    try {
      preview = await api.previewMerge(activeBranch.id, mainBranch.id);
    } finally {
      loading = false;
    }
  }

  async function handlePush() {
    if (!activeBranch || !mainBranch || activeBranch.isMain) return;
    loading = true;
    try {
      await api.createMergeRequest({
        projectId,
        sourceBranchId: activeBranch.id,
        targetBranchId: mainBranch.id,
        authorId: activeBranch.authorId,
        message: message || `Push ${activeBranch.name} → main`,
      });
      message = '';
      await loadMergeRequests();
      onrefresh?.();
    } finally {
      loading = false;
    }
  }

  async function handleApprove(mrId: string) {
    await api.approveMerge(mrId, 'user-lead');
    await loadMergeRequests();
    onrefresh?.();
  }

  async function handleReject(mrId: string) {
    await api.rejectMerge(mrId, 'user-lead');
    await loadMergeRequests();
  }

  $effect(() => {
    if (projectId) loadMergeRequests();
  });
</script>

<div class="panel branch-panel">
  <div class="panel-header">Branches</div>
  <div class="content">
    <div class="branch-list">
      {#each branches as branch (branch.id)}
        <button
          class="branch-item"
          class:active={branch.id === activeBranchId}
          onclick={() => onbranchchange?.(branch.id)}
        >
          <span class="branch-name">{branch.name}</span>
          {#if branch.isMain}<span class="badge main">main</span>{/if}
        </button>
      {/each}
    </div>

    {#if activeBranch && !activeBranch.isMain}
      <div class="actions">
        <input bind:value={message} placeholder="Commit message..." />
        <button class="ghost" onclick={handlePreview} disabled={loading}>
          Preview Collisions
        </button>
        <button class="primary" onclick={handlePush} disabled={loading}>
          Push to Main
        </button>
      </div>

      {#if preview}
        <div class="preview" class:has-collisions={preview.collisions.length > 0}>
          <h4>Merge Preview</h4>
          <p>{preview.newElements.length} new, {preview.modifiedElements.length} modified</p>
          {#if preview.collisions.length > 0}
            <p class="collision-warn">
              <span class="badge collision">{preview.collisions.length}</span>
              collision(s) detected — resolve before merge
            </p>
            <ul>
              {#each preview.collisions as col}
                <li>{col.elementAId} ↔ {col.elementBId}</li>
              {/each}
            </ul>
          {:else}
            <p class="ok">No collisions — ready for approval</p>
          {/if}
        </div>
      {/if}
    {/if}

    {#if mergeRequests.length > 0}
      <h4>Merge Requests</h4>
      {#each mergeRequests as mr (mr.id)}
        <div class="mr-card">
          <div class="mr-header">
            <span class="badge {mr.status}">{mr.status}</span>
            <span class="mr-msg">{mr.message}</span>
          </div>
          {#if mr.collisions.length > 0}
            <span class="badge collision">{mr.collisions.length} collisions</span>
          {/if}
          {#if mr.status === 'open'}
            <div class="mr-actions">
              <button class="primary" onclick={() => handleApprove(mr.id)} disabled={mr.collisions.length > 0}>
                Approve
              </button>
              <button class="ghost" onclick={() => handleReject(mr.id)}>Reject</button>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .branch-panel { height: 100%; display: flex; flex-direction: column; }
  .content { padding: 10px; overflow-y: auto; flex: 1; }
  .branch-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .branch-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: transparent;
    color: var(--text-primary);
    border: 1px solid transparent;
    border-radius: var(--radius);
    text-align: left;
    font-size: 13px;
  }
  .branch-item:hover { background: var(--bg-tertiary); }
  .branch-item.active { border-color: var(--accent); background: rgba(59,130,246,0.1); }
  .branch-name { flex: 1; font-family: var(--font-mono); font-size: 12px; }
  .actions { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .actions input { width: 100%; }
  h4 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    margin: 12px 0 8px;
  }
  .preview {
    background: var(--bg-tertiary);
    border-radius: var(--radius);
    padding: 10px;
    font-size: 12px;
    margin-bottom: 12px;
  }
  .preview.has-collisions { border: 1px solid var(--danger); }
  .preview ul { list-style: none; margin-top: 6px; font-family: var(--font-mono); font-size: 11px; }
  .collision-warn { color: var(--danger); margin-top: 6px; display: flex; align-items: center; gap: 6px; }
  .ok { color: var(--success); margin-top: 6px; }
  .mr-card {
    background: var(--bg-tertiary);
    border-radius: var(--radius);
    padding: 8px 10px;
    margin-bottom: 6px;
    font-size: 12px;
  }
  .mr-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .mr-msg { flex: 1; }
  .mr-actions { display: flex; gap: 6px; margin-top: 6px; }
  .badge.approved, .badge.merged { background: var(--success); color: white; }
  .badge.rejected { background: var(--danger); color: white; }
</style>
