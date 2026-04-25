<script>
  import '../styles/theme.css';
  import { onMount, onDestroy, tick, afterUpdate } from 'svelte';
  import { ReadeckClient } from '../lib/api/readeck';
  import { ArchiveClient, ArchiveRateLimitError } from '../lib/api/archive';
  import { BraveClient } from '../lib/api/brave';
  import {
    scoreBraveCandidate,
    scoreArchiveSnapshots,
    mergeCandidates,
  } from '../lib/scoring';
  import { classifyExtractionLog, classifyBookmarkState } from '../lib/readeckErrors';
  import * as cache from '../lib/cache';
  import { getIgnoredIds, ignoreBookmark } from '../lib/cache';
  import {
    CACHE_STALE_MS,
    RECOVERY_LABEL_ARCHIVE,
    RECOVERY_LABEL_SEARCH,
    RECOVERY_LABEL_MANUAL,
    DEPRECATION_LABEL_ARCHIVE,
    DEPRECATION_LABEL_SEARCH,
    DEPRECATION_LABEL_MANUAL,
  } from '../lib/config';

  import TopAppBar from './components/TopAppBar.svelte';
  import NavDrawer from './components/NavDrawer.svelte';
  import TriageList from './components/TriageList.svelte';
  import BookmarkView from './components/BookmarkView.svelte';
  import PreviewView from './components/PreviewView.svelte';
  import DeleteSnackbar from './components/DeleteSnackbar.svelte';
  import ManualUrlDialog from './components/ManualUrlDialog.svelte';
  import LogViewerDialog from './components/LogViewerDialog.svelte';

  import {
    MdiDotsVertical,
    MdiCheck,
    MdiOpenInNew,
    MdiDelete,
    MdiWeb,
    MdiEyeOff,
  } from './icons/index.js';

  const WIDE_MIN = 768;

  const LABELS_BY_SOURCE = {
    archive: { recovery: RECOVERY_LABEL_ARCHIVE, deprecation: DEPRECATION_LABEL_ARCHIVE },
    brave:   { recovery: RECOVERY_LABEL_SEARCH,  deprecation: DEPRECATION_LABEL_SEARCH  },
    manual:  { recovery: RECOVERY_LABEL_MANUAL,  deprecation: DEPRECATION_LABEL_MANUAL  },
  };

  const VIEW_TITLES = {
    triage:    'Triage',
    recovered: 'Recovered',
    replaced:  'Replaced',
    ignored:   'Ignored',
    settings:  'Settings',
    guide:     'User Guide',
    about:     'About',
  };

  let apiToken = localStorage.getItem('readeck_token') || '';
  let serverUrl = localStorage.getItem('readeck_url') || '';
  let client = new ReadeckClient(serverUrl, apiToken);
  const archiveClient = new ArchiveClient();
  const braveClient = new BraveClient();

  let bookmarks = [];
  let loading = false;
  let activeView = 'triage';
  let ignoredIds = new Set();

  let isWide = typeof window !== 'undefined' ? window.innerWidth >= WIDE_MIN : true;
  let drawerOpen = false;

  let selectedBookmark = null;
  let selectedCandidate = null;
  let loadToken = 0;
  let archiveScored = [];
  let braveScored = [];
  let archiveLoading = false;
  let braveLoading = false;
  let archiveError = null;
  let braveSuppressed = false;

  let showOverflowMenu = false;
  let showManualDialog = false;
  let showLogDialog = false;

  let logText = '';
  let logLoading = false;
  let logFetchedForId = null;

  let pendingDelete = null;
  let lastCommittedAt = 0;
  let outsideHandler = null;

  let contentEl;
  let triageScrollY = 0;
  let prevRouteMode = 'drawer';

  $: merged = mergeCandidates(archiveScored, braveScored);
  $: sortedBookmarks = [...bookmarks]
    .filter(b => !ignoredIds.has(b.id))
    .sort((a, b) => (Date.parse(b?.created) || 0) - (Date.parse(a?.created) || 0));
  $: errorClass = selectedBookmark
    ? (logText
        ? classifyExtractionLog(logText)
        : classifyBookmarkState(selectedBookmark))
    : null;
  $: routeMode = selectedCandidate ? 'preview' : (selectedBookmark ? 'bookmark' : 'drawer');
  $: topBarTitle = routeMode === 'preview' ? 'Preview'
                : routeMode === 'bookmark' ? 'Bookmark'
                : (VIEW_TITLES[activeView] || activeView);
  $: showBack = routeMode !== 'drawer';
  $: showMenu = routeMode === 'drawer' && !isWide;

  function handleResize() {
    isWide = window.innerWidth >= WIDE_MIN;
    if (isWide) drawerOpen = false;
  }

  async function hydrateFromCache() {
    const cached = await cache.getBookmarks();
    if (cached.length) bookmarks = cached;
    const lastSync = await cache.getMeta('lastSync');
    return lastSync || 0;
  }

  async function refresh() {
    if (!apiToken) return;
    loading = true;
    try {
      const fresh = await client.getBrokenBookmarks();
      bookmarks = fresh;
      await cache.clearBookmarks();
      await cache.putBookmarks(fresh);
      await cache.setMeta('lastSync', Date.now());
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function onMenuToggle() { drawerOpen = !drawerOpen; }
  function onScrim() { drawerOpen = false; }
  function onNavSelect(event) {
    activeView = event.detail.view;
    if (!isWide) drawerOpen = false;
    selectedBookmark = null;
    selectedCandidate = null;
    archiveScored = [];
    braveScored = [];
    archiveError = null;
    showOverflowMenu = false;
  }

  function onSelectBookmark(event) {
    const b = event.detail.bookmark;
    triageScrollY = contentEl?.scrollTop ?? triageScrollY;
    selectedBookmark = b;
    selectedCandidate = null;
    showOverflowMenu = false;
    loadCandidatesFor(b);
    loadExtractionLogFor(b);
  }

  function loadExtractionLogFor(b) {
    logText = '';
    logFetchedForId = null;
    if (!b?.resources?.log?.src) {
      logLoading = false;
      return;
    }
    logLoading = true;
    const id = b.id;
    client.fetchExtractionLog(b)
      .then(text => {
        if (selectedBookmark?.id !== id) return;
        logText = text || '';
        logFetchedForId = id;
      })
      .catch(e => {
        if (selectedBookmark?.id !== id) return;
        console.warn('Extraction log fetch failed:', e);
      })
      .finally(() => {
        if (selectedBookmark?.id !== id) return;
        logLoading = false;
      });
  }

  function onSelectCandidate(event) {
    selectedCandidate = event.detail.candidate;
  }

  function onBack() {
    showOverflowMenu = false;
    if (selectedCandidate) {
      selectedCandidate = null;
    } else if (selectedBookmark) {
      selectedBookmark = null;
      archiveScored = [];
      braveScored = [];
      archiveError = null;
      logText = '';
      logFetchedForId = null;
    }
  }

  function loadCandidatesFor(b) {
    const myToken = ++loadToken;
    archiveScored = [];
    braveScored = [];
    archiveLoading = true;
    braveLoading = true;
    archiveError = null;
    braveSuppressed = false;

    archiveClient.findSnapshots(b.url)
      .then(snaps => {
        if (myToken !== loadToken) return;
        archiveScored = scoreArchiveSnapshots(b, snaps);
      })
      .catch(e => {
        if (myToken !== loadToken) return;
        console.error('Archive fetch failed:', e);
        archiveError = {
          rateLimited: e instanceof ArchiveRateLimitError,
          message: e?.message || 'Archive.org request failed.',
        };
      })
      .finally(() => {
        if (myToken !== loadToken) return;
        archiveLoading = false;
      });

    const query = b.title || b.url;
    braveClient.search(query, { count: 10 })
      .then(results => {
        if (myToken !== loadToken) return;
        braveScored = results.map(r => {
          const s = scoreBraveCandidate(b, r);
          return { ...r, ...s, source: 'brave' };
        });
      })
      .catch(e => {
        if (myToken !== loadToken) return;
        console.error('Brave fetch failed:', e);
        braveSuppressed = true;
      })
      .finally(() => {
        if (myToken !== loadToken) return;
        braveLoading = false;
      });
  }

  function retryArchive() {
    if (!selectedBookmark) return;
    const b = selectedBookmark;
    const myToken = ++loadToken;
    archiveLoading = true;
    archiveError = null;
    archiveClient.findSnapshots(b.url)
      .then(snaps => {
        if (myToken !== loadToken) return;
        archiveScored = scoreArchiveSnapshots(b, snaps);
      })
      .catch(e => {
        if (myToken !== loadToken) return;
        archiveError = {
          rateLimited: e instanceof ArchiveRateLimitError,
          message: e?.message || 'Archive.org request failed.',
        };
      })
      .finally(() => {
        if (myToken !== loadToken) return;
        archiveLoading = false;
      });
  }

  async function applyRepair(newUrl, source) {
    if (!selectedBookmark) return;
    if (!confirm(`Replace "${selectedBookmark.title || selectedBookmark.url}"?\n\nNew URL: ${newUrl}`)) return;
    const { recovery, deprecation } = LABELS_BY_SOURCE[source] ?? LABELS_BY_SOURCE.manual;
    const deprecateAction = localStorage.getItem('apply_disposition') === 'delete' ? 'delete' : 'archive';
    const bookmarkId = selectedBookmark.id;
    try {
      await client.repairBookmark(bookmarkId, newUrl, {
        recoveryLabel: recovery,
        deprecationLabel: deprecation,
        deprecateAction,
      });
      await cache.deleteBookmark(bookmarkId);
      bookmarks = bookmarks.filter(b => b.id !== bookmarkId);
      selectedBookmark = null;
      selectedCandidate = null;
      archiveScored = [];
      braveScored = [];
    } catch (e) {
      alert(`Repair failed: ${e.message}`);
    }
  }

  function applyCurrentCandidate() {
    if (!selectedCandidate) return;
    applyRepair(selectedCandidate.url, selectedCandidate.source || 'archive');
  }

  function openExternalCurrent() {
    if (!selectedCandidate?.url) return;
    window.open(selectedCandidate.url, '_blank', 'noopener,noreferrer');
  }

  function openManualDialog() {
    showOverflowMenu = false;
    showManualDialog = true;
  }

  function openLogDialog() {
    showOverflowMenu = false;
    showLogDialog = true;
  }

  function closeLogDialog() {
    showLogDialog = false;
  }

  function openOriginal() {
    if (!selectedBookmark?.url) return;
    window.open(selectedBookmark.url, '_blank', 'noopener,noreferrer');
  }

  function previewOriginal() {
    if (!selectedBookmark?.url) return;
    selectedCandidate = {
      url: selectedBookmark.url,
      source: 'manual',
      title: selectedBookmark.title || selectedBookmark.url,
      score: null,
      reason: 'Original URL',
      tier: null,
    };
  }

  async function ignoreAndBack() {
    if (!selectedBookmark) return;
    const id = selectedBookmark.id;
    await ignoreBookmark(id);
    ignoredIds = new Set([...ignoredIds, id]);
    selectedCandidate = null;
    selectedBookmark = null;
    archiveScored = [];
    braveScored = [];
    archiveError = null;
    logText = '';
    logFetchedForId = null;
    showOverflowMenu = false;
  }
  function onManualApply(event) {
    showManualDialog = false;
    applyRepair(event.detail.url, 'manual');
  }
  function onManualCancel() {
    showManualDialog = false;
  }

  function toggleOverflow(event) {
    event.stopPropagation();
    showOverflowMenu = !showOverflowMenu;
  }
  function closeOverflow() {
    if (showOverflowMenu) showOverflowMenu = false;
  }

  function stageDelete(event) {
    const { bookmarkId, title } = event.detail;
    const target = bookmarks.find(b => b.id === bookmarkId);
    if (!target) return;
    if (pendingDelete) commitDelete();
    pendingDelete = { id: bookmarkId, title, bookmark: target };
    lastCommittedAt = Date.now();
    tick().then(attachOutsideListener);
  }

  function deleteFromCurrentView() {
    if (!selectedBookmark) return;
    const id = selectedBookmark.id;
    const title = selectedBookmark.title || selectedBookmark.url;
    selectedBookmark = null;
    selectedCandidate = null;
    archiveScored = [];
    braveScored = [];
    archiveError = null;
    showOverflowMenu = false;
    stageDelete({ detail: { bookmarkId: id, title } });
  }

  function undoDelete() {
    pendingDelete = null;
    detachOutsideListener();
  }

  async function commitDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    pendingDelete = null;
    detachOutsideListener();
    bookmarks = bookmarks.filter(b => b.id !== id);
    try {
      await client.deleteBookmark(id);
      await cache.deleteBookmark(id);
    } catch (e) {
      console.error('DELETE failed:', e);
      alert(`Delete failed: ${e.message}`);
      await refresh();
    }
  }

  function attachOutsideListener() {
    if (outsideHandler) return;
    outsideHandler = (event) => {
      if (Date.now() - lastCommittedAt < 50) return;
      const target = event.target;
      if (target && target.closest && target.closest('[data-delete-snackbar]')) return;
      commitDelete();
    };
    window.addEventListener('click', outsideHandler, true);
  }
  function detachOutsideListener() {
    if (!outsideHandler) return;
    window.removeEventListener('click', outsideHandler, true);
    outsideHandler = null;
  }

  onMount(async () => {
    window.addEventListener('resize', handleResize);
    ignoredIds = await getIgnoredIds();
    if (!apiToken) return;
    const lastSync = await hydrateFromCache();
    const stale = !lastSync || Date.now() - lastSync > CACHE_STALE_MS;
    if (stale || bookmarks.length === 0) {
      await refresh();
    }
  });

  afterUpdate(() => {
    if (prevRouteMode !== 'drawer' && routeMode === 'drawer' && activeView === 'triage' && contentEl) {
      contentEl.scrollTop = triageScrollY;
    }
    prevRouteMode = routeMode;
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize);
    detachOutsideListener();
  });
</script>

<svelte:window on:click={closeOverflow} />

<div class="shell" class:wide={isWide}>
  {#if isWide}
    <NavDrawer
      variant="permanent"
      active={activeView}
      open={true}
      on:select={onNavSelect}
    />
  {:else if drawerOpen && routeMode === 'drawer'}
    <NavDrawer
      variant="modal"
      active={activeView}
      open={drawerOpen}
      on:select={onNavSelect}
      on:scrim={onScrim}
    />
  {/if}

  <div class="main">
    <TopAppBar
      title={topBarTitle}
      {showMenu}
      {showBack}
      on:menu-toggle={onMenuToggle}
      on:back={onBack}
    >
      <svelte:fragment slot="trailing">
        {#if routeMode === 'bookmark'}
          <button class="bar-icon" on:click={previewOriginal} title="Preview original URL" aria-label="Preview original URL">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d={MdiWeb} fill="currentColor" />
            </svg>
          </button>
          <div class="overflow-wrap">
            <button class="bar-icon" on:click={toggleOverflow} aria-label="More" aria-haspopup="menu">
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path d={MdiDotsVertical} fill="currentColor" />
              </svg>
            </button>
            {#if showOverflowMenu}
              <div class="overflow-menu" on:click|stopPropagation role="menu">
                <button class="menu-item" on:click={openManualDialog} role="menuitem">Manual URL</button>
                <button class="menu-item" on:click={openLogDialog} role="menuitem" disabled={!selectedBookmark?.resources?.log?.src}>
                  View extraction log
                </button>
                <button class="menu-item" on:click={openOriginal} role="menuitem">Open original in new tab</button>
                <button class="menu-item" on:click={ignoreAndBack} role="menuitem">Ignore (keep as-is)</button>
                <button class="menu-item danger" on:click={deleteFromCurrentView} role="menuitem">Delete</button>
              </div>
            {/if}
          </div>
        {:else if routeMode === 'preview'}
          <button class="bar-icon" on:click={applyCurrentCandidate} title="Apply" aria-label="Apply replacement">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d={MdiCheck} fill="currentColor" />
            </svg>
          </button>
          <button class="bar-icon" on:click={openExternalCurrent} title="Open in new tab" aria-label="Open in new tab">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d={MdiOpenInNew} fill="currentColor" />
            </svg>
          </button>
          <button class="bar-icon" on:click={ignoreAndBack} title="Ignore (keep as-is)" aria-label="Ignore bookmark">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d={MdiEyeOff} fill="currentColor" />
            </svg>
          </button>
          <button class="bar-icon" on:click={deleteFromCurrentView} title="Delete" aria-label="Delete bookmark">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d={MdiDelete} fill="currentColor" />
            </svg>
          </button>
        {/if}
      </svelte:fragment>
    </TopAppBar>

    <div class="content-scroll" bind:this={contentEl}>
      {#if routeMode === 'preview'}
        <PreviewView candidate={selectedCandidate} />
      {:else if routeMode === 'bookmark'}
        <BookmarkView
          bookmark={selectedBookmark}
          closest={merged.closest}
          interleaved={merged.interleaved}
          {archiveLoading}
          {braveLoading}
          {archiveError}
          {braveSuppressed}
          {errorClass}
          on:select-candidate={onSelectCandidate}
          on:retry-archive={retryArchive}
        />
      {:else if activeView === 'triage'}
        {#if !apiToken}
          <div class="empty-pad">
            <p>Configure your Readeck server and API token in the current console (without <code>?v2=1</code>) to get started.</p>
          </div>
        {:else}
          <TriageList
            bookmarks={sortedBookmarks}
            loading={loading}
            pendingDeleteId={pendingDelete?.id ?? null}
            on:delete={stageDelete}
            on:select={onSelectBookmark}
          />
        {/if}
      {:else}
        <div class="coming-soon">
          <em>{VIEW_TITLES[activeView] || activeView}</em> — coming soon.
        </div>
      {/if}
    </div>

    {#if pendingDelete}
      <DeleteSnackbar
        title={pendingDelete.title}
        on:undo={undoDelete}
      />
    {/if}
  </div>
</div>

{#if showManualDialog}
  <ManualUrlDialog on:apply={onManualApply} on:cancel={onManualCancel} />
{/if}

{#if showLogDialog}
  <LogViewerDialog
    title={selectedBookmark?.title || selectedBookmark?.url || ''}
    log={logText}
    loading={logLoading}
    on:close={closeLogDialog}
  />
{/if}

<style>
  .shell {
    display: flex;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
  }
  .main {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
  }
  .content-scroll {
    flex: 1 1 auto;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--bg-list-panel);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .coming-soon {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 24px;
    font-size: 1.1rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .coming-soon em {
    margin-right: 6px;
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }
  .empty-pad {
    padding: 32px;
    text-align: center;
    color: var(--md-sys-color-on-surface-variant);
    max-width: 520px;
    margin: 0 auto;
  }
  .empty-pad code {
    background: var(--md-sys-color-surface-variant);
    color: var(--md-sys-color-on-surface-variant);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.85em;
  }

  .bar-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    background: transparent;
    color: var(--md-sys-color-on-surface);
    border-radius: 999px;
    cursor: pointer;
  }
  .bar-icon:hover { background: var(--bg-hover); }

  .overflow-wrap {
    position: relative;
  }
  .overflow-menu {
    position: absolute;
    top: 48px;
    right: 0;
    min-width: 180px;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    border-radius: 8px;
    box-shadow: var(--md-sys-shadow-1);
    padding: 6px 0;
    z-index: 55;
  }
  .menu-item {
    display: block;
    width: 100%;
    padding: 10px 16px;
    border: none;
    background: transparent;
    color: var(--md-sys-color-on-surface);
    text-align: left;
    font: inherit;
    cursor: pointer;
  }
  .menu-item:hover { background: var(--bg-hover); }
  .menu-item.danger { color: var(--error-fg); }
</style>
