<script lang="ts">
  import type { BuildingElement } from '@tim/shared';

  interface Props {
    elements?: BuildingElement[];
    selectedId?: string | null;
    collisionIds?: Set<string>;
    onselect?: (id: string) => void;
  }

  let { elements = [], selectedId = null, collisionIds = new Set<string>(), onselect }: Props = $props();

  const categoryIcon: Record<string, string> = {
    wall: '▬', column: '▮', slab: '▭', beam: '─',
    door: '▯', window: '▢', pipe: '◎', duct: '◯', generic: '◆',
  };
</script>

<div class="panel tree-panel">
  <div class="panel-header">
    Model Tree
    <span class="count">{elements.length}</span>
  </div>
  <ul class="tree">
    {#each elements as el (el.id)}
      <li>
        <button
          class="tree-item"
          class:selected={el.id === selectedId}
          class:collision={collisionIds.has(el.id)}
          onclick={() => onselect?.(el.id)}
        >
          <span class="icon">{categoryIcon[el.category] ?? '◆'}</span>
          <span class="name">{el.name}</span>
          <span class="cat">{el.category}</span>
        </button>
      </li>
    {/each}
    {#if elements.length === 0}
      <li class="empty">No elements on this branch</li>
    {/if}
  </ul>
</div>

<style>
  .tree-panel { height: 100%; display: flex; flex-direction: column; }
  .count {
    font-size: 11px;
    background: var(--bg-tertiary);
    padding: 1px 7px;
    border-radius: 8px;
  }
  .tree {
    list-style: none;
    overflow-y: auto;
    flex: 1;
    padding: 4px;
  }
  .tree-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: transparent;
    color: var(--text-primary);
    border-radius: var(--radius);
    text-align: left;
    font-size: 13px;
  }
  .tree-item:hover { background: var(--bg-tertiary); }
  .tree-item.selected { background: rgba(59,130,246,0.2); color: var(--accent); }
  .tree-item.collision { border-left: 3px solid var(--danger); }
  .icon { font-size: 14px; opacity: 0.7; width: 16px; text-align: center; }
  .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cat { font-size: 11px; color: var(--text-secondary); }
  .empty { padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px; }
</style>
