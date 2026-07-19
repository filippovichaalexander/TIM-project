<script lang="ts">
  import type { BuildingElement, Collision } from '@tim/shared';
  import { validateElement } from '@tim/core';

  interface Props {
    element?: BuildingElement | null;
    collision?: Collision | null;
    collisionA?: BuildingElement | null;
    collisionB?: BuildingElement | null;
  }

  let { element = null, collision = null, collisionA = null, collisionB = null }: Props = $props();

  let validation = $derived(element ? validateElement(element) : []);

  function overlapExtent() {
    if (!collisionA || !collisionB) return null;
    const a = collisionA.bbox, b = collisionB.bbox;
    const dx = Math.max(0, Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x));
    const dy = Math.max(0, Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y));
    const dz = Math.max(0, Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z));
    return { dx, dy, dz };
  }

  let overlap = $derived(overlapExtent());
</script>

<div class="panel props-panel">
  <div class="panel-header">{collision ? 'Collision Details' : 'Properties'}</div>
  {#if collision}
    <div class="content">
      <div class="collision-banner">
        <span class="sev {collision.severity}">{collision.severity}</span>
        <span>Пересечение конструкций</span>
      </div>

      <h4>Элемент A</h4>
      <div class="field">
        <span class="field-label">Name</span>
        <span>{collisionA?.name ?? collision.elementAId}</span>
      </div>
      <div class="field">
        <span class="field-label">Category</span>
        <span class="cat-badge">{collisionA?.category ?? '—'}</span>
      </div>
      <div class="field">
        <span class="field-label">ID</span>
        <span class="mono">{collision.elementAId}</span>
      </div>

      <h4>Элемент B</h4>
      <div class="field">
        <span class="field-label">Name</span>
        <span>{collisionB?.name ?? collision.elementBId}</span>
      </div>
      <div class="field">
        <span class="field-label">Category</span>
        <span class="cat-badge">{collisionB?.category ?? '—'}</span>
      </div>
      <div class="field">
        <span class="field-label">ID</span>
        <span class="mono">{collision.elementBId}</span>
      </div>

      {#if overlap}
        <h4>Область пересечения</h4>
        <div class="field">
          <span class="field-label">Δ размеры</span>
          <span class="mono">
            {overlap.dx.toFixed(2)} × {overlap.dy.toFixed(2)} × {overlap.dz.toFixed(2)} m
          </span>
        </div>
        <div class="field">
          <span class="field-label">Объём</span>
          <span class="mono">{(overlap.dx * overlap.dy * overlap.dz).toFixed(3)} m³</span>
        </div>
      {/if}
    </div>
  {:else if element}
    <div class="content">
      <div class="field">
        <span class="field-label">Name</span>
        <span>{element.name}</span>
      </div>
      <div class="field">
        <span class="field-label">Category</span>
        <span class="cat-badge">{element.category}</span>
      </div>
      <div class="field">
        <span class="field-label">ID</span>
        <span class="mono">{element.id}</span>
      </div>

      <h4>Parameters</h4>
      {#each Object.entries(element.parameters) as [key, param]}
        <div class="field">
          <span class="field-label">{key}{param.unit ? ` (${param.unit})` : ''}</span>
          <span>{param.value}</span>
        </div>
      {/each}

      <h4>Bounding Box</h4>
      <div class="field">
        <span class="field-label">Min</span>
        <span class="mono">
          ({element.bbox.min.x.toFixed(2)}, {element.bbox.min.y.toFixed(2)}, {element.bbox.min.z.toFixed(2)})
        </span>
      </div>
      <div class="field">
        <span class="field-label">Max</span>
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
  .field-label { color: var(--text-secondary); }
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
  .collision-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--danger);
    margin-bottom: 6px;
  }
  .sev {
    text-transform: uppercase;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--danger);
    color: white;
  }
  .sev.warning { background: var(--warning); color: #000; }
</style>
