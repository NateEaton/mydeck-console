<script>
  import { createEventDispatcher } from 'svelte';
  import { fetchServerInfo, startSignIn, defaultRedirectUri } from '../../lib/api/oauth';
  import { MdiAlertCircle } from '../icons/index.js';

  const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

  export let initialUrl = '';
  export let initialError = '';

  const dispatch = createEventDispatcher();

  let serverUrl = initialUrl;
  let busy = false;
  let error = initialError;

  function normalizeUrl(input) {
    let s = (input || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
    return s.replace(/\/+$/, '');
  }

  async function onSignIn() {
    error = '';
    const url = normalizeUrl(serverUrl);
    if (!url) {
      error = 'Enter your Readeck server URL.';
      return;
    }

    busy = true;
    try {
      const { supportsOAuth } = await fetchServerInfo();
      if (!supportsOAuth) {
        error = 'This Readeck server does not advertise OAuth support. Update Readeck or use an older console build.';
        busy = false;
        return;
      }
      // Persist the URL up to the parent before we navigate away.
      dispatch('server-url', { url });
      await startSignIn(url, defaultRedirectUri());
      // browser navigates away; this line generally doesn't run
    } catch (e) {
      console.error('Sign-in failed:', e);
      error = e?.message || 'Could not reach the Readeck server. Check the URL and try again.';
      busy = false;
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!busy) onSignIn();
  }
</script>

<div class="signin">
  <div class="card">
    <div class="brand-header">
      <img src="{import.meta.env.BASE_URL}icon-192.png" alt="" width="72" height="72" class="brand-icon-img" />
      <div class="brand-divider" aria-hidden="true"></div>
      <div class="brand-text">
        <div class="brand-name">MyDeck Console</div>
        <div class="version">Version {APP_VERSION}</div>
      </div>
    </div>
    <h2>Sign in to Readeck</h2>
    <p class="lead">
      Enter your Readeck server URL. You'll be redirected to Readeck to log in
      and authorize MyDeck Console.
    </p>

    <form on:submit={onSubmit}>
      <label class="field">
        <span>Server URL</span>
        <input
          type="url"
          bind:value={serverUrl}
          placeholder="https://read.example.com"
          autocomplete="url"
          inputmode="url"
          spellcheck="false"
          disabled={busy}
        />
      </label>

      {#if error}
        <div class="error">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d={MdiAlertCircle} fill="currentColor" />
          </svg>
          <span>{error}</span>
        </div>
      {/if}

      <button class="primary" type="submit" disabled={busy || !serverUrl.trim()}>
        {busy ? 'Connecting…' : 'Sign in with Readeck'}
      </button>
    </form>
  </div>
</div>

<style>
  .signin {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 70vh;
    padding: 24px;
  }
  .card {
    width: 100%;
    max-width: 460px;
    background: var(--bg-card);
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: var(--md-sys-radius-medium);
    padding: 28px 28px 24px;
    box-sizing: border-box;
  }
  .brand-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  .brand-icon-img {
    border-radius: 16px;
    flex-shrink: 0;
  }
  .brand-divider {
    width: 1px;
    height: 52px;
    background: var(--md-sys-color-outline);
    opacity: 0.6;
    flex-shrink: 0;
  }
  .brand-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .brand-name {
    font-size: 1.35rem;
    font-weight: 500;
    line-height: 1.2;
    color: var(--md-sys-color-on-surface);
  }
  .version {
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.9rem;
  }
  h2 {
    margin: 0 0 6px;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }
  .lead {
    margin: 0 0 20px;
    font-size: 0.9rem;
    color: var(--md-sys-color-on-surface-variant);
    line-height: 1.45;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.82rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .field input {
    padding: 10px 12px;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 8px;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    font: inherit;
  }
  .field input:focus {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: -1px;
  }
  .field input:disabled {
    opacity: 0.6;
  }
  .error {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--md-sys-color-surface-variant);
    color: var(--error-fg);
    font-size: 0.85rem;
  }
  .error svg { flex-shrink: 0; margin-top: 1px; }
  .primary {
    margin-top: 4px;
    padding: 12px 18px;
    border: none;
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border-radius: 999px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .primary:hover { filter: brightness(1.05); }
  .primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
