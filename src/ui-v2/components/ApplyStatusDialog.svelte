<script>
  import { createEventDispatcher } from 'svelte';
  import {
    MdiAlertCircle,
    MdiCheckCircle,
    MdiOpenInNew,
  } from '../icons/index.js';

  export let status = 'working';
  export let title = '';
  export let message = '';
  export let detail = '';
  export let replacement = null;
  export let log = '';

  const dispatch = createEventDispatcher();

  function formatNumber(value) {
    if (!Number.isFinite(Number(value))) return '';
    return Number(value).toLocaleString();
  }

  $: isWorking = status === 'working';
  $: isSuccess = status === 'success';
  $: isError = status === 'error';
  $: displayTitle = title || (isSuccess ? 'Replacement verified' : isError ? 'Repair failed' : 'Applying replacement');
  $: site = replacement?.site_name || replacement?.site || '';
  $: wordCount = formatNumber(replacement?.word_count);
  $: readingTime = Number.isFinite(Number(replacement?.reading_time)) ? Number(replacement.reading_time) : null;
  $: hasMeta = !!(replacement?.title || site || wordCount || readingTime);
</script>

<div class="scrim" aria-hidden="true"></div>

<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="apply-status-title">
  <div class="heading">
    <div class="status-icon" class:success={isSuccess} class:error={isError} class:working={isWorking}>
      {#if isWorking}
        <span class="spinner"></span>
      {:else}
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d={isSuccess ? MdiCheckCircle : MdiAlertCircle} fill="currentColor" />
        </svg>
      {/if}
    </div>
    <div>
      <h3 id="apply-status-title" class="title">{displayTitle}</h3>
      {#if message}
        <p class="message">{message}</p>
      {/if}
    </div>
  </div>

  {#if detail}
    <p class="detail">{detail}</p>
  {/if}

  {#if hasMeta}
    <div class="summary">
      {#if replacement?.title}
        <div>
          <span>Title</span>
          <strong>{replacement.title}</strong>
        </div>
      {/if}
      {#if site}
        <div>
          <span>Site</span>
          <strong>{site}</strong>
        </div>
      {/if}
      {#if wordCount}
        <div>
          <span>Words</span>
          <strong>{wordCount}</strong>
        </div>
      {/if}
      {#if readingTime !== null}
        <div>
          <span>Read</span>
          <strong>{readingTime} min</strong>
        </div>
      {/if}
    </div>
  {/if}

  {#if replacement?.url}
    <div class="url-line">
      <span class="url-label">Replacement URL</span>
      <span class="url-value">{replacement.url}</span>
    </div>
  {/if}

  {#if isError && log}
    <details class="log">
      <summary>Server extraction log</summary>
      <pre>{log}</pre>
    </details>
  {/if}

  <div class="actions">
    {#if replacement?.url}
      <button class="btn" on:click={() => dispatch('open-url')}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d={MdiOpenInNew} fill="currentColor" />
        </svg>
        <span>Open URL</span>
      </button>
    {/if}
    {#if isSuccess}
      <button class="btn" on:click={() => dispatch('review-recovered')}>Recovered</button>
      <button class="btn primary" on:click={() => dispatch('close')}>Done</button>
    {:else if isError}
      <button class="btn primary" on:click={() => dispatch('close')}>Keep original</button>
    {/if}
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
    width: min(92vw, 560px);
    max-height: 90vh;
    overflow-y: auto;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    padding: 22px;
    border-radius: var(--md-sys-radius-medium);
    box-shadow: var(--md-sys-shadow-1);
    z-index: 80;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-sizing: border-box;
  }

  .heading {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 12px;
    align-items: flex-start;
  }

  .status-icon {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--md-sys-color-surface-variant);
    color: var(--md-sys-color-on-surface-variant);
  }

  .status-icon.success {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-primary);
  }

  .status-icon.error {
    color: var(--md-sys-color-error);
  }

  .title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .message,
  .detail {
    margin: 3px 0 0;
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.88rem;
    line-height: 1.4;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .summary div,
  .url-line {
    padding: 10px 12px;
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: 8px;
    background: var(--bg-list-panel);
    min-width: 0;
  }

  .summary span,
  .url-label {
    display: block;
    margin-bottom: 2px;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0;
    color: var(--md-sys-color-on-surface-variant);
  }

  .summary strong {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
    overflow-wrap: anywhere;
  }

  .url-value {
    display: block;
    font-size: 0.82rem;
    color: var(--md-sys-color-on-surface);
    word-break: break-all;
  }

  .log {
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: 8px;
    padding: 10px 12px;
    background: var(--bg-list-panel);
  }

  .log summary {
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .log pre {
    max-height: 220px;
    overflow: auto;
    margin: 10px 0 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.74rem;
    color: var(--md-sys-color-on-surface-variant);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
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

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--md-sys-color-surface-variant);
    border-top-color: var(--md-sys-color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @media (max-width: 520px) {
    .summary {
      grid-template-columns: 1fr;
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
