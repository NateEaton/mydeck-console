<script>
  import { createEventDispatcher } from 'svelte';
  import {
    MdiAlertOutline,
    MdiCheckCircleOutline,
    MdiSwapHorizontal,
    MdiEyeOffOutline,
    MdiCogOutline,
    MdiHelpCircleOutline,
    MdiInfoOutline,
  } from '../icons/index.js';

  export let active = 'triage';
  export let variant = 'permanent'; // 'permanent' | 'modal'
  export let open = true;
  /** @type {{ triage?: number, recovered?: number, replaced?: number, ignored?: number }} */
  export let counts = {};

  const dispatch = createEventDispatcher();

  const items = [
    { key: 'triage',    label: 'Triage',     icon: MdiAlertOutline },
    { key: 'recovered', label: 'Recovered',  icon: MdiCheckCircleOutline },
    { key: 'replaced',  label: 'Replaced',   icon: MdiSwapHorizontal },
    { key: 'ignored',   label: 'Ignored',    icon: MdiEyeOffOutline },
  ];
  const footerItems = [
    { key: 'settings',  label: 'Settings',   icon: MdiCogOutline },
    { key: 'guide',     label: 'User Guide', icon: MdiHelpCircleOutline },
    { key: 'about',     label: 'About',      icon: MdiInfoOutline },
  ];

  function pick(key) {
    dispatch('select', { view: key });
  }

  function onScrim() {
    dispatch('scrim');
  }
</script>

{#if variant === 'modal' && open}
  <div class="scrim" on:click={onScrim} aria-hidden="true"></div>
{/if}

<aside
  class="drawer {variant}"
  class:open
  aria-label="Main navigation"
>
  <div class="brand">MyDeck Console</div>

  <nav>
    {#each items as item}
      <button
        class="nav-item"
        class:active={active === item.key}
        on:click={() => pick(item.key)}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d={item.icon} fill="currentColor" />
        </svg>
        <span class="nav-label">{item.label}</span>
        {#if Number.isFinite(counts[item.key])}
          <span class="count-pill" class:zero={counts[item.key] === 0}>{counts[item.key]}</span>
        {/if}
      </button>
    {/each}

    <div class="separator" role="separator"></div>

    {#each footerItems as item}
      <button
        class="nav-item"
        class:active={active === item.key}
        on:click={() => pick(item.key)}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d={item.icon} fill="currentColor" />
        </svg>
        <span class="nav-label">{item.label}</span>
      </button>
    {/each}
  </nav>
</aside>

<style>
  .drawer {
    width: 280px;
    background: var(--md-sys-color-surface);
    border-right: 1px solid var(--md-sys-color-surface-variant);
    display: flex;
    flex-direction: column;
    padding: 12px 0;
    box-sizing: border-box;
  }
  .drawer.permanent {
    height: 100%;
    flex-shrink: 0;
  }
  .drawer.modal {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: var(--md-sys-shadow-1);
  }
  .drawer.modal.open {
    transform: translateX(0);
  }
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--bg-overlay);
    z-index: 40;
  }
  .brand {
    padding: 12px 24px 20px;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 8px;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 48px;
    padding: 0 16px;
    border: none;
    background: transparent;
    color: var(--md-sys-color-on-surface);
    font: inherit;
    text-align: left;
    border-radius: 999px;
    cursor: pointer;
  }
  .nav-item:hover {
    background: var(--bg-hover);
  }
  .nav-item.active {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }
  .nav-item svg {
    flex-shrink: 0;
  }
  .nav-label {
    flex: 1 1 auto;
    min-width: 0;
  }
  .count-pill {
    flex-shrink: 0;
    min-width: 24px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--md-sys-color-surface-variant);
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.78rem;
    font-weight: 600;
    text-align: center;
    line-height: 1.4;
  }
  .count-pill.zero {
    opacity: 0.55;
  }
  .nav-item.active .count-pill {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
  }
  .separator {
    height: 1px;
    background: var(--md-sys-color-surface-variant);
    margin: 10px 16px;
  }
</style>
