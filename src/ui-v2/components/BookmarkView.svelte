<script>
  import { createEventDispatcher } from 'svelte';
  import CandidateList from './CandidateList.svelte';
  import {
    MdiHeartOutline, MdiHeart,
    MdiArchiveOutline, MdiArchive,
    MdiDownload, MdiCalendar,
    MdiAlertCircle,
  } from '../icons/index.js';

  export let bookmark;
  export let closest = [];
  export let interleaved = [];
  export let archiveLoading = false;
  export let braveLoading = false;
  export let archiveError = null;
  export let braveSuppressed = false;
  export let errorClass = null;  // ClassifiedError | null

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

  $: site = bookmark?.site_name || hostOf(bookmark?.url);
  $: created = formatDate(bookmark?.created);
  $: published = formatDate(bookmark?.published);
  $: isFav = !!bookmark?.is_marked;
  $: isArchived = !!bookmark?.is_archived;
  $: errSummary = errorClass?.summary || '';
  $: errDetail = errorClass?.detail || '';
  $: isExtractFailLive = errorClass?.kind === 'extract-failed' && errorClass?.liveUrl;
</script>

<div class="view">
  <div class="bm-header">
    <h2 class="title">{bookmark?.title || 'Untitled'}</h2>
    <div class="site">{site}</div>
    <a class="url" href={bookmark?.url} target="_blank" rel="noreferrer noopener">
      {bookmark?.url}
    </a>

    <div class="meta-row">
      {#if created}
        <span class="meta-chip" title="Saved {created}">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d={MdiDownload} fill="currentColor" /></svg>
          {created}
        </span>
      {/if}
      {#if published}
        <span class="meta-chip" title="Published {published}">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d={MdiCalendar} fill="currentColor" /></svg>
          {published}
        </span>
      {/if}
      <span class="state-chip" class:fav={isFav}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d={isFav ? MdiHeart : MdiHeartOutline} fill="currentColor" />
        </svg>
        {isFav ? 'Favorited' : 'Not favorited'}
      </span>
      <span class="state-chip" class:archived={isArchived}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d={isArchived ? MdiArchive : MdiArchiveOutline} fill="currentColor" />
        </svg>
        {isArchived ? 'Archived' : 'Not archived'}
      </span>
    </div>

    {#if errorClass}
      <div class="error-block" class:live={isExtractFailLive}>
        <div class="error-line">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d={MdiAlertCircle} fill="currentColor" />
          </svg>
          <span>{errSummary}</span>
        </div>
        {#if errDetail}
          <p class="error-detail">{errDetail}</p>
        {/if}
      </div>
    {/if}

    {#if isArchived}
      <div class="note">
        Original is already archived — Apply will add the <code>replaced-*</code> label only.
      </div>
    {/if}
  </div>

  <div class="divider" role="separator"></div>

  <CandidateList
    {closest}
    {interleaved}
    {archiveLoading}
    {braveLoading}
    {archiveError}
    {braveSuppressed}
    on:select={(e) => dispatch('select-candidate', e.detail)}
    on:retry-archive={() => dispatch('retry-archive')}
  />
</div>

<style>
  .view {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  .bm-header {
    padding: 20px 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--md-sys-color-surface);
  }
  .title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--md-sys-color-on-surface);
  }
  .site {
    font-size: 0.88rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .url {
    font-size: 0.8rem;
    color: var(--text-muted);
    word-break: break-all;
    text-decoration: none;
  }
  .url:hover { text-decoration: underline; }
  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
  .meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .state-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 100px;
    background: var(--md-sys-color-surface-variant);
    color: var(--md-sys-color-on-surface-variant);
  }
  .state-chip.fav, .state-chip.archived {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }
  .error-block {
    margin-top: 8px;
    margin-bottom: 4px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .error-block.live {
    padding: 10px 12px;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 8px;
    background: var(--md-sys-color-surface-variant);
  }
  .error-line {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--error-fg);
    font-size: 0.88rem;
    font-weight: 500;
  }
  .error-detail {
    margin: 0;
    font-size: 0.82rem;
    color: var(--md-sys-color-on-surface-variant);
    line-height: 1.4;
  }
  .note {
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--bg-preview-warning, var(--md-sys-color-surface-variant));
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.85rem;
  }
  .note code {
    padding: 1px 4px;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    border-radius: 3px;
    font-size: 0.82em;
  }
  .divider {
    height: 1px;
    background: var(--md-sys-color-surface-variant);
    margin: 4px 0 0;
  }
</style>
