<script>
  import { createEventDispatcher } from 'svelte';
  import { MdiMenu, MdiArrowLeft } from '../icons/index.js';

  export let title = 'MyDeck Console';
  export let showMenu = false;
  export let showBack = false;

  const dispatch = createEventDispatcher();
</script>

<header class="top-bar">
  {#if showBack}
    <button class="icon-btn" aria-label="Back" on:click={() => dispatch('back')}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d={MdiArrowLeft} fill="currentColor" />
      </svg>
    </button>
  {:else if showMenu}
    <button class="icon-btn" aria-label="Open navigation menu" on:click={() => dispatch('menu-toggle')}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d={MdiMenu} fill="currentColor" />
      </svg>
    </button>
  {/if}
  <h1 class="title">{title}</h1>
  <div class="trailing">
    <slot name="trailing" />
  </div>
</header>

<style>
  .top-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 64px;
    padding: 0 12px;
    background: var(--md-sys-color-surface);
    border-bottom: 1px solid var(--md-sys-color-surface-variant);
    flex-shrink: 0;
  }
  .icon-btn {
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
  .icon-btn:hover { background: var(--bg-hover); }
  .title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .trailing {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
</style>
