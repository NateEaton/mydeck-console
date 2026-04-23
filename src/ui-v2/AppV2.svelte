<script>
  import '../styles/theme.css';
  import { onMount, onDestroy, tick } from 'svelte';
  import { ReadeckClient } from '../lib/api/readeck';
  import * as cache from '../lib/cache';
  import { CACHE_STALE_MS } from '../lib/config';

  import TopAppBar from './components/TopAppBar.svelte';
  import NavDrawer from './components/NavDrawer.svelte';
  import TriageList from './components/TriageList.svelte';
  import DeleteSnackbar from './components/DeleteSnackbar.svelte';

  const WIDE_MIN = 768;

  let apiToken = localStorage.getItem('readeck_token') || '';
  let serverUrl = localStorage.getItem('readeck_url') || '';
  let client = new ReadeckClient(serverUrl, apiToken);

  let bookmarks = [];
  let loading = false;
  let activeView = 'triage';

  let isWide = typeof window !== 'undefined' ? window.innerWidth >= WIDE_MIN : true;
  let drawerOpen = false; // only meaningful in modal (narrow) mode

  let pendingDelete = null; // { id, title, bookmark }
  let lastCommittedAt = 0;

  $: drawerVariant = isWide ? 'permanent' : 'modal';
  $: drawerIsOpen = isWide ? true : drawerOpen;

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

  function onMenuToggle() {
    drawerOpen = !drawerOpen;
  }

  function onNavSelect(event) {
    activeView = event.detail.view;
    if (!isWide) drawerOpen = false;
  }

  function onScrim() {
    drawerOpen = false;
  }

  function stageDelete(event) {
    const { bookmarkId, title } = event.detail;
    const target = bookmarks.find(b => b.id === bookmarkId);
    if (!target) return;
    if (pendingDelete) commitDelete();
    pendingDelete = { id: bookmarkId, title, bookmark: target };
    // Avoid the click that opened this snackbar being the one that commits it.
    lastCommittedAt = Date.now();
    tick().then(attachOutsideListener);
  }

  function undoDelete() {
    pendingDelete = null;
    detachOutsideListener();
  }

  function commitDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    // TODO: wire real DELETE /bookmarks/{id} in the next increment.
    console.log('commit delete', id);
    bookmarks = bookmarks.filter(b => b.id !== id);
    pendingDelete = null;
    detachOutsideListener();
  }

  let outsideHandler = null;
  function attachOutsideListener() {
    if (outsideHandler) return;
    outsideHandler = (event) => {
      // Ignore the mouse-up/click immediately following the Delete press that staged this.
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
    if (!apiToken) return;
    const lastSync = await hydrateFromCache();
    const stale = !lastSync || Date.now() - lastSync > CACHE_STALE_MS;
    if (stale || bookmarks.length === 0) {
      await refresh();
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize);
    detachOutsideListener();
  });

  const VIEW_TITLES = {
    triage:    'Triage',
    recovered: 'Recovered',
    replaced:  'Replaced',
    settings:  'Settings',
    guide:     'User Guide',
    about:     'About',
  };
</script>

<div class="shell" class:wide={isWide}>
  {#if isWide}
    <NavDrawer
      variant="permanent"
      active={activeView}
      open={true}
      on:select={onNavSelect}
    />
  {:else if drawerOpen}
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
      title={VIEW_TITLES[activeView] || activeView}
      showMenu={!isWide}
      on:menu-toggle={onMenuToggle}
    />

    <div class="content-scroll">
      {#if activeView === 'triage'}
        {#if !apiToken}
          <div class="empty-pad">
            <p>Configure your Readeck server and API token in the current console (without <code>?v2=1</code>) to get started.</p>
          </div>
        {:else}
          <TriageList
            bookmarks={bookmarks}
            loading={loading}
            pendingDeleteId={pendingDelete?.id ?? null}
            on:delete={stageDelete}
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
    background: var(--bg-list-panel);
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
</style>
