<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let url = '';
  let inputEl;

  export function focus() {
    if (inputEl) inputEl.focus();
  }

  function onCancel() {
    dispatch('cancel');
  }

  function onApply() {
    const v = url.trim();
    if (!v) return;
    dispatch('apply', { url: v });
  }

  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
    else if (event.key === 'Enter') { event.preventDefault(); onApply(); }
  }
</script>

<svelte:window on:keydown={onKey} />

<div class="scrim" on:click={onCancel} aria-hidden="true"></div>

<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="manual-url-title">
  <h3 id="manual-url-title" class="title">Manual URL</h3>
  <p class="desc">Paste any URL to use as the replacement for this bookmark.</p>
  <input
    type="url"
    bind:value={url}
    bind:this={inputEl}
    placeholder="https://…"
    autofocus
  />
  <div class="actions">
    <button class="btn" on:click={onCancel}>Cancel</button>
    <button class="btn primary" disabled={!url.trim()} on:click={onApply}>Apply</button>
  </div>
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
    width: min(90vw, 480px);
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    padding: 24px;
    border-radius: var(--md-sys-radius-medium);
    box-shadow: var(--md-sys-shadow-1);
    z-index: 80;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }
  .desc {
    margin: 0;
    font-size: 0.88rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  input {
    padding: 10px 12px;
    font-size: 0.95rem;
    border: 1px solid var(--md-sys-color-outline);
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    border-radius: 8px;
    outline: none;
  }
  input:focus {
    border-color: var(--md-sys-color-primary);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
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
