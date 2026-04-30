<script>
  import { createEventDispatcher } from 'svelte';
  import { MdiClose } from '../icons/index.js';
  import { defaultFilterState, TYPE_LABELS, TYPE_VALUES } from '../../lib/filter.js';

  /** @type {ReturnType<import('../../lib/filter.js')['defaultFilterState']>|null} */
  export let value = null;
  /** Per-view preset shape — controls which tri-state rows are hidden. */
  export let preset = {};
  /** Map<labelName, count> from the current list — drives the label picker. */
  export let availableLabels = new Map();

  const dispatch = createEventDispatcher();

  // Local copies; commit on Apply, discard on Dismiss.
  let search, title, site, label, fromDate, toDate, types,
      isFavorite, isArchived, withLabels;

  // Reset locals from the incoming value whenever it changes (sheet open).
  $: seed(value);
  function seed(v) {
    const s = v || defaultFilterState();
    search = s.search || '';
    title = s.title || '';
    site = s.site || '';
    label = s.label || null;
    fromDate = s.fromDate || '';
    toDate = s.toDate || '';
    types = new Set(s.types || []);
    isFavorite = s.isFavorite ?? null;
    isArchived = s.isArchived ?? null;
    withLabels = s.withLabels ?? null;
  }

  function toggleType(t) {
    const next = new Set(types);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    types = next;
  }

  $: hasAny =
    !!search || !!title || !!site || !!label || !!fromDate || !!toDate ||
    types.size > 0 || isFavorite != null || isArchived != null || withLabels != null;

  function onReset() { dispatch('reset'); }
  function onDismiss() { dispatch('dismiss'); }
  function onSubmit(event) {
    event.preventDefault();
    onApply();
  }
  function onApply() {
    dispatch('apply', {
      value: {
        search: search.trim(),
        title: title.trim(),
        site: site.trim(),
        label: label || null,
        fromDate,
        toDate,
        types: new Set(types),
        isFavorite,
        isArchived,
        withLabels,
      },
    });
  }

  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); onDismiss(); }
  }

  // Sorted list of labels for the picker.
  $: sortedLabels = Array.from(availableLabels.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));

  // Hide tri-states that the view's preset has already pinned.
  $: showFavorite = preset.isFavorite === undefined;
  $: showArchived = preset.isArchived === undefined;
  $: showWithLabels = preset.withLabels === undefined;
</script>

<svelte:window on:keydown={onKey} />

<div class="scrim" on:click={onDismiss} aria-hidden="true"></div>

<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="filter-title">
  <div class="header">
    <h3 id="filter-title" class="title">Filter</h3>
    <button type="button" class="icon-btn" on:click={onDismiss} aria-label="Close filter">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d={MdiClose} fill="currentColor" />
      </svg>
    </button>
  </div>

  <form class="form" on:submit={onSubmit}>
  <div class="body">
    <label class="field">
      <span class="field-label">Search</span>
      <input type="search" bind:value={search} placeholder="Search bookmarks" />
    </label>

    <label class="field">
      <span class="field-label">Title</span>
      <input type="text" bind:value={title} />
    </label>

    <div class="row two-col">
      <label class="field">
        <span class="field-label">Site</span>
        <input type="text" bind:value={site} placeholder="example.com" />
      </label>
      <label class="field">
        <span class="field-label">Label</span>
        <select bind:value={label}>
          <option value={null}>— Any —</option>
          {#each sortedLabels as [name, count] (name)}
            <option value={name}>{name} ({count})</option>
          {/each}
        </select>
      </label>
    </div>

    <div class="row two-col">
      <label class="field">
        <span class="field-label">From date</span>
        <input type="date" bind:value={fromDate} />
      </label>
      <label class="field">
        <span class="field-label">To date</span>
        <input type="date" bind:value={toDate} />
      </label>
    </div>

    <div class="field">
      <span class="field-label">Type</span>
      <div class="chip-row">
        {#each TYPE_VALUES as t}
          <button
            type="button"
            class="chip"
            class:selected={types.has(t)}
            on:click={() => toggleType(t)}
          >{TYPE_LABELS[t]}</button>
        {/each}
      </div>
    </div>

    {#if showFavorite}
      <div class="tri-row">
        <span class="tri-label">Favorite</span>
        <div class="seg">
          <button type="button" class:active={isFavorite == null}  on:click={() => isFavorite = null}>Any</button>
          <button type="button" class:active={isFavorite === true} on:click={() => isFavorite = true}>Yes</button>
          <button type="button" class:active={isFavorite === false} on:click={() => isFavorite = false}>No</button>
        </div>
      </div>
    {/if}

    {#if showArchived}
      <div class="tri-row">
        <span class="tri-label">Archived</span>
        <div class="seg">
          <button type="button" class:active={isArchived == null}  on:click={() => isArchived = null}>Any</button>
          <button type="button" class:active={isArchived === true} on:click={() => isArchived = true}>Yes</button>
          <button type="button" class:active={isArchived === false} on:click={() => isArchived = false}>No</button>
        </div>
      </div>
    {/if}

    {#if showWithLabels}
      <div class="tri-row">
        <span class="tri-label">With labels</span>
        <div class="seg">
          <button type="button" class:active={withLabels == null}  on:click={() => withLabels = null}>Any</button>
          <button type="button" class:active={withLabels === true} on:click={() => withLabels = true}>Yes</button>
          <button type="button" class:active={withLabels === false} on:click={() => withLabels = false}>No</button>
        </div>
      </div>
    {/if}
  </div>

  <div class="actions">
    {#if hasAny}
      <button type="button" class="btn" on:click={onReset}>Reset</button>
    {/if}
    <button type="submit" class="btn primary">Search</button>
  </div>
  </form>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--bg-overlay, rgba(0,0,0,0.4));
    z-index: 70;
  }
  .sheet {
    position: fixed;
    z-index: 80;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    box-shadow: var(--md-sys-shadow-1);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    box-sizing: border-box;
    overflow: hidden;
  }
  /* Bottom-aligned slide-up on narrow screens. */
  @media (max-width: 767px) {
    .sheet {
      left: 0;
      right: 0;
      bottom: 0;
      border-top-left-radius: var(--md-sys-radius-medium);
      border-top-right-radius: var(--md-sys-radius-medium);
    }
  }
  /* Centered modal on wide. */
  @media (min-width: 768px) {
    .sheet {
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(92vw, 560px);
      border-radius: var(--md-sys-radius-medium);
    }
  }

  .header {
    display: flex;
    align-items: center;
    padding: 16px 20px 8px;
    flex-shrink: 0;
  }
  .title {
    margin: 0;
    flex: 1 1 auto;
    font-size: 1.1rem;
    font-weight: 600;
  }
  .icon-btn {
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    color: var(--md-sys-color-on-surface);
    border-radius: 999px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .icon-btn:hover { background: var(--bg-hover); }

  .form {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }
  .body {
    overflow-y: auto;
    padding: 8px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: 1 1 auto;
    min-height: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .field-label {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
  }
  .field input,
  .field select {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--md-sys-color-outline);
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    border-radius: 8px;
    font: inherit;
    font-size: 0.9rem;
    box-sizing: border-box;
  }
  .field input:focus,
  .field select:focus {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: -1px;
    border-color: transparent;
  }

  .row.two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    padding: 6px 14px;
    border: 1px solid var(--md-sys-color-outline);
    background: transparent;
    color: var(--md-sys-color-on-surface);
    border-radius: 999px;
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }
  .chip:hover { background: var(--bg-hover); }
  .chip.selected {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    border-color: transparent;
  }

  .tri-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .tri-label {
    flex: 1 1 auto;
    font-size: 0.9rem;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 999px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .seg button {
    padding: 5px 14px;
    border: none;
    background: transparent;
    color: var(--md-sys-color-on-surface);
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }
  .seg button + button {
    border-left: 1px solid var(--md-sys-color-outline);
  }
  .seg button:hover { background: var(--bg-hover); }
  .seg button.active {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px 16px;
    border-top: 1px solid var(--md-sys-color-surface-variant);
    flex-shrink: 0;
  }
  .btn {
    padding: 8px 18px;
    border: none;
    background: transparent;
    color: var(--md-sys-color-primary);
    font: inherit;
    font-weight: 600;
    font-size: 0.88rem;
    border-radius: 999px;
    cursor: pointer;
  }
  .btn:hover { background: var(--bg-hover); }
  .btn.primary {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
  }
  .btn.primary:hover { filter: brightness(1.05); }
</style>
