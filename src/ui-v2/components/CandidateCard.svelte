<script>
  import { createEventDispatcher } from 'svelte';
  import { MdiOpenInNew } from '../icons/index.js';

  export let candidate;

  const dispatch = createEventDispatcher();

  function formatTs(ts) {
    if (!ts || typeof ts !== 'string') return '';
    return `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url || ''; }
  }

  function onExternal(event) {
    event.stopPropagation();
    if (!candidate.url) return;
    window.open(candidate.url, '_blank', 'noopener,noreferrer');
  }

  function onTap() {
    dispatch('select', { candidate });
  }

  $: sourceLabel = candidate.source === 'archive' ? 'Archive.org' : 'Brave Search';
  $: subtitle = candidate.source === 'archive'
    ? `Snapshot: ${formatTs(candidate.timestamp)}`
    : hostOf(candidate.url);
</script>

<article
  class="c-card"
  on:click={onTap}
  role="button"
  tabindex="0"
  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && onTap()}
>
  <div class="body">
    <div class="source-row">
      <span class="source-pill {candidate.source}">{sourceLabel}</span>
      <span class="subtitle">{subtitle}</span>
    </div>

    {#if candidate.source === 'brave'}
      <h4 class="title">{candidate.title || '(no title)'}</h4>
      {#if candidate.description}
        <p class="snippet">{candidate.description}</p>
      {/if}
    {/if}

    <div class="score-row">
      <span class="pill {candidate.tier}" title={candidate.reason}>
        {candidate.score}% · {candidate.reason}
      </span>
    </div>
  </div>

  <button class="icon-btn" on:click={onExternal} title="Open in new tab" aria-label="Open in new tab">
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={MdiOpenInNew} fill="currentColor" />
    </svg>
  </button>
</article>

<style>
  .c-card {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 14px;
    background: var(--bg-card);
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: var(--md-sys-radius-medium);
    cursor: pointer;
    transition: background-color 0.15s ease;
    min-width: 0;
    box-sizing: border-box;
  }
  .c-card:hover { background: var(--bg-hover); }
  .body {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .source-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .source-pill {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 8px;
    border-radius: 100px;
  }
  .source-pill.archive {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }
  .source-pill.brave {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }
  .subtitle {
    font-size: 0.78rem;
    color: var(--md-sys-color-on-surface-variant);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .title {
    margin: 2px 0 0;
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--md-sys-color-on-surface);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .snippet {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .score-row {
    margin-top: 2px;
  }
  .pill {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 100px;
    font-size: 0.72rem;
    font-weight: 500;
  }
  .pill.high   { background: #c8e6c9; color: #1b5e20; }
  .pill.medium { background: #fff9c4; color: #8d6e00; }
  .pill.low    { background: #ffcdd2; color: #b71c1c; }
  @media (prefers-color-scheme: dark) {
    .pill.high   { background: #2e5a2e; color: #c8e6c9; }
    .pill.medium { background: #4d4211; color: #fff9c4; }
    .pill.low    { background: #5a1f1f; color: #ffcdd2; }
  }

  .icon-btn {
    flex-shrink: 0;
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
</style>
