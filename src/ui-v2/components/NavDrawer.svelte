<script>
  import { createEventDispatcher } from 'svelte';
  import {
    MdiAlert,
    MdiCheckCircle,
    MdiSwapHorizontal,
    MdiCog,
    MdiHelpCircle,
    MdiInfo,
  } from '../icons/index.js';

  export let active = 'triage';
  export let variant = 'permanent'; // 'permanent' | 'modal'
  export let open = true;

  const dispatch = createEventDispatcher();

  const items = [
    { key: 'triage',    label: 'Triage',     icon: MdiAlert },
    { key: 'recovered', label: 'Recovered',  icon: MdiCheckCircle },
    { key: 'replaced',  label: 'Replaced',   icon: MdiSwapHorizontal },
  ];
  const footerItems = [
    { key: 'settings',  label: 'Settings',   icon: MdiCog },
    { key: 'guide',     label: 'User Guide', icon: MdiHelpCircle },
    { key: 'about',     label: 'About',      icon: MdiInfo },
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
        <span>{item.label}</span>
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
        <span>{item.label}</span>
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
  .separator {
    height: 1px;
    background: var(--md-sys-color-surface-variant);
    margin: 10px 16px;
  }
</style>
