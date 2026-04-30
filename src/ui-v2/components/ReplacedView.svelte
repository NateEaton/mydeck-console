<script>
  import { onMount } from 'svelte';
  import BookmarkRow from './BookmarkRow.svelte';
  import { MdiAlert } from '../icons/index.js';
  import {
    DEPRECATION_LABEL_ARCHIVE,
    DEPRECATION_LABEL_SEARCH,
    DEPRECATION_LABEL_MANUAL,
  } from '../../lib/config';
  import { compareBookmarks, DEFAULT_SORT } from '../../lib/sort.js';
  import { matchesFilter, collectLabels } from '../../lib/filter.js';

  export let client;
  export let sortOption = DEFAULT_SORT;
  export let filterState = null;
  export let filteredCount = 0;
  export let availableLabels = new Map();

  const REPLACED_LABELS = [DEPRECATION_LABEL_ARCHIVE, DEPRECATION_LABEL_SEARCH, DEPRECATION_LABEL_MANUAL];

  let bookmarks = [];
  let loading = true;
  let error = null;

  async function load() {
    loading = true;
    error = null;
    try {
      bookmarks = await client.getBookmarksByLabels(REPLACED_LABELS, { is_archived: true });
    } catch (e) {
      error = e.message || 'Failed to load replaced bookmarks.';
    } finally {
      loading = false;
    }
  }

  $: sortedBookmarks = [...bookmarks]
    .sort((a, b) => compareBookmarks(a, b, sortOption))
    .filter(b => matchesFilter(b, filterState));
  $: filteredCount = sortedBookmarks.length;
  $: availableLabels = collectLabels(bookmarks);

  onMount(load);
</script>

<div class="list-wrap">
  {#if loading}
    <div class="state-row">
      <span class="spinner"></span>
      <span>Loading…</span>
    </div>
  {:else if error}
    <div class="notice-state">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d={MdiAlert} fill="currentColor" />
      </svg>
      <div class="notice-body">
        <strong>Could not load replaced bookmarks</strong>
        <p>{error}</p>
        <button class="btn" on:click={load}>Retry</button>
      </div>
    </div>
  {:else if bookmarks.length === 0}
    <div class="empty">No replaced bookmarks yet.</div>
  {:else}
    <div class="list">
      {#each sortedBookmarks as b (b.id)}
        <BookmarkRow bookmark={b} highlightedLabels={REPLACED_LABELS} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .list-wrap {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: 16px;
    box-sizing: border-box;
    min-width: 0;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .empty {
    padding: 48px 16px;
    text-align: center;
    color: var(--md-sys-color-on-surface-variant);
  }

  .state-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 48px 16px;
    justify-content: center;
    color: var(--md-sys-color-on-surface-variant);
  }

  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--md-sys-color-surface-variant);
    border-top-color: var(--md-sys-color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
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
