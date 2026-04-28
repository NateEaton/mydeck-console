<script>
  import { onMount } from 'svelte';
  import {
    MdiInfo,
    MdiLink,
    MdiList,
    MdiChevronDown,
    MdiChevronUp,
    MdiContentCopy,
  } from '../icons/index.js';

  export let client;
  export let serverUrl = '';

  const SERVER_INFO_KEY = 'readeck_server_info';
  const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '';

  const OSS_LIBRARIES = [
    { name: 'Svelte', url: 'https://svelte.dev/' },
    { name: 'Vite', url: 'https://vite.dev/' },
    { name: 'Material Design Icons', url: 'https://pictogrammers.com/library/mdi/' },
  ];

  let serverInfo = null;
  let serverInfoLoading = false;
  let serverInfoError = false;
  let serverUser = '';
  let runtimeMeta = null;
  let appExpanded = false;
  let serverExpanded = false;
  let copyStatus = '';
  let copyTimer = null;

  function readServerInfoCache() {
    try {
      const raw = localStorage.getItem(SERVER_INFO_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.canonical || !parsed.release || !Array.isArray(parsed.features)) return null;
      return {
        canonical: String(parsed.canonical),
        release: String(parsed.release),
        build: String(parsed.build || ''),
        features: parsed.features.map((x) => String(x)),
      };
    } catch {
      return null;
    }
  }

  function writeServerInfoCache(info) {
    localStorage.setItem(SERVER_INFO_KEY, JSON.stringify(info));
  }

  async function loadServerInfo() {
    const cached = readServerInfoCache();
    serverInfo = cached;
    serverInfoError = false;
    serverInfoLoading = cached == null;

    if (!navigator.onLine) {
      serverInfoLoading = false;
      return;
    }
    if (!client) {
      serverInfoLoading = false;
      return;
    }

    try {
      const fresh = await client.getInfo();
      const mapped = {
        canonical: String(fresh?.version?.canonical || ''),
        release: String(fresh?.version?.release || ''),
        build: String(fresh?.version?.build || ''),
        features: Array.isArray(fresh?.features) ? fresh.features.map((x) => String(x)) : [],
      };
      if (mapped.canonical && mapped.release) {
        serverInfo = mapped;
        writeServerInfoCache(mapped);
        serverInfoError = false;
      } else if (!cached) {
        serverInfoError = true;
      }
    } catch {
      if (!cached) serverInfoError = true;
    } finally {
      serverInfoLoading = false;
    }
  }

  async function loadServerUser() {
    if (!client) return;
    try {
      const profile = await client.getProfile();
      serverUser = String(
        profile?.email ||
        profile?.username ||
        profile?.name ||
        profile?.id ||
        ''
      );
    } catch {
      serverUser = '';
    }
  }

  async function loadRuntimeMeta() {
    try {
      const res = await fetch('/__mydeck/meta', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || typeof data !== 'object') return;
      if (!data.runtime) return;
      runtimeMeta = {
        runtime: String(data.runtime),
        version: String(data.version || ''),
      };
    } catch {
      runtimeMeta = null;
    }
  }

  function setCopyStatus(text) {
    copyStatus = text;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyStatus = '';
    }, 1600);
  }

  async function copyText(text, label) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyStatus(`Copied ${label}.`);
    } catch {
      setCopyStatus('Copy failed.');
    }
  }

  function appDetailLines() {
    const runtimeLabel = runtimeMeta?.runtime === 'go-binary' ? 'Go executable' : 'Static web';
    const lines = [`Web bundle version: ${APP_VERSION}`];
    if (BUILD_ID) lines.push(`Build ID: ${BUILD_ID}`);
    lines.push(
      `Host runtime: ${runtimeLabel}${runtimeMeta?.version ? ` (${runtimeMeta.version})` : ''}`,
      `Mode: ${import.meta.env.MODE || 'production'}`,
      `Origin: ${window.location.origin}`,
    );
    return lines;
  }

  $: serverSummaryText = serverInfoLoading && !serverInfo ? 'Loading...'
    : serverInfoError && !serverInfo ? 'Could not load server information'
    : !serverInfo ? 'No server information available'
    : serverInfo.canonical || serverInfo.release || 'Connected';

  function serverDetailLines() {
    if (!serverInfo) return [];
    const build = serverInfo.build ? serverInfo.build : '(stable release)';
    const lines = [];
    if (serverUrl) lines.push(`Server URL: ${serverUrl}`);
    if (serverUser) lines.push(`Signed in as: ${serverUser}`);
    lines.push(`Version: ${serverInfo.canonical}`);
    lines.push(`Release: ${serverInfo.release}`);
    lines.push(`Build: ${build}`);
    lines.push(`Features: ${serverInfo.features.join(', ') || 'none'}`);
    return lines;
  }

  onMount(() => {
    loadServerInfo();
    loadServerUser();
    loadRuntimeMeta();
    return () => clearTimeout(copyTimer);
  });
</script>

<div class="about-wrap">
  <section class="card centered">
    <div class="brand-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="42" height="42">
        <path d={MdiInfo} fill="currentColor" />
      </svg>
    </div>
    <h2>MyDeck Console</h2>
    <p class="version">Version {APP_VERSION}</p>
    <p class="description">
      A Readeck bookmark repair companion focused on triage, candidate review, and safe replacement lineage.
    </p>
  </section>

  <section class="card">
    <h3>Credits</h3>
    <p>MyDeck Console by Nate Eaton.</p>
    <p>Readeck by Francois Revol and contributors.</p>
    <p>Inspired by and derived in spirit from the ReadeckApp lineage.</p>
  </section>

  <section class="card">
    <h3>System Info</h3>

    <button class="collapse-head" on:click={() => (appExpanded = !appExpanded)}>
      <div>
        <div class="subheading">App</div>
        <div class="summary">Version {APP_VERSION}</div>
      </div>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d={appExpanded ? MdiChevronUp : MdiChevronDown} fill="currentColor" />
      </svg>
    </button>
    {#if appExpanded}
      <div class="details">
        {#each appDetailLines() as line}
          <p>{line}</p>
        {/each}
        <button class="copy-btn" on:click={() => copyText(`MyDeck Console\n${appDetailLines().join('\n')}`, 'app details')}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d={MdiContentCopy} fill="currentColor" />
          </svg>
          Copy details
        </button>
      </div>
    {/if}

    <button class="collapse-head" on:click={() => (serverExpanded = !serverExpanded)}>
      <div>
        <div class="subheading">Server</div>
        <div class="summary">{serverSummaryText}</div>
      </div>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d={serverExpanded ? MdiChevronUp : MdiChevronDown} fill="currentColor" />
      </svg>
    </button>
    {#if serverExpanded}
      <div class="details">
        {#if serverInfoLoading && !serverInfo}
          <p>Loading...</p>
        {:else if serverInfoError && !serverInfo}
          <p>Could not load server information.</p>
        {:else if !serverInfo}
          <p>No server information available.</p>
        {:else}
          {#each serverDetailLines() as line}
            <p>{line}</p>
          {/each}
          <button
            class="copy-btn"
            on:click={() => copyText(`Readeck\n${serverDetailLines().join('\n')}`, 'server details')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d={MdiContentCopy} fill="currentColor" />
            </svg>
            Copy details
          </button>
        {/if}
      </div>
    {/if}

    {#if copyStatus}
      <p class="copy-status">{copyStatus}</p>
    {/if}
  </section>

  <section class="card">
    <h3>Project</h3>
    <a class="link-row" href="https://github.com/NateEaton/mydeck-console" target="_blank" rel="noreferrer noopener">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d={MdiLink} fill="currentColor" /></svg>
      <span>MyDeck Console repository</span>
    </a>
    <a class="link-row" href="https://github.com/jensomato/ReadeckApp" target="_blank" rel="noreferrer noopener">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d={MdiLink} fill="currentColor" /></svg>
      <span>Original ReadeckApp repository</span>
    </a>
    <a class="link-row" href="https://codeberg.org/readeck/readeck" target="_blank" rel="noreferrer noopener">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d={MdiLink} fill="currentColor" /></svg>
      <span>Readeck server repository</span>
    </a>
  </section>

  <section class="card">
    <h3>License</h3>
    <p>
      MyDeck Console is released as open source. See repository metadata for the effective license text and notices.
    </p>
    <p>Readeck server is licensed under AGPL-3.0.</p>
  </section>

  <section class="card">
    <h3>Open Source Libraries</h3>
    {#each OSS_LIBRARIES as lib}
      <a class="link-row" href={lib.url} target="_blank" rel="noreferrer noopener">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d={MdiList} fill="currentColor" /></svg>
        <span>{lib.name}</span>
      </a>
    {/each}
  </section>
</div>

<style>
  .about-wrap {
    width: 100%;
    max-width: 780px;
    margin: 0 auto;
    padding: 16px;
    box-sizing: border-box;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--md-sys-color-surface-variant);
    border-radius: var(--md-sys-radius-medium);
    padding: 18px 20px;
  }

  .centered {
    text-align: center;
  }

  .brand-icon {
    color: var(--md-sys-color-primary);
    margin-bottom: 8px;
  }

  h2 {
    margin: 0 0 4px;
    font-size: 1.22rem;
  }

  .version {
    margin: 0 0 10px;
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.9rem;
  }

  .description {
    margin: 0;
    color: var(--md-sys-color-on-surface);
    line-height: 1.5;
  }

  h3 {
    margin: 0 0 10px;
    font-size: 0.98rem;
  }

  p {
    margin: 0 0 8px;
    line-height: 1.45;
  }

  p:last-child {
    margin-bottom: 0;
  }

  .collapse-head {
    width: 100%;
    border: 1px solid var(--md-sys-color-outline);
    background: transparent;
    border-radius: 12px;
    padding: 10px 12px;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: left;
    color: var(--md-sys-color-on-surface);
    font: inherit;
    cursor: pointer;
  }

  .collapse-head:hover {
    background: var(--bg-hover);
  }

  .subheading {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--md-sys-color-on-surface-variant);
    margin-bottom: 2px;
  }

  .summary {
    font-size: 0.92rem;
  }

  .details {
    background: var(--md-sys-color-surface-variant);
    border-radius: 12px;
    padding: 10px 12px;
    margin: -2px 0 10px;
  }

  .details p {
    margin: 0 0 6px;
    font-size: 0.86rem;
    word-break: break-word;
  }

  .copy-btn {
    margin-top: 6px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--md-sys-color-outline);
    background: transparent;
    color: var(--md-sys-color-on-surface);
    border-radius: 999px;
    padding: 6px 12px;
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .copy-btn:hover {
    background: var(--bg-hover);
  }

  .copy-status {
    margin-top: 6px;
    font-size: 0.82rem;
    color: var(--md-sys-color-primary);
  }

  .link-row {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--md-sys-color-on-surface);
    text-decoration: none;
    padding: 7px 0;
  }

  .link-row:hover span {
    text-decoration: underline;
  }
</style>
