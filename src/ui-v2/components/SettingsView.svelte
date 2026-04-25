<script>
  import { createEventDispatcher } from 'svelte';

  export let serverUrl = '';
  export let scope = '';
  export let signedIn = false;

  const dispatch = createEventDispatcher();

  function onSignOut() {
    dispatch('sign-out');
  }
</script>

<div class="settings">
  <div class="section">
    <h3 class="section-title">Account</h3>

    {#if signedIn}
      <div class="row">
        <div class="row-label">Server</div>
        <div class="row-value">{serverUrl || '—'}</div>
      </div>
      {#if scope}
        <div class="row">
          <div class="row-label">Scopes</div>
          <div class="row-value scopes">{scope}</div>
        </div>
      {/if}
      <div class="actions">
        <button class="btn danger" on:click={onSignOut}>Sign out</button>
      </div>
    {:else}
      <p class="empty">Not signed in.</p>
    {/if}
  </div>

  <div class="section coming">
    <h3 class="section-title">General</h3>
    <p class="muted">Action on Apply, theme, etc. — coming soon.</p>
  </div>
</div>

<style>
  .settings {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
  }
  .section {
    background: var(--bg-card);
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: var(--md-sys-radius-medium);
    padding: 20px 22px;
    margin-bottom: 16px;
    box-sizing: border-box;
  }
  .section-title {
    margin: 0 0 14px;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    color: var(--md-sys-color-on-surface-variant);
  }
  .row {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 12px;
    margin-bottom: 10px;
    font-size: 0.92rem;
  }
  .row-label {
    color: var(--md-sys-color-on-surface-variant);
  }
  .row-value {
    color: var(--md-sys-color-on-surface);
    word-break: break-all;
  }
  .row-value.scopes {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.82rem;
  }
  .actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
  .btn {
    padding: 8px 18px;
    border: 1px solid var(--md-sys-color-outline);
    background: transparent;
    color: var(--md-sys-color-on-surface);
    border-radius: 999px;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }
  .btn:hover { background: var(--bg-hover); }
  .btn.danger {
    color: var(--error-fg);
    border-color: var(--error-fg);
  }
  .empty, .muted {
    margin: 0;
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.9rem;
  }
  .coming { opacity: 0.7; }
</style>
