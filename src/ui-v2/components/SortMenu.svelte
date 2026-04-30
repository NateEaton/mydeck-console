<script>
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { MdiSwapVertical, MdiArrowDown, MdiArrowUp } from '../icons/index.js';
  import { SORT_GROUPS, SORT_OPTIONS } from '../../lib/sort.js';

  export let value;

  const dispatch = createEventDispatcher();

  let open = false;
  let wrapEl;
  let outsideHandler = null;

  function toggle() {
    open = !open;
    if (open) attachOutside();
    else detachOutside();
  }

  function close() {
    open = false;
    detachOutside();
  }

  function attachOutside() {
    if (outsideHandler) return;
    outsideHandler = (e) => {
      if (wrapEl && !wrapEl.contains(e.target)) close();
    };
    // defer to skip the click that opened us
    setTimeout(() => document.addEventListener('click', outsideHandler), 0);
  }

  function detachOutside() {
    if (!outsideHandler) return;
    document.removeEventListener('click', outsideHandler);
    outsideHandler = null;
  }

  onDestroy(detachOutside);

  function pick(group) {
    const isPrimaryActive = value === group.primary;
    const isToggledActive = value === group.toggled;
    const next = isPrimaryActive
      ? group.toggled
      : isToggledActive
        ? group.primary
        : group.primary;
    dispatch('change', { value: next });
    close();
  }
</script>

<div class="sort-wrap" bind:this={wrapEl}>
  <button class="bar-icon" on:click={toggle} aria-label="Sort" title="Sort" aria-haspopup="menu" aria-expanded={open}>
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d={MdiSwapVertical} fill="currentColor" />
    </svg>
  </button>

  {#if open}
    <div class="sort-menu" role="menu">
      {#each SORT_GROUPS as group}
        {@const active = value === group.primary || value === group.toggled}
        {@const activeKey = value === group.toggled ? group.toggled : group.primary}
        {@const desc = active && SORT_OPTIONS[activeKey].dir === 'desc'}
        <button class="menu-item" class:active on:click={() => pick(group)} role="menuitem">
          <span class="lead">
            {#if active}
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d={desc ? MdiArrowDown : MdiArrowUp} fill="currentColor" />
              </svg>
            {/if}
          </span>
          <span class="label">{group.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sort-wrap {
    position: relative;
    display: inline-flex;
  }
  .bar-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    background: transparent;
    color: var(--md-sys-color-on-surface);
    border-radius: 999px;
    cursor: pointer;
  }
  .bar-icon:hover { background: var(--bg-hover); }

  .sort-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 200px;
    background: var(--md-sys-color-surface);
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: var(--md-sys-radius-medium);
    box-shadow: var(--md-sys-shadow-1);
    padding: 6px 0;
    z-index: 60;
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 16px;
    border: none;
    background: transparent;
    color: var(--md-sys-color-on-surface);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .menu-item:hover { background: var(--bg-hover); }
  .menu-item .lead {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--md-sys-color-primary);
  }
  .menu-item .label {
    flex: 1 1 auto;
    min-width: 0;
  }
  .menu-item.active .label {
    color: var(--md-sys-color-primary);
    font-weight: 600;
  }
</style>
