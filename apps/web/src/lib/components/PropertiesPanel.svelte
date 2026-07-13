<script lang="ts">
  import type { BuildingElement } from '@tim/shared';
  import { validateElement } from '@tim/core';

  interface Props {
    element?: BuildingElement | null;
  }

  let { element = null }: Props = $props();

  let validation = $derived(element ? validateElement(element) : []);
</script>

<div class="panel props-panel">
  <div class="panel-header">Properties</div>
  {#if element}
    <div class="content">
      <div class="field">
        <label>Name</label>
        <span>{element.name}</span>
      </div>
      <div class="field">
        <label>Category</label>
        <span class="cat-badge">{element.category}</span>
      </div>
      <div class="field">
        <label>ID</label>
        <span class="mono">{element.id}</span>
      </div>

      <h4>Parameters</h4>
      {#each Object.entries(element.parameters) as [key, param]}
        <div class="field">
          <label>{key}{param.unit ? ` (${param.unit})` : ''}</label>
          <span>{param.value}</span>
        </div>
      {/each}

      <h4>Bounding Box</h4>
      <div class="field">
        <label>Min</label>
        <span class="mono">
          ({element.bbox.min.x.toFixed(2)}, {element.bbox.min.y.toFixed(2)}, {element.bbox.min.z.toFixed(2)})
        </span>
      </div>
      <div class="field">
        <label>Max</label>
        <span class="mono">
          ({element.bbox.max.x.toFixed(2)}, {element.bbox.max.y.toFixed(2)}, {element.bbox.max.z.toFixed(2)})
        </span>
      </div>

      {#if validation.some(v => v.status === 'failed')}
        <h4>SNiP Validation</h4>
        {#each validation.filter(v => v.status === 'failed') as v}
          <div class="validation-error">
            {#each v.errors as err}
              <p>{err}</p>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
  {:else}
    <div class="empty">Select an element to view properties</div>
  {/if}
</div>

<style>
  .props-panel { height: 100%; display: flex; flex-direction: column; }
  .content { padding: 12px 14px; overflow-y: auto; flex: 1; }
  h4 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    margin: 14px 0 8px;
  }
  .field {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 13px;
  }
  label { color: var(--text-secondary); }
  .mono { font-family: var(--font-mono); font-size: 11px; }
  .cat-badge {
    background: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
  }
  .validation-error {
    background: rgba(239,68,68,0.1);
    border: 1px solid var(--danger);
    border-radius: var(--radius);
    padding: 8px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--danger);
  }
  .empty {
    padding: 30px 14px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 13px;
  }
</style>
