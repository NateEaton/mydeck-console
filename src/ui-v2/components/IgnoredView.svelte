<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import BookmarkRow from './BookmarkRow.svelte';
  import { MdiArrowLeft } from '../icons/index.js';
  import { getIgnoredIds, getBookmark, unignoreBookmark, unignoreAll } from '../../lib/cache';
  import { compareBookmarks, DEFAULT_SORT } from '../../lib/sort.js';

  export let client;
  export let sortOption = DEFAULT_SORT;

  const dispatch = createEventDispatcher();

  let bookmarks = [];
  let loading = true;

  async function load() {
    loading = true;
    try {
      const ids = await getIgnoredIds();
      if (ids.size === 0) {
        bookmarks = [];
        return;
      }

      const cached = [];
      const missing = [];

      for (const id of ids) {
        const hit = await getBookmark(id);
        if (hit) {
          cached.push(hit);
        } else {
          missing.push(id);
        }
      }

      let fetched = [];
      if (missing.length > 0) {
        fetched = await client.getBookmarksByIds(missing);
      }

      const fetchedIds = new Set(fetched.map(b => b.id));
      const tombstones = missing.filter(id => !fetchedIds.has(id));
      for (const id of tombstones) {
        await unignoreBookmark(id);
      }

      bookmarks = [...cached, ...fetched];
    } finally {
      loading = false;
    }
  }

  $: sortedBookmarks = [...bookmarks].sort((a, b) => compareBookmarks(a, b, sortOption));

  async function onUnignore(id) {
    await unignoreBookmark(id);
    bookmarks = bookmarks.filter(b => b.id !== id);
    dispatch('unignored', { id });
  }

  async function onClearAll() {
    if (!confirm('Un-ignore all bookmarks? They will reappear in the triage queue.')) return;
    await unignoreAll();
    bookmarks = [];
    dispatch('unignored-all');
  }

  onMount(load);
</script>

<div class="list-wrap">
  {#if loading}
    <div class="state-row">
      <span class="spinner"></span>
      <span>Loading…</span>
    </div>
  {:else if bookmarks.length === 0}
    <div class="empty">No ignored bookmarks.</div>
  {:else}
    <div class="actions-row">
      <button class="btn danger" on:click={onClearAll}>Clear all</button>
    </div>
    <div class="list">
      {#each sortedBookmarks as b (b.id)}
        <BookmarkRow bookmark={b} highlightedLabels={[]}>
          <button class="unignore-btn" on:click={() => onUnignore(b.id)} title="Un-ignore" aria-label="Un-ignore bookmark">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d={MdiArrowLeft} fill="currentColor" />
            </svg>
            Un-ignore
          </button>
        </BookmarkRow>
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

  .actions-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  .btn {
    padding: 6px 14px;
    border: 1px solid var(--md-sys-color-outline);
    background: transparent;
    color: var(--md-sys-color-on-surface);
    border-radius: 999px;
    font-size: 0.85rem;
    font: inherit;
    cursor: pointer;
  }

  .btn:hover { background: var(--bg-hover); }

  .btn.danger {
    color: var(--error-fg);
    border-color: var(--error-fg);
  }

  .unignore-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--md-sys-color-outline);
    background: transparent;
    color: var(--md-sys-color-on-surface);
    border-radius: 999px;
    font-size: 0.82rem;
    font: inherit;
    cursor: pointer;
  }

  .unignore-btn:hover { background: var(--bg-hover); }
</style>
