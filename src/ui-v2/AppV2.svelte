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
  import { handleCallback, revokeToken } from '../lib/api/oauth';
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
  import ApplyConfirmDialog from './components/ApplyConfirmDialog.svelte';
  import SignInView from './components/SignInView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import RecoveredView from './components/RecoveredView.svelte';
  import ReplacedView from './components/ReplacedView.svelte';
  import IgnoredView from './components/IgnoredView.svelte';
  import UserGuideView from './components/UserGuideView.svelte';
  import AboutView from './components/AboutView.svelte';
  import SortMenu from './components/SortMenu.svelte';
  import FilterBottomSheet from './components/FilterBottomSheet.svelte';
  import FilterBar from './components/FilterBar.svelte';

  import {
    MdiDotsVertical,
    MdiCheck,
    MdiOpenInNew,
    MdiDelete,
    MdiWeb,
    MdiEyeOff,
    MdiFilterVariant,
    MdiLink,
    MdiEyeOffOutline,
    MdiFileDocumentOutline,
  } from './icons/index.js';

  import { compareBookmarks, loadSortOption, saveSortOption } from '../lib/sort.js';
  import {
    matchesFilter,
    hasActiveFilters,
    presetFor,
    collectLabels,
  } from '../lib/filter.js';

  const WIDE_MIN = 768;
  const REPAIR_STATE_KEY = 'repair_state';

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

  // Auth state — prefer OAuth access token, fall back to legacy v1 personal-access token.
  let apiToken =
    localStorage.getItem('readeck_access_token') ||
    localStorage.getItem('readeck_token') ||
    '';
  // serverUrl is informational (display in Settings, used to build the /authorize
  // redirect during sign-in). All API calls go through the same-origin /api/
  // reverse proxy — never use serverUrl as ReadeckClient baseUrl.
  let serverUrl = localStorage.getItem('readeck_url') || '';
  let tokenId = localStorage.getItem('readeck_token_id') || '';
  let tokenScope = localStorage.getItem('readeck_token_scope') || '';
  let signInError = '';
  let client = new ReadeckClient('', apiToken);
  const archiveClient = new ArchiveClient();
  const braveClient = new BraveClient();

  // Read saved repair state synchronously at script init. The reactive `$:`
  // save block below runs before onMount, so we have to seed initial values
  // from sessionStorage here — otherwise the block would wipe the key before
  // we get a chance to restore.
  let _initialRepair = null;
  if (apiToken && typeof window !== 'undefined') {
    try {
      const saved = sessionStorage.getItem(REPAIR_STATE_KEY);
      if (saved) _initialRepair = JSON.parse(saved);
    } catch { /* ignore corrupt state */ }
  }

  let bookmarks =[];
  let loading = false;
  let activeView = 'triage';
  let sortOption = loadSortOption();
  let ignoredIds = new Set();
  // Per-view filter state. `null` = no filter active (preset only). Not
  // persisted across reloads — see docs/filter.md.
  let filterStates = { triage: null, recovered: null, replaced: null, ignored: null };
  let showFilterSheet = false;
  // Filtered counts from each list view (Triage computed below; Recovered/Replaced/Ignored
  // bind these from the view via `bind:filteredCount`).
  let filteredCounts = { triage: 0, recovered: 0, replaced: 0, ignored: 0 };
  // Per-view label maps for the filter sheet's label picker.
  let viewLabels = { triage: new Map(), recovered: new Map(), replaced: new Map(), ignored: new Map() };
  // Counts shown as pills on the nav drawer. Triage and Ignored are derived
  // reactively below; Recovered / Replaced are fetched lazily.
  let recoveredCount = null;
  let replacedCount = null;

  let isWide = typeof window !== 'undefined' ? window.innerWidth >= WIDE_MIN : true;
  let drawerOpen = false;

  let selectedBookmark = _initialRepair?.bookmark || null;
  let selectedCandidate = null;
  let loadToken = 0;
  let archiveScored = _initialRepair?.archiveScored ||[];
  let braveScored = _initialRepair?.braveScored ||[];
  let archiveLoading = false;
  let braveLoading = false;
  let archiveError = null;
  let braveError = null;  // { message } | null

  let showOverflowMenu = false;
  let showManualDialog = false;
  let showLogDialog = false;
  // { newUrl, source } | null while the Apply confirmation dialog is open
  let pendingApply = null;

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
  $: triageVisible = [...bookmarks]
    .filter(b => !ignoredIds.has(b.id))
    .sort((a, b) => compareBookmarks(a, b, sortOption));
  $: triageFiltered = triageVisible.filter(b => matchesFilter(b, filterStates.triage));
  $: filteredCounts.triage = triageFiltered.length;
  $: viewLabels.triage = collectLabels(triageVisible);
  $: isListView = activeView === 'triage' || activeView === 'recovered'
                || activeView === 'replaced' || activeView === 'ignored';
  $: saveSortOption(sortOption);
  $: currentFilter = filterStates[activeView] || null;
  $: currentFilterActive = hasActiveFilters(currentFilter);
  $: navCounts = {
    // Drawer counts reflect the unfiltered preset list — see docs/filter.md.
    triage: triageVisible.length,
    recovered: recoveredCount,
    replaced: replacedCount,
    ignored: ignoredIds.size,
  };
  $: errorClass = selectedBookmark
    ? (logText
        ? classifyExtractionLog(logText)
        : classifyBookmarkState(selectedBookmark))
    : null;
  $: routeMode = selectedCandidate ? 'preview' : (selectedBookmark ? 'bookmark' : 'drawer');
  $: topBarTitle = !apiToken ? 'Sign in'
                : routeMode === 'preview' ? 'Preview'
                : routeMode === 'bookmark' ? 'Bookmark'
                : (currentFilterActive && isListView
                    ? `${VIEW_TITLES[activeView] || activeView} (${filteredCounts[activeView] ?? 0})`
                    : (VIEW_TITLES[activeView] || activeView));
  $: showBack = routeMode !== 'drawer';
  $: showMenu = routeMode === 'drawer' && !isWide && !!apiToken;

  // Persist repair state to sessionStorage so a reload restores context.
  // Cleared automatically when selectedBookmark returns to null.
  $: if (typeof window !== 'undefined') {
    if (selectedBookmark) {
      sessionStorage.setItem(REPAIR_STATE_KEY, JSON.stringify({
        bookmark: selectedBookmark,
        archiveScored,
        braveScored,
      }));
    } else {
      sessionStorage.removeItem(REPAIR_STATE_KEY);
    }
  }

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

  async function refreshLabelCounts() {
    if (!apiToken) return;
    try {
      const [r, p] = await Promise.all([
        client.countBookmarksByLabels([RECOVERY_LABEL_ARCHIVE, RECOVERY_LABEL_SEARCH, RECOVERY_LABEL_MANUAL]
        ),
        client.countBookmarksByLabels([DEPRECATION_LABEL_ARCHIVE, DEPRECATION_LABEL_SEARCH, DEPRECATION_LABEL_MANUAL],
          { is_archived: true }
        ),
      ]);
      recoveredCount = r;
      replacedCount = p;
    } catch (e) {
      console.warn('label count refresh failed:', e);
    }
  }

  function onScrollToTop() {
    contentEl?.scrollTo({ top: 0, behavior: 'smooth' });
    if (routeMode === 'preview') {
      const iframe = contentEl?.querySelector('iframe');
      if (iframe?.src) {
        try {
          iframe.contentWindow.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (_) {
          // cross-origin: reload iframe to its URL, which lands at page top
          iframe.src = iframe.src;
        }
      }
    }
  }

  function onMenuToggle() { drawerOpen = !drawerOpen; }
  function onScrim() { drawerOpen = false; }

  // Filter handlers — single source of truth for filterStates[activeView].
  // A filter that no longer narrows the view collapses back to `null` so the
  // chip bar disappears and the title drops the count.
  function applyFilter(next) {
    filterStates = {
      ...filterStates,
      [activeView]: hasActiveFilters(next) ? next : null,
    };
    showFilterSheet = false;
  }
  function resetFilter() {
    filterStates = { ...filterStates, [activeView]: null };
    showFilterSheet = false;
  }
  function dismissFilter() {
    showFilterSheet = false;
  }
  function openFilter() {
    showFilterSheet = true;
  }
  function onNavSelect(event) {
    activeView = event.detail.view;
    if (!isWide) drawerOpen = false;
    selectedBookmark = null;
    selectedCandidate = null;
    archiveScored = [];
    braveScored =[];
    archiveError = null;
    showOverflowMenu = false;
    showFilterSheet = false;
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
      archiveScored =[];
      braveScored =[];
      archiveError = null;
      logText = '';
      logFetchedForId = null;
    }
  }

  function loadCandidatesFor(b) {
    const myToken = ++loadToken;
    archiveScored = [];
    braveScored =[];
    archiveLoading = true;
    braveLoading = true;
    archiveError = null;
    braveError = null;

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
        braveError = { message: e?.message || 'Brave Search request failed.' };
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

  function retryBrave() {
    if (!selectedBookmark) return;
    const b = selectedBookmark;
    const myToken = ++loadToken;
    braveLoading = true;
    braveError = null;
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
        braveError = { message: e?.message || 'Brave Search request failed.' };
      })
      .finally(() => {
        if (myToken !== loadToken) return;
        braveLoading = false;
      });
  }

  function requestApplyRepair(newUrl, source) {
    if (!selectedBookmark) return;
    pendingApply = { newUrl, source };
  }

  function cancelApplyRepair() {
    pendingApply = null;
  }

  async function confirmApplyRepair(event) {
    if (!selectedBookmark || !pendingApply) return;
    const { newUrl, source } = pendingApply;
    const disposition = event.detail.disposition;
    pendingApply = null;
    const { recovery, deprecation } = LABELS_BY_SOURCE[source] ?? LABELS_BY_SOURCE.manual;
    const bookmarkId = selectedBookmark.id;
    try {
      await client.repairBookmark(bookmarkId, newUrl, {
        recoveryLabel: recovery,
        deprecationLabel: deprecation,
        deprecateAction: disposition,
      });
      await cache.deleteBookmark(bookmarkId);
      bookmarks = bookmarks.filter(b => b.id !== bookmarkId);
      selectedBookmark = null;
      selectedCandidate = null;
      archiveScored = [];
      braveScored =[];
      refreshLabelCounts();
    } catch (e) {
      alert(`Repair failed: ${e.message}`);
    }
  }

  function applyCurrentCandidate() {
    if (!selectedCandidate) return;
    requestApplyRepair(selectedCandidate.url, selectedCandidate.source || 'archive');
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

  function rebuildClient() {
    // baseUrl is always empty: the SPA deployment proxies /api/ to Readeck
    // at the nginx layer. Cross-origin direct calls would hit CORS.
    client = new ReadeckClient('', apiToken);
  }

  function persistAuth({ accessToken, id, scope, server }) {
    apiToken = accessToken;
    tokenId = id || '';
    tokenScope = scope || '';
    serverUrl = server;
    localStorage.setItem('readeck_access_token', accessToken);
    if (id) localStorage.setItem('readeck_token_id', id);
    else localStorage.removeItem('readeck_token_id');
    if (scope) localStorage.setItem('readeck_token_scope', scope);
    else localStorage.removeItem('readeck_token_scope');
    localStorage.setItem('readeck_url', server);
    // Discard the legacy v1 token if any — OAuth supersedes it.
    localStorage.removeItem('readeck_token');
    rebuildClient();
  }

  function clearAuth() {
    apiToken = '';
    tokenId = '';
    tokenScope = '';
    localStorage.removeItem('readeck_access_token');
    localStorage.removeItem('readeck_token_id');
    localStorage.removeItem('readeck_token_scope');
    localStorage.removeItem('readeck_token');
    localStorage.removeItem('readeck_server_info');
    rebuildClient();
  }

  function onServerUrlEntered(event) {
    // SignInView captures the URL pre-redirect so we have it after the round-trip.
    serverUrl = event.detail.url;
    localStorage.setItem('readeck_url', serverUrl);
  }

  async function onSignOut() {
    const prevToken = apiToken;
    const prevTokenId = tokenId;

    // Reset UI state immediately.
    selectedBookmark = null;
    selectedCandidate = null;
    bookmarks =[];
    archiveScored = [];
    braveScored =[];
    archiveError = null;
    activeView = 'triage';

    clearAuth();
    await cache.clearBookmarks();

    // Best-effort revoke; doesn't block local sign-out.
    if (prevToken) {
      revokeToken(prevToken, prevTokenId);
    }
  }

  async function ignoreAndBack() {
    if (!selectedBookmark) return;
    const id = selectedBookmark.id;
    await ignoreBookmark(id);
    ignoredIds = new Set([...ignoredIds, id]);
    selectedCandidate = null;
    selectedBookmark = null;
    archiveScored = [];
    braveScored =[];
    archiveError = null;
    logText = '';
    logFetchedForId = null;
    showOverflowMenu = false;
  }
  function onManualApply(event) {
    showManualDialog = false;
    requestApplyRepair(event.detail.url, 'manual');
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
    braveScored =[];
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

  async function onUnignored() {
    ignoredIds = await getIgnoredIds();
  }

  async function onUnignoredAll() {
    ignoredIds = await getIgnoredIds();
  }

  async function processOAuthCallback() {
    const result = await handleCallback();
    if (!result) return;

    // Strip OAuth params from the URL so a refresh doesn't replay the code.
    const cleanParams = new URLSearchParams(window.location.search);
    for (const k of ['code', 'state', 'error', 'error_description']) cleanParams.delete(k);
    const newSearch = cleanParams.toString();
    const newUrl =
      window.location.pathname +
      (newSearch ? `?${newSearch}` : '') +
      window.location.hash;
    window.history.replaceState({}, '', newUrl);

    if ('error' in result) {
      signInError =
        result.errorDescription ||
        (result.error === 'access_denied'
          ? 'Authorization was denied.'
          : `Sign-in failed (${result.error}).`);
      return;
    }

    persistAuth({
      accessToken: result.accessToken,
      id: result.tokenId,
      scope: result.scope,
      server: result.serverUrl,
    });
    signInError = '';
  }

  onMount(async () => {
    window.addEventListener('resize', handleResize);
    ignoredIds = await getIgnoredIds();

    // Consume any OAuth callback before deciding whether we're authenticated.
    await processOAuthCallback();

    if (!apiToken) return;

    // Repair state was restored synchronously at script init (see _initialRepair).
    // Kick off the extraction-log fetch so errorClass repopulates in the header.
    if (selectedBookmark) {
      loadExtractionLogFor(selectedBookmark);
    }

    const lastSync = await hydrateFromCache();
    const stale = !lastSync || Date.now() - lastSync > CACHE_STALE_MS;
    if (stale || bookmarks.length === 0) {
      await refresh();
    }
    refreshLabelCounts();
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
  {#if apiToken && isWide}
    <NavDrawer
      variant="permanent"
      active={activeView}
      open={true}
      counts={navCounts}
      on:select={onNavSelect}
    />
  {:else if apiToken && drawerOpen && routeMode === 'drawer'}
    <NavDrawer
      variant="modal"
      active={activeView}
      open={drawerOpen}
      counts={navCounts}
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
      on:title-tap={onScrollToTop}
    >
      <svelte:fragment slot="trailing">
        {#if routeMode === 'drawer' && isListView && apiToken}
          <SortMenu value={sortOption} on:change={(e) => sortOption = e.detail.value} />
          <button class="bar-icon" on:click={openFilter} title="Filter" aria-label="Filter">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d={MdiFilterVariant} fill="currentColor" />
            </svg>
          </button>
        {/if}
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
                <button class="menu-item" on:click={openManualDialog} role="menuitem">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d={MdiLink} fill="currentColor" />
                  </svg>
                  <span>Manual URL</span>
                </button>
                <button class="menu-item" on:click={openLogDialog} role="menuitem" disabled={!selectedBookmark?.resources?.log?.src}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d={MdiFileDocumentOutline} fill="currentColor" />
                  </svg>
                  <span>View extraction log</span>
                </button>
                <button class="menu-item" on:click={openOriginal} role="menuitem">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d={MdiOpenInNew} fill="currentColor" />
                  </svg>
                  <span>Open original in new tab</span>
                </button>
                <button class="menu-item" on:click={ignoreAndBack} role="menuitem">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d={MdiEyeOffOutline} fill="currentColor" />
                  </svg>
                  <span>Ignore (keep as-is)</span>
                </button>
                <button class="menu-item danger" on:click={deleteFromCurrentView} role="menuitem">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d={MdiDelete} fill="currentColor" />
                  </svg>
                  <span>Delete</span>
                </button>
              </div>
            {/if}
          </div>
        {:else if routeMode === 'preview'}
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

    {#if routeMode === 'drawer' && isListView && apiToken && currentFilterActive}
      <FilterBar
        value={currentFilter}
        on:change={(e) => applyFilter(e.detail.value)}
        on:open={openFilter}
      />
    {/if}

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
          {braveError}
          {errorClass}
          on:select-candidate={onSelectCandidate}
          on:retry-archive={retryArchive}
          on:retry-brave={retryBrave}
        />
      {:else if !apiToken}
        <SignInView
          initialUrl={serverUrl}
          initialError={signInError}
          on:server-url={onServerUrlEntered}
        />
      {:else if activeView === 'triage'}
        <TriageList
          bookmarks={triageFiltered}
          loading={loading}
          pendingDeleteId={pendingDelete?.id ?? null}
          on:delete={stageDelete}
          on:select={onSelectBookmark}
        />
      {:else if activeView === 'settings'}
        <SettingsView
          serverUrl={serverUrl}
          scope={tokenScope}
          signedIn={!!apiToken}
          on:sign-out={onSignOut}
        />
      {:else if activeView === 'recovered'}
        <RecoveredView
          {client}
          {sortOption}
          filterState={filterStates.recovered}
          bind:filteredCount={filteredCounts.recovered}
          bind:availableLabels={viewLabels.recovered}
        />
      {:else if activeView === 'replaced'}
        <ReplacedView
          {client}
          {sortOption}
          filterState={filterStates.replaced}
          bind:filteredCount={filteredCounts.replaced}
          bind:availableLabels={viewLabels.replaced}
        />
      {:else if activeView === 'ignored'}
        <IgnoredView
          {client}
          {sortOption}
          filterState={filterStates.ignored}
          bind:filteredCount={filteredCounts.ignored}
          bind:availableLabels={viewLabels.ignored}
          on:unignored={onUnignored}
          on:unignored-all={onUnignoredAll}
        />
      {:else if activeView === 'guide'}
        <UserGuideView />
      {:else if activeView === 'about'}
        <AboutView {client} {serverUrl} />
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

    {#if routeMode === 'preview'}
      <button
        class="fab"
        on:click={applyCurrentCandidate}
        title="Apply"
        aria-label="Apply replacement"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d={MdiCheck} fill="currentColor" />
        </svg>
      </button>
    {/if}
  </div>
</div>

{#if showFilterSheet && isListView}
  <FilterBottomSheet
    value={currentFilter}
    preset={presetFor(activeView)}
    availableLabels={viewLabels[activeView] || new Map()}
    on:apply={(e) => applyFilter(e.detail.value)}
    on:reset={resetFilter}
    on:dismiss={dismissFilter}
  />
{/if}

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

{#if pendingApply && selectedBookmark}
  <ApplyConfirmDialog
    bookmarkTitle={selectedBookmark.title || selectedBookmark.url}
    newUrl={pendingApply.newUrl}
    originalIsArchived={!!selectedBookmark.is_archived}
    defaultDisposition={localStorage.getItem('apply_disposition') === 'delete' ? 'delete' : 'archive'}
    on:apply={confirmApplyRepair}
    on:cancel={cancelApplyRepair}
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

  .fab {
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 56px;
    height: 56px;
    border: none;
    border-radius: 18px;
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    box-shadow: var(--md-sys-shadow-1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 30;
  }
  .fab:hover { filter: brightness(1.05); }
  .fab:active { filter: brightness(0.95); }

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
    display: flex;
    align-items: center;
    gap: 12px;
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
  .menu-item:disabled { opacity: 0.5; cursor: default; }
  .menu-item.danger { color: var(--error-fg); }
</style>