<script>
  import { createEventDispatcher } from 'svelte';
  import {
    MdiHeartOutline,
    MdiHeart,
    MdiArchiveOutline,
    MdiArchive,
    MdiOpenInNew,
    MdiDelete,
    MdiCalendar,
    MdiDownload,
  } from '../icons/index.js';

  export let bookmark;
  export let pendingDelete = false;

  const dispatch = createEventDispatcher();

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url || ''; }
  }

  $: site = bookmark.site_name || hostOf(bookmark.url);
  $: created = formatDate(bookmark.created);
  $: published = formatDate(bookmark.published);
  $: visibleLabels = (bookmark.labels || []).slice(0, 3);
  $: overflowLabels = Math.max(0, (bookmark.labels?.length || 0) - 3);
  $: isFav = !!bookmark.is_marked;
  $: isArchived = !!bookmark.is_archived;

  function onDelete(event) {
    event.stopPropagation();
    dispatch('delete', { bookmarkId: bookmark.id, title: bookmark.title || bookmark.url });
  }

  function onExternal(event) {
    event.stopPropagation();
    if (!bookmark.url) return;
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  }

  function onCard() {
    dispatch('select', { bookmark });
  }
</script>

<article
  class="card"
  class:pending={pendingDelete}
  on:click={onCard}
  role="button"
  tabindex="0"
>
  <h3 class="title">{bookmark.title || 'Untitled'}</h3>
  <div class="site">{site}</div>

  <div class="dates">
    {#if created}
      <span class="date-pair" title="Saved {created}">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d={MdiDownload} fill="currentColor" />
        </svg>
        {created}
      </span>
    {/if}
    {#if published}
      <span class="date-pair" title="Published {published}">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d={MdiCalendar} fill="currentColor" />
        </svg>
        {published}
      </span>
    {/if}
  </div>

  {#if visibleLabels.length}
    <div class="labels">
      {#each visibleLabels as label}
        <span class="meta-label">{label}</span>
      {/each}
      {#if overflowLabels > 0}
        <span class="meta-label">+{overflowLabels}</span>
      {/if}
    </div>
  {/if}

  <div class="actions">
    <span
      class="icon-slot dimmed"
      class:filled={isFav}
      title={isFav ? 'Favorited' : 'Not favorited'}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d={isFav ? MdiHeart : MdiHeartOutline} fill="currentColor" />
      </svg>
    </span>

    <span
      class="icon-slot dimmed"
      class:filled={isArchived}
      title={isArchived ? 'Archived' : 'Not archived'}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d={isArchived ? MdiArchive : MdiArchiveOutline} fill="currentColor" />
      </svg>
    </span>

    <span class="spacer"></span>

    <button class="icon-btn" on:click={onExternal} title="Open in new tab" aria-label="Open in new tab">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d={MdiOpenInNew} fill="currentColor" />
      </svg>
    </button>

    <button class="icon-btn danger" on:click={onDelete} title="Delete" aria-label="Delete bookmark">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d={MdiDelete} fill="currentColor" />
      </svg>
    </button>
  </div>
</article>

<style>
  .card {
    background: var(--bg-card);
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: var(--md-sys-radius-medium);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    transition: background-color 0.15s ease, opacity 0.15s ease;
    min-width: 0;
    box-sizing: border-box;
  }
  .card:hover { background: var(--bg-hover); }
  .card.pending {
    opacity: 0.5;
    pointer-events: none;
  }

  .title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--md-sys-color-on-surface);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .site {
    font-size: 0.78rem;
    color: var(--text-muted);
    word-break: break-all;
  }

  .dates {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 0.78rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .date-pair {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .labels {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 2px;
  }
  .meta-label {
    padding: 2px 10px;
    border-radius: 100px;
    font-size: 0.72rem;
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
  }
  .spacer { flex-grow: 1; }

  .icon-slot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    color: var(--md-sys-color-on-surface);
  }
  .icon-slot.dimmed {
    opacity: 0.45;
    cursor: default;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    color: var(--md-sys-color-on-surface);
    border-radius: 999px;
    cursor: pointer;
  }
  .icon-btn:hover { background: var(--bg-hover); }
  .icon-btn.danger:hover { color: var(--error-fg); }
</style>
