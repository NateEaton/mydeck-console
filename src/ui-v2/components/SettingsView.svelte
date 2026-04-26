<script>
  import { createEventDispatcher } from 'svelte';
  import { getTheme, setTheme } from '../../lib/theme.js';

  export let serverUrl = '';
  export let scope = '';
  export let signedIn = false;

  const dispatch = createEventDispatcher();

  const APPLY_KEY = 'apply_disposition';

  let disposition = (localStorage.getItem(APPLY_KEY) === 'delete') ? 'delete' : 'archive';
  let theme = getTheme();

  function onDispositionChange(value) {
    disposition = value;
    localStorage.setItem(APPLY_KEY, value);
  }

  function onThemeChange(value) {
    theme = value;
    setTheme(value);
  }

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

  <div class="section">
    <h3 class="section-title">General</h3>

    <fieldset class="group">
      <legend>Action on Apply</legend>
      <p class="help">What happens to the original bookmark after a successful repair.</p>
      <label class="opt">
        <input
          type="radio"
          name="disposition"
          value="archive"
          checked={disposition === 'archive'}
          on:change={() => onDispositionChange('archive')}
        />
        <span class="opt-label">
          <strong>Archive</strong>
          <span class="opt-sub">Mark the original archived and add the replaced-* label.</span>
        </span>
      </label>
      <label class="opt">
        <input
          type="radio"
          name="disposition"
          value="delete"
          checked={disposition === 'delete'}
          on:change={() => onDispositionChange('delete')}
        />
        <span class="opt-label">
          <strong>Delete</strong>
          <span class="opt-sub">Remove the original bookmark entirely.</span>
        </span>
      </label>
    </fieldset>

    <fieldset class="group">
      <legend>App theme</legend>
      <label class="opt">
        <input
          type="radio"
          name="theme"
          value="system"
          checked={theme === 'system'}
          on:change={() => onThemeChange('system')}
        />
        <span class="opt-label"><strong>System</strong></span>
      </label>
      <label class="opt">
        <input
          type="radio"
          name="theme"
          value="light"
          checked={theme === 'light'}
          on:change={() => onThemeChange('light')}
        />
        <span class="opt-label"><strong>Light</strong></span>
      </label>
      <label class="opt">
        <input
          type="radio"
          name="theme"
          value="dark"
          checked={theme === 'dark'}
          on:change={() => onThemeChange('dark')}
        />
        <span class="opt-label"><strong>Dark</strong></span>
      </label>
    </fieldset>
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
  .empty {
    margin: 0;
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.9rem;
  }

  .group {
    border: none;
    margin: 0 0 18px;
    padding: 0;
  }
  .group:last-child { margin-bottom: 0; }
  .group legend {
    padding: 0;
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
    margin-bottom: 6px;
  }
  .help {
    margin: 0 0 10px;
    font-size: 0.82rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .opt {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 4px;
    cursor: pointer;
  }
  .opt input {
    margin: 2px 0 0;
    accent-color: var(--md-sys-color-primary);
    cursor: pointer;
  }
  .opt-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.9rem;
    color: var(--md-sys-color-on-surface);
  }
  .opt-sub {
    font-size: 0.8rem;
    color: var(--md-sys-color-on-surface-variant);
    font-weight: 400;
  }
</style>
