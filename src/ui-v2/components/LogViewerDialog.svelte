<script>
  import { createEventDispatcher } from 'svelte';

  export let title = '';
  export let log = '';
  export let loading = false;

  const dispatch = createEventDispatcher();

  function onClose() {
    dispatch('close');
  }

  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  }

  async function onCopy() {
    if (!log) return;
    try {
      await navigator.clipboard.writeText(log);
    } catch {
      // Clipboard API may be unavailable in some contexts; swallow silently.
    }
  }
</script>

<svelte:window on:keydown={onKey} />

<div class="scrim" on:click={onClose} aria-hidden="true"></div>

<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="log-title">
  <header>
    <h3 id="log-title" class="title">Extraction log</h3>
    <p class="subtitle">{title}</p>
  </header>

  <div class="body">
    {#if loading}
      <div class="state">Loading log…</div>
    {:else if !log}
      <div class="state muted">No log available.</div>
    {:else}
      <pre>{log}</pre>
    {/if}
  </div>

  <footer>
    <button class="btn" on:click={onCopy} disabled={!log}>Copy</button>
    <button class="btn primary" on:click={onClose}>Close</button>
  </footer>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--bg-overlay, rgba(0,0,0,0.4));
    z-index: 70;
  }
  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(92vw, 840px);
    max-height: min(80vh, 720px);
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    border-radius: var(--md-sys-radius-medium);
    box-shadow: var(--md-sys-shadow-1);
    z-index: 80;
    display: flex;
    flex-direction: column;
  }
  header {
    padding: 20px 24px 12px;
    border-bottom: 1px solid var(--md-sys-color-surface-variant);
  }
  .title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }
  .subtitle {
    margin: 2px 0 0;
    font-size: 0.85rem;
    color: var(--md-sys-color-on-surface-variant);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .body {
    flex: 1 1 auto;
    overflow: auto;
    padding: 12px 24px;
    min-height: 0;
  }
  .state {
    padding: 24px;
    text-align: center;
    color: var(--md-sys-color-on-surface-variant);
  }
  .state.muted {
    color: var(--text-muted);
  }
  pre {
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78rem;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--md-sys-color-on-surface);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 24px 16px;
    border-top: 1px solid var(--md-sys-color-surface-variant);
  }
  .btn {
    padding: 8px 18px;
    border: none;
    background: transparent;
    color: var(--md-sys-color-primary);
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
  .btn.primary:hover {
    filter: brightness(1.05);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
