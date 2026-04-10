<script>
  import './styles/theme.css';
  import { onMount, tick } from 'svelte';
  import { ReadeckClient } from './lib/api/readeck';
  import { ArchiveClient } from './lib/api/archive';

  // Persistence
  let apiToken = localStorage.getItem('readeck_token') || '';
  let serverUrl = localStorage.getItem('readeck_url') || ''; // Use proxy (empty string) by default

  let client = new ReadeckClient(serverUrl, apiToken);
  let archive = new ArchiveClient();

  let bookmarks = [];
  let selectedBookmark = null;
  let candidates = [];
  let loading = false;
  let activeTab = 'archive';
  let showSettings = false;

  async function saveSettings() {
    localStorage.setItem('readeck_token', apiToken);
    localStorage.setItem('readeck_url', serverUrl);
    client = new ReadeckClient(serverUrl, apiToken);
    showSettings = false;
    await loadBookmarks();
  }

  async function loadBookmarks() {
    if (!apiToken) {
      showSettings = true;
      return;
    }
    loading = true;
    try {
      bookmarks = await client.getBrokenBookmarks();
    } catch (e) {
      console.error(e);
      alert('Failed to fetch bookmarks. Check your API token and server connection.');
    } finally {
      loading = false;
    }
  }

  async function selectBookmark(b) {
    selectedBookmark = b;
    candidates = [];
    activeTab = 'archive';
    loading = true;
    try {
      candidates = await archive.findSnapshots(b.url);
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function applyRepair(candidate) {
    if (!confirm(`Apply this snapshot from ${candidate.timestamp}?`)) return;
    
    loading = true;
    try {
      await client.repairBookmark(selectedBookmark.id, candidate.url);
      alert('Bookmark repaired successfully!');
      selectedBookmark = null;
      await loadBookmarks();
    } catch (e) {
      alert(`Repair failed: ${e.message}`);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadBookmarks();
  });
</script>

<div id="app">
  <aside class="nav-panel">
    <header>MyDeck Console</header>
    <nav>
      <div class="nav-item selected">
        <span class="icon">⚠️</span>
        Broken
      </div>
      <div class="nav-item">
        <span class="icon">✅</span>
        Repaired
      </div>
      <div class="spacer" style="flex-grow: 1;"></div>
      <div class="nav-item" on:click={() => showSettings = true}>
        <span class="icon">⚙️</span>
        Settings
      </div>
    </nav>
  </aside>

  <main class="list-panel">
    <header>
      Triage Queue
      {#if loading}<span class="loader"></span>{/if}
    </header>
    <div class="scroll-area">
      {#if bookmarks.length === 0 && !loading}
        <div class="empty-state">No broken bookmarks found.</div>
      {:else}
        {#each bookmarks as b}
          <div class="card {selectedBookmark?.id === b.id ? 'selected' : ''}" on:click={() => selectBookmark(b)}>
            <div class="title">{b.title || 'Untitled'}</div>
            <div class="url">{b.url}</div>
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
          <a href={selectedBookmark.url} target="_blank" class="external-link">Original ↗</a>
        </div>
      </header>
      
      <div class="tabs">
        <div class="tab {activeTab === 'archive' ? 'active' : ''}" on:click={() => activeTab = 'archive'}>Archive.org</div>
        <div class="tab {activeTab === 'preview' ? 'active' : ''}" on:click={() => activeTab = 'preview'}>Live Preview</div>
      </div>
      
      <div class="detail-content">
        {#if activeTab === 'archive'}
          <div class="candidate-list">
            {#if loading && candidates.length === 0}
               <div class="empty-state">Searching archives...</div>
            {:else if candidates.length === 0}
               <div class="empty-state">No snapshots found for this URL.</div>
            {:else}
              {#each candidates as c}
                <div class="candidate-card">
                  <div class="candidate-info">
                    <strong>Snapshot: {c.timestamp.slice(0,4)}-{c.timestamp.slice(4,6)}-{c.timestamp.slice(6,8)}</strong>
                    <p>{c.url.split('/').pop()}</p>
                  </div>
                  <div class="candidate-actions">
                    <button class="btn secondary" on:click={() => window.open(c.url, '_blank')}>Preview ↗</button>
                    <button class="btn primary" on:click={() => applyRepair(c)}>Apply</button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {:else if activeTab === 'preview'}
          <div class="preview-container">
            <div class="preview-warning">Note: Some sites block iframe previews. Use "Preview ↗" instead.</div>
            <iframe src={selectedBookmark.url} title="Preview"></iframe>
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
          <input type="text" bind:value={serverUrl} placeholder="/api" />
          <small>Use <code>/api</code> for local dev proxy.</small>
        </div>
        <div class="field">
          <label>API Token</label>
          <input type="password" bind:value={apiToken} placeholder="Your Readeck API Token" />
        </div>
        <div class="modal-actions">
          <button class="btn" on:click={() => showSettings = false}>Cancel</button>
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
  .nav-item:hover { background-color: rgba(0,0,0,0.05); }
  .nav-item.selected {
    background-color: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }
  .icon { margin-right: 12px; font-size: 1.2rem; }
  
  .scroll-area { overflow-y: auto; flex-grow: 1; padding-bottom: 24px; }
  
  .title-row { display: flex; align-items: baseline; justify-content: space-between; width: 100%; }
  h1 { font-size: 1.25rem; margin: 0; font-weight: 500; }
  .external-link { font-size: 0.8rem; color: var(--md-sys-color-primary); text-decoration: none; }

  .candidate-list { padding: 16px; display: grid; gap: 12px; }
  .candidate-card {
    background: #fff;
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .candidate-info strong { display: block; margin-bottom: 4px; }
  .candidate-info p { margin: 0; font-size: 0.8rem; color: #666; }
  
  .candidate-actions { display: flex; gap: 8px; }
  .btn {
    padding: 8px 16px;
    border-radius: 100px;
    border: 1px solid var(--md-sys-color-outline);
    background: transparent;
    cursor: pointer;
    font-weight: 500;
  }
  .btn.primary {
    background: var(--md-sys-color-primary-container);
    border-color: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }
  
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: #fff;
    padding: 24px;
    border-radius: 28px;
    width: 400px;
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
  }
  .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }

  .preview-container { display: flex; flex-direction: column; height: 100%; }
  .preview-warning { padding: 8px 16px; background: #fffde7; font-size: 0.75rem; border-bottom: 1px solid #e1e2e8; }
  iframe { flex-grow: 1; border: none; }

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
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
