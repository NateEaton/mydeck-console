<script>
  import {
    MdiDownload,
    MdiCalendar,
    MdiHeart,
    MdiHeartOutline,
    MdiArchive,
    MdiArchiveOutline,
  } from '../icons/index.js';

  export let bookmark;
  export let highlightedLabels = [];

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
  $: isFav = !!bookmark.is_marked;
  $: isArchived = !!bookmark.is_archived;
  $: pills = highlightedLabels.filter(l => (bookmark.labels || []).includes(l));
</script>

<article class="row">
  <h3 class="title">{bookmark.title || 'Untitled'}</h3>
  <div class="site">{site}</div>
  <div class="url">{bookmark.url}</div>

  <div class="meta">
    {#if created}
      <span class="date-pair" title="Saved {created}">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d={MdiDownload} fill="currentColor" />
        </svg>
        {created}
      </span>
    {/if}
    {#if published}
      <span class="date-pair" title="Published {published}">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d={MdiCalendar} fill="currentColor" />
        </svg>
        {published}
      </span>
    {/if}

    <span class="state-chip" class:active={isFav} title={isFav ? 'Favorited' : 'Not favorited'} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path d={isFav ? MdiHeart : MdiHeartOutline} fill="currentColor" />
      </svg>
    </span>
    <span class="state-chip" class:active={isArchived} title={isArchived ? 'Archived' : 'Not archived'} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path d={isArchived ? MdiArchive : MdiArchiveOutline} fill="currentColor" />
      </svg>
    </span>
  </div>

  {#if pills.length > 0}
    <div class="labels">
      {#each pills as label}
        <span class="label-pill">{label}</span>
      {/each}
    </div>
  {/if}

  {#if $$slots.default}
    <div class="trailing">
      <slot />
    </div>
  {/if}
</article>

<style>
  .row {
    background: var(--bg-card);
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: var(--md-sys-radius-medium);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    box-sizing: border-box;
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
  }

  .url {
    font-size: 0.75rem;
    color: var(--md-sys-color-on-surface-variant);
    word-break: break-all;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    font-size: 0.76rem;
    color: var(--md-sys-color-on-surface-variant);
    margin-top: 2px;
  }

  .date-pair {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .state-chip {
    display: inline-flex;
    align-items: center;
    opacity: 0.38;
  }
  .state-chip.active {
    opacity: 1;
    color: var(--md-sys-color-primary);
  }

  .labels {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 2px;
  }

  .label-pill {
    padding: 2px 10px;
    border-radius: 100px;
    font-size: 0.72rem;
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }

  .trailing {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }
</style>
