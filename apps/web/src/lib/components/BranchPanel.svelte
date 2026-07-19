<script lang="ts">
  import type { Branch, MergeRequest, User } from '@tim/shared';
  import type { MergePreview } from '@tim/core';
  import { api } from '../api.js';

  interface Props {
    branches?: Branch[];
    activeBranchId?: string;
    projectId?: string;
    currentUser?: User | null;
    onbranchchange?: (branchId: string) => void;
    onrefresh?: () => void;
  }

  let {
    branches = [],
    activeBranchId = '',
    projectId = '',
    currentUser = null,
    onbranchchange,
    onrefresh,
  }: Props = $props();

  let mergeRequests = $state<MergeRequest[]>([]);
  let preview = $state<(MergePreview & { crossBranchCount?: number; withinMainCount?: number }) | null>(null);
  let loading = $state(false);
  let message = $state('');
  let actionError = $state('');

  const activeBranch = $derived(branches.find(b => b.id === activeBranchId));
  const mainBranch = $derived(branches.find(b => b.isMain));
  const isApprover = $derived(currentUser?.role === 'approval_user');
  const isArchitect = $derived(currentUser?.role === 'architect');
  const previewHasCollisions = $derived((preview?.collisions.length ?? 0) > 0);
  const unresolved = (mr: MergeRequest) => mr.collisions.filter(c => !c.resolved);

  async function loadMergeRequests() {
    if (!projectId) return;
    mergeRequests = await api.getMergeRequests(projectId);
  }

  async function handlePreview() {
    if (!activeBranch || !mainBranch || activeBranch.isMain) return;
    loading = true;
    actionError = '';
    try {
      preview = await api.previewMerge(activeBranch.id, mainBranch.id);
    } finally {
      loading = false;
    }
  }

  async function handlePush() {
    if (!activeBranch || !mainBranch || activeBranch.isMain) return;
    if (previewHasCollisions) return;
    loading = true;
    actionError = '';
    try {
      // Always re-check before creating the MR
      preview = await api.previewMerge(activeBranch.id, mainBranch.id);
      if (preview.collisions.length > 0) return;

      await api.createMergeRequest({
        projectId,
        sourceBranchId: activeBranch.id,
        targetBranchId: mainBranch.id,
        authorId: currentUser?.id ?? activeBranch.authorId,
        message: message || `Push ${activeBranch.name} → main`,
      });
      message = '';
      await loadMergeRequests();
      onrefresh?.();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  /** Architects can open an MR with collisions so ApprovalUser can fix them */
  async function handlePushWithCollisions() {
    if (!activeBranch || !mainBranch || activeBranch.isMain || !isArchitect) return;
    loading = true;
    actionError = '';
    try {
      preview = await api.previewMerge(activeBranch.id, mainBranch.id);
      await api.createMergeRequest({
        projectId,
        sourceBranchId: activeBranch.id,
        targetBranchId: mainBranch.id,
        authorId: currentUser?.id ?? activeBranch.authorId,
        message: message || `Push ${activeBranch.name} → main (needs conflict fix)`,
      });
      message = '';
      await loadMergeRequests();
      onrefresh?.();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function handleApprove(mrId: string) {
    if (!isApprover || !currentUser) return;
    const mr = mergeRequests.find(m => m.id === mrId);
    if (!mr || unresolved(mr).length > 0) return;
    actionError = '';
    try {
      await api.approveMerge(mrId, currentUser.id);
      await loadMergeRequests();
      onrefresh?.();
    } catch (e) {
      actionError = (e as Error).message;
      await loadMergeRequests();
    }
  }

  async function handleReject(mrId: string) {
    if (!isApprover || !currentUser) return;
    try {
      await api.rejectMerge(mrId, currentUser.id);
      await loadMergeRequests();
    } catch (e) {
      actionError = (e as Error).message;
    }
  }

  async function handleFix(mrId: string, collisionId: string) {
    if (!isApprover || !currentUser) return;
    loading = true;
    actionError = '';
    try {
      const result = await api.fixCollision(mrId, collisionId, currentUser.id);
      mergeRequests = mergeRequests.map(m => m.id === mrId ? result.mergeRequest : m);
      onrefresh?.();
    } catch (e) {
      actionError = (e as Error).message;
    } finally {
      loading = false;
    }
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

    {#if activeBranch && !activeBranch.isMain && isArchitect}
      <div class="actions">
        <input bind:value={message} placeholder="Commit message..." />
        <button class="ghost" onclick={handlePreview} disabled={loading}>
          Preview Collisions
        </button>
        <button
          class="primary"
          onclick={handlePush}
          disabled={loading || previewHasCollisions}
          title={previewHasCollisions ? 'Resolve collisions or open MR for ApprovalUser' : 'Push clean branch to main'}
        >
          Push to Main
        </button>
        {#if previewHasCollisions}
          <button class="ghost" onclick={handlePushWithCollisions} disabled={loading}>
            Open MR with collisions
          </button>
        {/if}
      </div>

      {#if preview}
        <div class="preview" class:has-collisions={previewHasCollisions}>
          <h4>Merge Preview</h4>
          <p>{preview.newElements.length} new, {preview.modifiedElements.length} modified</p>
          {#if previewHasCollisions}
            <p class="collision-warn">
              <span class="badge collision">{preview.collisions.length}</span>
              collision(s) — Approve stays blocked until ApprovalUser fixes them
            </p>
            {#if preview.crossBranchCount !== undefined}
              <p class="hint">
                vs main: {preview.crossBranchCount}, within main: {preview.withinMainCount ?? 0}
              </p>
            {/if}
            <ul>
              {#each preview.collisions as col}
                <li>{col.elementAId} ↔ {col.elementBId}</li>
              {/each}
            </ul>
          {:else}
            <p class="ok">No collisions — ready for ApprovalUser merge</p>
          {/if}
        </div>
      {/if}
    {/if}

    {#if actionError}
      <p class="action-error">{actionError}</p>
    {/if}

    {#if mergeRequests.length > 0}
      <h4>Merge Requests</h4>
      {#each mergeRequests as mr (mr.id)}
        {@const openCollisions = unresolved(mr)}
        <div class="mr-card">
          <div class="mr-header">
            <span class="badge {mr.status}">{mr.status}</span>
            <span class="mr-msg">{mr.message}</span>
          </div>
          {#if openCollisions.length > 0}
            <span class="badge collision">{openCollisions.length} collisions</span>
            <ul class="col-list">
              {#each openCollisions as col}
                <li>
                  <span>{col.elementAId} ↔ {col.elementBId}</span>
                  {#if isApprover}
                    <button class="ghost fix-btn" disabled={loading} onclick={() => handleFix(mr.id, col.id)}>
                      Fix
                    </button>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
          {#if mr.status === 'open'}
            {#if isApprover}
              <div class="mr-actions">
                <button
                  class="primary"
                  onclick={() => handleApprove(mr.id)}
                  disabled={openCollisions.length > 0 || loading}
                  title={openCollisions.length > 0 ? 'Fix all collisions first' : 'Merge to main'}
                >
                  Approve → main
                </button>
                <button class="ghost" onclick={() => handleReject(mr.id)} disabled={loading}>Reject</button>
              </div>
            {:else}
              <p class="hint">Waiting for ApprovalUser to fix collisions and merge</p>
            {/if}
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
  .preview ul, .col-list { list-style: none; margin-top: 6px; font-family: var(--font-mono); font-size: 11px; }
  .col-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 4px 0;
  }
  .fix-btn { padding: 2px 8px; font-size: 11px; }
  .collision-warn { color: var(--danger); margin-top: 6px; display: flex; align-items: center; gap: 6px; }
  .ok { color: var(--success); margin-top: 6px; }
  .hint { color: var(--text-secondary); font-size: 11px; margin-top: 6px; }
  .action-error { color: var(--danger); font-size: 12px; margin: 8px 0; }
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
