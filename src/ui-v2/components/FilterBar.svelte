<script>
  import { createEventDispatcher } from 'svelte';
  import { MdiClose } from '../icons/index.js';
  import { defaultFilterState, TYPE_LABELS } from '../../lib/filter.js';

  /** Active filter state (must be present — bar is only rendered when active). */
  export let value;

  const dispatch = createEventDispatcher();

  function fmt(yyyymmdd) {
    if (!yyyymmdd) return '';
    const ms = Date.parse(`${yyyymmdd}T00:00:00`);
    if (!Number.isFinite(ms)) return yyyymmdd;
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function patch(field, next) {
    dispatch('change', { value: { ...value, [field]: next } });
  }
  function patchTypes(t) {
    const next = new Set(value.types || []);
    next.delete(t);
    dispatch('change', { value: { ...value, types: next } });
  }
  function open() {
    dispatch('open');
  }

  $: chips = (() => {
    const out = [];
    const v = value || defaultFilterState();
    if (v.search) out.push({ key: 'search', label: `Search: ${v.search}`, dismiss: () => patch('search', '') });
    if (v.title)  out.push({ key: 'title',  label: `Title: ${v.title}`,   dismiss: () => patch('title',  '') });
    if (v.site)   out.push({ key: 'site',   label: `Site: ${v.site}`,     dismiss: () => patch('site',   '') });
    if (v.label)  out.push({ key: 'label',  label: `Label: ${v.label}`,   dismiss: () => patch('label',  null) });
    if (v.fromDate) out.push({ key: 'from', label: `From: ${fmt(v.fromDate)}`, dismiss: () => patch('fromDate', '') });
    if (v.toDate)   out.push({ key: 'to',   label: `To: ${fmt(v.toDate)}`,     dismiss: () => patch('toDate',   '') });
    if (v.types) {
      for (const t of v.types) {
        out.push({ key: `type:${t}`, label: `Type: ${TYPE_LABELS[t] || t}`, dismiss: () => patchTypes(t) });
      }
    }
    if (v.isFavorite != null) {
      out.push({ key: 'fav',  label: `Favorite: ${v.isFavorite ? 'Yes' : 'No'}`, dismiss: () => patch('isFavorite', null) });
    }
    if (v.isArchived != null) {
      out.push({ key: 'arch', label: `Archived: ${v.isArchived ? 'Yes' : 'No'}`, dismiss: () => patch('isArchived', null) });
    }
    if (v.withLabels != null) {
      out.push({ key: 'wlab', label: `With labels: ${v.withLabels ? 'Yes' : 'No'}`, dismiss: () => patch('withLabels', null) });
    }
    return out;
  })();
</script>

{#if chips.length > 0}
  <div class="bar" on:click={open}>
    {#each chips as c (c.key)}
      <span class="chip" on:click|stopPropagation={open}>
        {c.label}
        <button
          class="chip-dismiss"
          aria-label="Remove filter"
          on:click|stopPropagation={c.dismiss}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d={MdiClose} fill="currentColor" />
          </svg>
        </button>
      </span>
    {/each}
  </div>
{/if}

<style>
  .bar {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    overflow-x: auto;
    gap: 6px;
    padding: 8px 16px;
    min-height: 48px;
    border-bottom: 1px solid var(--md-sys-color-surface-variant);
    cursor: pointer;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 4px 4px 12px;
    min-height: 32px;
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    border-radius: 999px;
    font-size: 0.78rem;
    flex-shrink: 0;
    flex-basis: auto;
    white-space: nowrap;
    box-sizing: border-box;
  }
  .chip-dismiss {
    width: 22px;
    height: 22px;
    border: none;
    background: transparent;
    color: inherit;
    border-radius: 999px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .chip-dismiss:hover { background: rgba(0,0,0,0.08); }
</style>
