<script>
  import { createEventDispatcher } from 'svelte';

  /** @type {string} */ export let bookmarkTitle = '';
  /** @type {string} */ export let newUrl = '';
  /** @type {boolean} */ export let originalIsArchived = false;
  /** Default disposition from Settings; user can override here for this bookmark only. */
  /** @type {'archive' | 'delete'} */ export let defaultDisposition = 'archive';

  const dispatch = createEventDispatcher();

  let disposition = defaultDisposition;

  function onCancel() {
    dispatch('cancel');
  }

  function onApply() {
    dispatch('apply', { disposition });
  }

  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
    else if (event.key === 'Enter') { event.preventDefault(); onApply(); }
  }
</script>

<svelte:window on:keydown={onKey} />

<div class="scrim" on:click={onCancel} aria-hidden="true"></div>

<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="apply-title">
  <h3 id="apply-title" class="title">Apply replacement</h3>

  {#if bookmarkTitle}
    <p class="desc">
      Replace <strong>{bookmarkTitle}</strong>
    </p>
  {/if}
  <div class="url-line">
    <span class="url-label">New URL</span>
    <span class="url-value">{newUrl}</span>
  </div>

  <fieldset class="group">
    <legend>What happens to the original</legend>
    <label class="opt">
      <input
        type="radio"
        name="disposition"
        value="archive"
        bind:group={disposition}
      />
      <span class="opt-label">
        <strong>Archive</strong>
        <span class="opt-sub">
          {#if originalIsArchived}
            Already archived — Apply will only add the replaced-* label.
          {:else}
            Mark archived and add the replaced-* label.
          {/if}
        </span>
      </span>
    </label>
    <label class="opt">
      <input
        type="radio"
        name="disposition"
        value="delete"
        bind:group={disposition}
      />
      <span class="opt-label">
        <strong>Delete</strong>
        <span class="opt-sub">Remove the original bookmark entirely.</span>
      </span>
    </label>
  </fieldset>

  {#if disposition !== defaultDisposition}
    <p class="override-note">
      Default is <em>{defaultDisposition}</em>; this is a one-time override.
    </p>
  {/if}

  <div class="actions">
    <button class="btn" on:click={onCancel}>Cancel</button>
    <button class="btn primary" on:click={onApply}>Apply</button>
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
    width: min(92vw, 520px);
    max-height: 90vh;
    overflow-y: auto;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    padding: 24px;
    border-radius: var(--md-sys-radius-medium);
    box-shadow: var(--md-sys-shadow-1);
    z-index: 80;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
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
    word-break: break-word;
  }
  .desc strong {
    color: var(--md-sys-color-on-surface);
  }
  .url-line {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    background: var(--bg-list-panel);
    border-radius: 8px;
    border: 1px solid var(--md-sys-color-surface-variant);
  }
  .url-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    color: var(--md-sys-color-on-surface-variant);
  }
  .url-value {
    font-size: 0.85rem;
    color: var(--md-sys-color-on-surface);
    word-break: break-all;
  }
  .group {
    border: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .group legend {
    padding: 0;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
    margin-bottom: 4px;
  }
  .opt {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 4px;
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
  .override-note {
    margin: 0;
    padding: 8px 12px;
    background: var(--bg-preview-warning, var(--md-sys-color-surface-variant));
    color: var(--md-sys-color-on-surface-variant);
    border-radius: 8px;
    font-size: 0.8rem;
  }
  .override-note em {
    font-style: normal;
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
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
    font: inherit;
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
  .btn.primary:hover { filter: brightness(1.05); }
</style>
