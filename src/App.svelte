<script>
  import './styles/theme.css';
  import { onMount } from 'svelte';
  import { ReadeckClient } from './lib/api/readeck';
  import { ArchiveClient, ArchiveRateLimitError } from './lib/api/archive';
  import { BraveClient } from './lib/api/brave';
  import { scoreCandidate, sortByScore } from './lib/scoring';
  import * as cache from './lib/cache';
  import {
    CACHE_STALE_MS,
    RECOVERY_LABEL_ARCHIVE,
    RECOVERY_LABEL_SEARCH,
    RECOVERY_LABEL_MANUAL,
    DEPRECATION_LABEL_ARCHIVE,
    DEPRECATION_LABEL_SEARCH,
    DEPRECATION_LABEL_MANUAL
  } from './lib/config';

  const LABELS_BY_SOURCE = {
    archive: { recovery: RECOVERY_LABEL_ARCHIVE, deprecation: DEPRECATION_LABEL_ARCHIVE },
    search:  { recovery: RECOVERY_LABEL_SEARCH,  deprecation: DEPRECATION_LABEL_SEARCH  },
    manual:  { recovery: RECOVERY_LABEL_MANUAL,  deprecation: DEPRECATION_LABEL_MANUAL  },
  };

  let apiToken = localStorage.getItem('readeck_token') || '';
  let serverUrl = localStorage.getItem('readeck_url') || '';

  let client = new ReadeckClient(serverUrl, apiToken);
  let archive = new ArchiveClient();
  let brave = new BraveClient();

  let bookmarks = [];
  let selectedBookmark = null;
  let selectedCandidate = null;
  let archiveCandidates = [];   // everything, for set-membership checks
  let archiveBest = [];         // closest-before + closest-after
  let archiveOthers = [];       // the rest
  let archiveError = null;      // { rateLimited: boolean, message: string }
  let searchCandidates = [];
  let previewLoading = false;
  let loading = false;
  let candidatesLoading = false;
  let activeTab = 'archive';
  let showSettings = false;
  let showMoreMenu = false;
  let connectionStatus = null;

  const MORE_TABS = { search: 'Search', manual: 'Manual' };

  function toggleMoreMenu(event) {
    event.stopPropagation();
    showMoreMenu = !showMoreMenu;
  }

  function selectMoreTab(tab) {
    activeTab = tab;
    showMoreMenu = false;
  }

  function closeMoreMenu() {
    if (showMoreMenu) showMoreMenu = false;
  }

  let manualUrl = '';

  async function saveSettings() {
    localStorage.setItem('readeck_token', apiToken);
    localStorage.setItem('readeck_url', serverUrl);
    client = new ReadeckClient(serverUrl, apiToken);
    showSettings = false;
    connectionStatus = null;
    await refresh();
  }

  async function testConnection() {
    connectionStatus = null;
    const probe = new ReadeckClient(serverUrl, apiToken);
    try {
      const profile = await probe.getProfile();
      connectionStatus = { ok: true, user: profile?.user?.username || profile?.username || 'connected' };
    } catch (e) {
      connectionStatus = { error: e.message };
    }
  }

  async function hydrateFromCache() {
    const cached = await cache.getBookmarks();
    if (cached.length) bookmarks = cached;
    const lastSync = await cache.getMeta('lastSync');
    return lastSync || 0;
  }

  async function refresh() {
    if (!apiToken) {
      showSettings = true;
      return;
    }
    loading = true;
    try {
      const fresh = await client.getBrokenBookmarks();
      bookmarks = fresh;
      await cache.clearBookmarks();
      await cache.putBookmarks(fresh);
      await cache.setMeta('lastSync', Date.now());
    } catch (e) {
      console.error(e);
      alert('Failed to fetch bookmarks. Check your API token and server connection.');
    } finally {
      loading = false;
    }
  }

  async function loadCandidates(b) {
    candidatesLoading = true;
    archiveCandidates = [];
    archiveBest = [];
    archiveOthers = [];
    archiveError = null;
    searchCandidates = [];
    try {
      const [snapshots, searchResults] = await Promise.allSettled([
        archive.findSnapshots(b.url),
        brave.search(b.title || b.url, { count: 10 })
      ]);

      if (snapshots.status === 'fulfilled') {
        const enriched = snapshots.value.map(s => ({
          ...s,
          delta: signedDelta(s.timestamp, b.created)
        }));
        const after  = enriched.filter(s => s.delta != null && s.delta >= 0)
                               .sort((a, x) => Number(a.timestamp) - Number(x.timestamp));
        const before = enriched.filter(s => s.delta != null && s.delta < 0)
                               .sort((a, x) => Number(a.timestamp) - Number(x.timestamp));
        const unknown = enriched.filter(s => s.delta == null);

        // Top section: the snapshot closest BEFORE the bookmark's created date
        // (last of `before`) + closest AFTER (first of `after`). These bracket
        // the save date and are the most likely to match what you bookmarked.
        const bestBefore = before.length ? before[before.length - 1] : null;
        const bestAfter  = after.length  ? after[0]                  : null;
        archiveBest = [bestBefore, bestAfter].filter(Boolean);

        const bestSet = new Set(archiveBest);
        archiveOthers = [...after, ...before, ...unknown].filter(s => !bestSet.has(s));
        archiveCandidates = [...archiveBest, ...archiveOthers];
      } else {
        console.error('Archive fetch failed:', snapshots.reason);
        archiveError = {
          rateLimited: snapshots.reason instanceof ArchiveRateLimitError,
          message: snapshots.reason?.message || 'Archive.org request failed.',
        };
      }

      if (searchResults.status === 'fulfilled') {
        const scored = searchResults.value.map(r => ({
          ...r,
          ...scoreCandidate({ url: b.url, title: b.title }, r)
        }));
        searchCandidates = sortByScore(scored);
      } else {
        console.error('Search failed:', searchResults.reason);
      }
    } finally {
      candidatesLoading = false;
    }
  }

  function selectBookmark(b) {
    selectedBookmark = b;
    selectedCandidate = null;
    activeTab = 'archive';
    manualUrl = '';
    loadCandidates(b);
  }

  function previewCandidate(candidate) {
    selectedCandidate = candidate;
    activeTab = 'preview';
    previewLoading = true;
  }

  async function applyRepair(newUrl, source) {
    if (!selectedBookmark) return;
    if (!confirm(`Replace "${selectedBookmark.title || selectedBookmark.url}"?\n\nNew URL: ${newUrl}`)) return;

    loading = true;
    try {
      const { recovery, deprecation } = LABELS_BY_SOURCE[source] ?? LABELS_BY_SOURCE.manual;
      await client.repairBookmark(selectedBookmark.id, newUrl, {
        recoveryLabel: recovery,
        deprecationLabel: deprecation,
      });
      await cache.deleteBookmark(selectedBookmark.id);
      bookmarks = bookmarks.filter(b => b.id !== selectedBookmark.id);
      selectedBookmark = null;
      selectedCandidate = null;
      archiveCandidates = [];
      searchCandidates = [];
    } catch (e) {
      alert(`Repair failed: ${e.message}`);
    } finally {
      loading = false;
    }
  }

  function applyManual() {
    if (!manualUrl.trim()) return;
    applyRepair(manualUrl.trim(), 'manual');
  }

  function applyPreviewed() {
    if (!selectedCandidate) return;
    const source = archiveCandidates.includes(selectedCandidate) ? 'archive'
                 : searchCandidates.includes(selectedCandidate)  ? 'search'
                 : 'manual';
    applyRepair(selectedCandidate.url, source);
  }

  // Signed delta in ms: positive = snapshot AFTER bookmark created, negative = before
  function signedDelta(snapshotTs, createdIso) {
    if (!snapshotTs || !createdIso) return null;
    const snap = new Date(
      `${snapshotTs.slice(0,4)}-${snapshotTs.slice(4,6)}-${snapshotTs.slice(6,8)}T${snapshotTs.slice(8,10)}:${snapshotTs.slice(10,12)}:${snapshotTs.slice(12,14)}Z`
    ).getTime();
    const created = new Date(createdIso).getTime();
    if (Number.isNaN(snap) || Number.isNaN(created)) return null;
    return snap - created;
  }

  function deltaPill(deltaMs) {
    if (deltaMs == null) return { label: '?', tone: 'neutral' };
    const sign = deltaMs >= 0 ? '+' : '−';
    const days = Math.abs(deltaMs) / (1000 * 60 * 60 * 24);
    const tone = days <= 30 ? 'green' : days <= 365 ? 'yellow' : 'red';
    const label = days < 365
      ? `${sign}${Math.round(days)}d vs saved`
      : `${sign}${Math.round(days / 365)}y vs saved`;
    return { label, tone };
  }

  function formatTs(ts) {
    return `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  onMount(async () => {
    if (!apiToken) {
      showSettings = true;
      return;
    }
    const lastSync = await hydrateFromCache();
    const stale = !lastSync || Date.now() - lastSync > CACHE_STALE_MS;
    if (stale || bookmarks.length === 0) {
      await refresh();
    }
  });
</script>

<svelte:window on:click={closeMoreMenu} />

<div id="app">
  <aside class="nav-panel">
    <header>MyDeck Console</header>
    <nav>
      <div class="nav-item selected">
        <span class="icon">⚠️</span>
        Broken
      </div>

      <div class="nav-item" on:click={() => refresh()}>
        <span class="icon">🔄</span>
        Refresh
      </div>

      <div class="spacer" style="flex-grow: 1;"></div>

      <div class="nav-item" on:click={() => { showSettings = true; connectionStatus = null; }}>
        <span class="icon">⚙️</span>
        Settings
      </div>
    </nav>
  </aside>

  <main class="list-panel">
    <header>
      Triage Queue
      <span class="count">{bookmarks.length}</span>
      {#if loading}<span class="loader"></span>{/if}
    </header>
    <div class="scroll-area">
      {#if bookmarks.length === 0 && !loading}
        <div class="empty-state">No broken bookmarks found.</div>
      {:else}
        {#each bookmarks as b (b.id)}
          <div class="card {selectedBookmark?.id === b.id ? 'selected' : ''}" on:click={() => selectBookmark(b)}>
            <div class="title">
              {#if b.is_marked}<span title="Favorited">★</span> {/if}
              {b.title || 'Untitled'}
            </div>
            <div class="url">{b.url}</div>
            <div class="card-meta">
              <span class="meta-date">Saved {formatDate(b.created)}</span>
              {#if b.published}
                <span class="meta-date">Published {formatDate(b.published)}</span>
              {/if}
              {#if b.labels?.length}
                {#each b.labels.slice(0, 3) as label}
                  <span class="meta-label">{label}</span>
                {/each}
                {#if b.labels.length > 3}<span class="meta-label">+{b.labels.length - 3}</span>{/if}
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </main>

  <section class="detail-panel">
    {#if selectedBookmark}
      <header>
        <div class="title-row">
          <h1>{selectedBookmark.title || 'Untitled'}</h1>
          <a href={selectedBookmark.url} target="_blank" class="external-link" rel="noreferrer">Original ↗</a>
        </div>
      </header>

      <div class="tabs">
        <div class="tab {activeTab === 'archive' ? 'active' : ''}" on:click={() => activeTab = 'archive'}>
          Archive.org {#if archiveCandidates.length}<span class="tab-count">{archiveCandidates.length}</span>{/if}
        </div>
        <div class="tab {activeTab === 'preview' ? 'active' : ''}" on:click={() => activeTab = 'preview'}>
          Preview
        </div>
        <div class="tab-more-wrap">
          <div
            class="tab {MORE_TABS[activeTab] ? 'active' : ''}"
            on:click={toggleMoreMenu}
          >
            {MORE_TABS[activeTab] ? `More: ${MORE_TABS[activeTab]}` : 'More'} ▾
            {#if activeTab === 'search' && searchCandidates.length}
              <span class="tab-count">{searchCandidates.length}</span>
            {/if}
          </div>
          {#if showMoreMenu}
            <div class="more-menu" on:click|stopPropagation>
              <button class="menu-item {activeTab === 'search' ? 'active' : ''}" on:click={() => selectMoreTab('search')}>
                Search
                {#if searchCandidates.length}<span class="tab-count">{searchCandidates.length}</span>{/if}
              </button>
              <button class="menu-item {activeTab === 'manual' ? 'active' : ''}" on:click={() => selectMoreTab('manual')}>
                Manual
              </button>
            </div>
          {/if}
        </div>
      </div>

      <div class="detail-content">
        {#if activeTab === 'archive'}
          <div class="candidate-list">
            {#if candidatesLoading && archiveCandidates.length === 0}
              <div class="empty-state spinner-state">
                <span class="spinner-lg"></span>
                <span>Searching archives…</span>
              </div>
            {:else if archiveError?.rateLimited}
              <div class="empty-state error-state">
                <strong>Archive.org rate limit reached</strong>
                <p>You've hit archive.org's per-session request limit. Wait a few minutes and click Retry, or use Search / Manual in the meantime.</p>
                <button class="btn" on:click={() => selectedBookmark && loadCandidates(selectedBookmark)}>Retry</button>
              </div>
            {:else if archiveError}
              <div class="empty-state error-state">
                <strong>Archive.org request failed</strong>
                <p>{archiveError.message}</p>
                <button class="btn" on:click={() => selectedBookmark && loadCandidates(selectedBookmark)}>Retry</button>
              </div>
            {:else if archiveCandidates.length === 0}
              <div class="empty-state">No snapshots found for this URL.</div>
            {:else}
              {#if archiveBest.length}
                <h3 class="section-head">Closest to save date</h3>
                {#each archiveBest as c}
                  {@const pill = deltaPill(c.delta)}
                  <div class="candidate-card best {selectedCandidate?.url === c.url ? 'selected' : ''}">
                    <div class="candidate-info">
                      <strong>Snapshot: {formatTs(c.timestamp)}</strong>
                      <p><span class="pill {pill.tone}">{pill.label}</span></p>
                    </div>
                    <div class="candidate-actions">
                      <button class="btn" on:click={() => previewCandidate(c)}>Preview</button>
                      <button class="btn secondary" on:click={() => window.open(c.url, '_blank')}>Open ↗</button>
                      <button class="btn primary" on:click={() => applyRepair(c.url, 'archive')}>Apply</button>
                    </div>
                  </div>
                {/each}
              {/if}
              {#if archiveOthers.length}
                <h3 class="section-head">All snapshots</h3>
                {#each archiveOthers as c}
                  {@const pill = deltaPill(c.delta)}
                  <div class="candidate-card {selectedCandidate?.url === c.url ? 'selected' : ''}">
                    <div class="candidate-info">
                      <strong>Snapshot: {formatTs(c.timestamp)}</strong>
                      <p><span class="pill {pill.tone}">{pill.label}</span></p>
                    </div>
                    <div class="candidate-actions">
                      <button class="btn" on:click={() => previewCandidate(c)}>Preview</button>
                      <button class="btn secondary" on:click={() => window.open(c.url, '_blank')}>Open ↗</button>
                      <button class="btn primary" on:click={() => applyRepair(c.url, 'archive')}>Apply</button>
                    </div>
                  </div>
                {/each}
              {/if}
            {/if}
          </div>

        {:else if activeTab === 'search'}
          <div class="candidate-list">
            {#if candidatesLoading && searchCandidates.length === 0}
              <div class="empty-state spinner-state">
                <span class="spinner-lg"></span>
                <span>Searching the web…</span>
              </div>
            {:else if searchCandidates.length === 0}
              <div class="empty-state">No web results found.</div>
            {:else}
              {#each searchCandidates as c}
                <div class="candidate-card {selectedCandidate?.url === c.url ? 'selected' : ''}">
                  <div class="candidate-info">
                    <strong>{c.title}</strong>
                    <p class="url-line">{c.url}</p>
                    {#if c.description}<p class="snippet">{c.description}</p>{/if}
                    <p><span class="pill {c.tier}">{c.score}% · {c.reason}</span></p>
                  </div>
                  <div class="candidate-actions">
                    <button class="btn" on:click={() => previewCandidate(c)}>Preview</button>
                    <button class="btn secondary" on:click={() => window.open(c.url, '_blank')}>Open ↗</button>
                    <button class="btn primary" on:click={() => applyRepair(c.url, 'search')}>Apply</button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>

        {:else if activeTab === 'preview'}
          {@const previewUrl = selectedCandidate?.url ?? selectedBookmark.url}
          <div class="preview-container">
            <div class="preview-warning">
              {#if selectedCandidate}
                Previewing candidate: <code>{previewUrl}</code>
              {:else}
                No candidate selected — showing original URL. Click "Preview" on a candidate to view it.
              {/if}
              · Some sites block iframe embedding; use "Open ↗" if blank.
            </div>
            <div class="preview-frame-wrap">
              {#if previewLoading}
                <div class="preview-loading">
                  <span class="spinner-lg"></span>
                  <span>Loading preview…</span>
                </div>
              {/if}
              {#key previewUrl}
                <iframe
                  src={previewUrl}
                  title="Preview"
                  on:load={() => previewLoading = false}
                ></iframe>
              {/key}
            </div>
            {#if selectedCandidate}
              <div class="preview-footer">
                <button class="btn secondary" on:click={() => window.open(previewUrl, '_blank')}>Open ↗</button>
                <button class="btn primary" on:click={applyPreviewed}>Apply</button>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'manual'}
          <div class="manual-pane">
            <p>Paste any URL to use as the replacement for this bookmark:</p>
            <input type="url" bind:value={manualUrl} placeholder="https://…" class="manual-input" />
            <div class="manual-actions">
              <button class="btn primary" disabled={!manualUrl.trim()} on:click={applyManual}>Apply Manual URL</button>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="empty-state">Select a bookmark to start repair.</div>
    {/if}
  </section>

  {#if showSettings}
    <div class="modal-overlay">
      <div class="modal">
        <h2>Settings</h2>
        <div class="field">
          <label>Readeck Server URL</label>
          <input type="text" bind:value={serverUrl} placeholder="(leave empty to use /api proxy)" />
          <small>Leave empty for same-origin proxy (prod/dev via nginx). Set full URL for direct access.</small>
        </div>
        <div class="field">
          <label>API Token</label>
          <input type="password" bind:value={apiToken} placeholder="Your Readeck API Token" />
        </div>
        {#if connectionStatus?.ok}
          <div class="status-ok">✓ Connected as {connectionStatus.user}</div>
        {:else if connectionStatus?.error}
          <div class="status-err">✗ {connectionStatus.error}</div>
        {/if}
        <div class="modal-actions">
          <button class="btn" on:click={() => showSettings = false}>Cancel</button>
          <button class="btn" on:click={testConnection}>Test Connection</button>
          <button class="btn primary" on:click={saveSettings}>Save & Refresh</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .nav-item {
    display: flex;
    align-items: center;
    padding: 12px 24px;
    margin: 4px 12px;
    border-radius: var(--md-sys-radius-large);
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }
  .nav-item:hover { background-color: var(--bg-hover); }
  .nav-item.selected {
    background-color: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }
  .icon { margin-right: 12px; font-size: 1.2rem; }

  .count {
    margin-left: 8px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
  }

  .scroll-area { overflow-y: auto; flex-grow: 1; padding-bottom: 24px; }

  .card .title { font-weight: 500; margin-bottom: 4px; }
  .card .url { font-size: 0.75rem; color: var(--text-muted); word-break: break-all; }
  .card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    align-items: center;
    font-size: 0.7rem;
  }
  .meta-date { color: var(--md-sys-color-on-surface-variant); }
  .meta-label {
    padding: 2px 8px;
    border-radius: 100px;
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }

  .title-row { display: flex; align-items: baseline; justify-content: space-between; width: 100%; gap: 16px; }
  h1 { font-size: 1.25rem; margin: 0; font-weight: 500; }
  .external-link { font-size: 0.8rem; color: var(--md-sys-color-primary); text-decoration: none; flex-shrink: 0; }

  .tab-more-wrap { position: relative; }
  .more-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 180px;
    background: var(--bg-modal);
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: 12px;
    box-shadow: var(--md-sys-shadow-1);
    padding: 4px;
    z-index: 20;
    display: flex;
    flex-direction: column;
  }
  .menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 14px;
    border: none;
    background: transparent;
    color: var(--md-sys-color-on-surface);
    text-align: left;
    font: inherit;
    border-radius: 8px;
    cursor: pointer;
  }
  .menu-item:hover { background: var(--bg-hover); }
  .menu-item.active {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }

  .tab-count {
    display: inline-block;
    margin-left: 6px;
    font-size: 0.7rem;
    padding: 1px 8px;
    border-radius: 100px;
    background: var(--md-sys-color-surface-variant);
    color: var(--md-sys-color-on-surface-variant);
  }

  .detail-content { flex-grow: 1; overflow-y: auto; }

  .candidate-list { padding: 16px; display: grid; gap: 12px; }
  .candidate-card {
    background: var(--bg-card);
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .candidate-card.selected {
    border-color: var(--md-sys-color-primary);
    box-shadow: 0 0 0 1px var(--md-sys-color-primary);
  }
  .candidate-info { flex-grow: 1; min-width: 0; }
  .candidate-info strong { display: block; margin-bottom: 4px; }
  .candidate-info p { margin: 4px 0; font-size: 0.8rem; color: var(--text-muted); }
  .candidate-info .url-line { word-break: break-all; color: var(--md-sys-color-primary); }
  .candidate-info .snippet { color: var(--text-subtle); line-height: 1.4; }

  .candidate-actions { display: flex; gap: 8px; flex-shrink: 0; }
  .btn {
    padding: 8px 16px;
    border-radius: 100px;
    border: 1px solid var(--md-sys-color-outline);
    background: transparent;
    cursor: pointer;
    font-weight: 500;
  }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn.primary {
    background: var(--md-sys-color-primary-container);
    border-color: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }

  .pill { display: inline-block; padding: 2px 10px; border-radius: 100px; font-size: 0.72rem; font-weight: 500; }
  .pill.green,  .pill.high   { background: var(--pill-green-bg);  color: var(--pill-green-fg); }
  .pill.yellow, .pill.medium { background: var(--pill-yellow-bg); color: var(--pill-yellow-fg); }
  .pill.red,    .pill.low    { background: var(--pill-red-bg);    color: var(--pill-red-fg); }
  .pill.neutral { background: var(--md-sys-color-surface-variant); color: var(--md-sys-color-on-surface-variant); }

  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: var(--bg-modal);
    color: var(--md-sys-color-on-surface);
    padding: 24px;
    border-radius: 28px;
    width: 440px;
    max-width: 90%;
  }
  .field { margin-bottom: 16px; }
  .field label { display: block; margin-bottom: 8px; font-weight: 500; }
  .field input {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 8px;
    box-sizing: border-box;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
  }
  .field small { display: block; margin-top: 4px; color: var(--text-muted); }
  .status-ok  { color: var(--success-fg); padding: 8px 0; }
  .status-err { color: var(--error-fg);   padding: 8px 0; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; flex-wrap: wrap; }

  .preview-container { display: flex; flex-direction: column; height: 100%; }
  .preview-warning {
    padding: 8px 16px;
    background: var(--bg-preview-warning);
    color: var(--md-sys-color-on-surface);
    font-size: 0.75rem;
    border-bottom: 1px solid var(--md-sys-color-surface-variant);
  }
  .preview-frame-wrap { position: relative; flex-grow: 1; display: flex; }
  .preview-frame-wrap iframe { flex-grow: 1; border: none; width: 100%; }
  .preview-loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface-variant);
    z-index: 1;
    pointer-events: none;
  }
  .preview-footer {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--md-sys-color-surface-variant);
    background: var(--md-sys-color-surface);
    z-index: 2;
  }
  .section-head {
    margin: 16px 16px 8px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--md-sys-color-on-surface-variant);
  }
  .candidate-card.best {
    border-color: var(--md-sys-color-primary);
  }

  .manual-pane { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
  .manual-input {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 8px;
    box-sizing: border-box;
    font-family: monospace;
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
  }
  .manual-actions { display: flex; justify-content: flex-end; }

  .loader {
    width: 16px;
    height: 16px;
    border: 2px solid var(--md-sys-color-primary-container);
    border-top: 2px solid var(--md-sys-color-primary);
    border-radius: 50%;
    display: inline-block;
    animation: spin 1s linear infinite;
    margin-left: 12px;
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 24px;
    text-align: center;
    color: var(--md-sys-color-on-surface-variant);
  }
  .error-state strong { color: var(--error-fg); font-size: 1rem; }
  .error-state p { margin: 0; max-width: 42ch; line-height: 1.4; }

  .spinner-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 48px 16px;
    color: var(--md-sys-color-on-surface-variant);
  }
  .spinner-lg {
    width: 36px;
    height: 36px;
    border: 3px solid var(--md-sys-color-primary-container);
    border-top: 3px solid var(--md-sys-color-primary);
    border-radius: 50%;
    display: inline-block;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
