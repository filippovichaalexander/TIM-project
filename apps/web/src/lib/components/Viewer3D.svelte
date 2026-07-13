<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { BuildingElement } from '@tim/shared';
  import { BIMViewer } from '../viewer.js';

  interface Props {
    elements?: BuildingElement[];
    collisionIds?: Set<string>;
    selectedId?: string | null;
    onselect?: (id: string | null) => void;
  }

  let { elements = [], collisionIds = new Set<string>(), selectedId = null, onselect }: Props = $props();

  let container: HTMLDivElement;
  let viewer: BIMViewer | null = null;
  let loadMs = $state(0);

  onMount(() => {
    viewer = new BIMViewer(container);
    viewer.onSelect = (id) => onselect?.(id);
    loadMs = viewer.loadElements(elements, collisionIds, selectedId);
  });

  onDestroy(() => viewer?.dispose());

  $effect(() => {
    if (viewer) {
      loadMs = viewer.loadElements(elements, collisionIds, selectedId);
    }
  });
</script>

<div class="viewer-wrap" bind:this={container}>
  {#if loadMs > 0}
    <div class="tr-badge" title="T2 render time">
      T2: {loadMs.toFixed(1)}ms
    </div>
  {/if}
</div>

<style>
  .viewer-wrap {
    width: 100%;
    height: 100%;
    position: relative;
  }
  .tr-badge {
    position: absolute;
    bottom: 12px;
    right: 12px;
    background: rgba(0,0,0,0.7);
    color: var(--text-secondary);
    font-size: 11px;
    font-family: var(--font-mono);
    padding: 4px 8px;
    border-radius: 4px;
    pointer-events: none;
  }
</style>
