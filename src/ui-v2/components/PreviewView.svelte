<script>
  import { createEventDispatcher } from 'svelte';

  export let candidate;

  const dispatch = createEventDispatcher();

  let loading = true;

  function onLoad() {
    loading = false;
  }

  $: previewUrl = candidate?.url ?? '';
</script>

<div class="preview-container">
  <div class="warning">
    Previewing: <code>{previewUrl}</code>
    · Some sites block iframe embedding; use Open ↗ if blank.
  </div>
  <div class="frame-wrap">
    {#if loading}
      <div class="loading">
        <span class="spinner"></span>
        <span>Loading preview…</span>
      </div>
    {/if}
    {#key previewUrl}
      <iframe
        src={previewUrl}
        title="Preview"
        on:load={onLoad}
      ></iframe>
    {/key}
  </div>
</div>

<style>
  .preview-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--md-sys-color-surface);
  }
  .warning {
    padding: 8px 14px;
    background: var(--bg-preview-warning, var(--md-sys-color-surface-variant));
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.8rem;
    border-bottom: 1px solid var(--md-sys-color-surface-variant);
  }
  .warning code {
    padding: 1px 4px;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    border-radius: 3px;
    font-size: 0.9em;
    word-break: break-all;
  }
  .frame-wrap {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
  }
  iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
    background: #fff;
  }
  .loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface-variant);
    z-index: 1;
  }
  .spinner {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 3px solid var(--md-sys-color-surface-variant);
    border-top-color: var(--md-sys-color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
