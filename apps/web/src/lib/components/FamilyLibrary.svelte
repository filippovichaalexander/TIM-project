<script lang="ts">
  import type { Family } from '@tim/shared';
  import { api } from '../api.js';

  interface Props {
    oninsert?: (family: Family) => void;
  }

  let { oninsert }: Props = $props();

  let families = $state<Family[]>([]);
  let filter = $state('');
  let uploadName = $state('');
  let uploadCategory = $state('generic');

  async function load() {
    families = await api.getFamilyLibrary();
  }

  async function handleUpload() {
    if (!uploadName.trim()) return;
    const family = await api.uploadFamily({
      name: uploadName,
      category: uploadCategory,
      parameters: [{ name: 'width', value: 1, unit: 'm' }, { name: 'height', value: 1, unit: 'm' }],
    });
    families = [...families, family];
    uploadName = '';
  }

  const filtered = $derived(
    families.filter(f =>
      f.name.toLowerCase().includes(filter.toLowerCase()) ||
      f.category.includes(filter.toLowerCase())
    )
  );

  $effect(() => { load(); });
</script>

<div class="panel family-panel">
  <div class="panel-header">
    Family Library
    <span class="count">{families.length}</span>
  </div>
  <div class="content">
    <input bind:value={filter} placeholder="Search families..." class="search" />

    <ul class="family-list">
      {#each filtered as fam (fam.id)}
        <li>
          <button class="family-item" onclick={() => oninsert?.(fam)}>
            <span class="fam-name">{fam.name}</span>
            <span class="fam-cat">{fam.category}</span>
            <span class="fam-src">{fam.source}</span>
          </button>
        </li>
      {/each}
    </ul>

    <div class="upload-section">
      <h4>Upload Custom Family</h4>
      <input bind:value={uploadName} placeholder="Family name" />
      <select bind:value={uploadCategory}>
        <option value="wall">Wall</option>
        <option value="column">Column</option>
        <option value="slab">Slab</option>
        <option value="window">Window</option>
        <option value="door">Door</option>
        <option value="generic">Generic</option>
      </select>
      <button class="primary" onclick={handleUpload}>Upload</button>
    </div>
  </div>
</div>

<style>
  .family-panel { height: 100%; display: flex; flex-direction: column; }
  .count {
    font-size: 11px;
    background: var(--bg-tertiary);
    padding: 1px 7px;
    border-radius: 8px;
  }
  .content { padding: 10px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .search { width: 100%; }
  .family-list { list-style: none; flex: 1; overflow-y: auto; }
  .family-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background: transparent;
    color: var(--text-primary);
    border-radius: var(--radius);
    text-align: left;
    font-size: 13px;
  }
  .family-item:hover { background: var(--bg-tertiary); }
  .fam-name { flex: 1; }
  .fam-cat { font-size: 11px; color: var(--text-secondary); }
  .fam-src { font-size: 10px; color: var(--accent); text-transform: uppercase; }
  .upload-section {
    border-top: 1px solid var(--border);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  h4 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
  }
</style>
