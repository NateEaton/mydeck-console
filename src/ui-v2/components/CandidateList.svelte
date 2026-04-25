<script>
  import { createEventDispatcher } from 'svelte';
  import CandidateCard from './CandidateCard.svelte';
  import { MdiAlert } from '../icons/index.js';

  export let closest = [];
  export let interleaved = [];
  export let archiveLoading = false;
  export let braveLoading = false;
  export let archiveError = null;  // { rateLimited, message } | null
  export let braveSuppressed = false;  // e.g. no Brave key configured

  const dispatch = createEventDispatcher();

  function onSelect(event) {
    dispatch('select', event.detail);
  }

  function retryArchive() {
    dispatch('retry-archive');
  }

  $: allDone = !archiveLoading && !braveLoading;
  $: empty = allDone && closest.length === 0 && interleaved.length === 0 && !archiveError;
</script>

<div class="candidate-list">
  {#if empty}
    <div class="empty">No candidates found.</div>
  {:else}
    {#if closest.length > 0}
      <h3 class="section-head">Closest to save date</h3>
      {#each closest as c (c.url)}
        <CandidateCard candidate={c} on:select={onSelect} />
      {/each}
    {/if}

    {#if interleaved.length > 0 || archiveLoading || braveLoading || archiveError}
      <h3 class="section-head">Results</h3>

      {#if archiveError}
        <div class="notice-state" class:transient={archiveError.rateLimited}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d={MdiAlert} fill="currentColor" />
          </svg>
          <div class="notice-body">
            <strong>
              {archiveError.rateLimited ? 'Archive.org rate limit reached' : 'Archive.org request failed'}
            </strong>
            <p>{archiveError.message}</p>
            <button class="btn" on:click={retryArchive}>Retry</button>
          </div>
        </div>
      {:else if archiveLoading}
        <div class="skeleton">
          <span class="spinner"></span>
          <span>Searching Archive.org…</span>
        </div>
      {/if}

      {#if braveLoading && !braveSuppressed}
        <div class="skeleton">
          <span class="spinner"></span>
          <span>Searching Brave…</span>
        </div>
      {/if}

      {#each interleaved as c (c.source + '|' + (c.url || c.timestamp))}
        <CandidateCard candidate={c} on:select={onSelect} />
      {/each}
    {/if}
  {/if}
</div>

<style>
  .candidate-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    width: 100%;
    box-sizing: border-box;
    min-width: 0;
  }
  .section-head {
    margin: 8px 0 0;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    color: var(--md-sys-color-on-surface-variant);
  }
  .empty {
    padding: 32px;
    text-align: center;
    color: var(--md-sys-color-on-surface-variant);
  }
  .skeleton {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 1px dashed var(--md-sys-color-surface-variant);
    border-radius: var(--md-sys-radius-medium);
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.9rem;
  }
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--md-sys-color-surface-variant);
    border-top-color: var(--md-sys-color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .notice-state {
    display: flex;
    gap: 10px;
    padding: 12px 14px;
    background: var(--md-sys-color-surface-variant);
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--md-sys-radius-medium);
    color: var(--md-sys-color-on-surface-variant);
  }
  .notice-state svg { flex-shrink: 0; margin-top: 2px; }
  .notice-body { flex: 1 1 auto; }
  .notice-body strong {
    display: block;
    margin-bottom: 2px;
    font-size: 0.9rem;
    color: var(--md-sys-color-on-surface);
  }
  .notice-body p {
    margin: 0 0 8px;
    font-size: 0.82rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .btn {
    padding: 6px 14px;
    border: 1px solid var(--md-sys-color-outline);
    background: transparent;
    color: var(--md-sys-color-on-surface);
    border-radius: 999px;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .btn:hover { background: var(--bg-hover); }
</style>
