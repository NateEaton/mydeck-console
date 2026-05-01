# MyDeck Console

A companion app for [Readeck](https://readeck.org/) that helps you triage and repair broken bookmarks — the ones that accumulate after a bulk import from Pocket or a few years of link rot.

For each broken bookmark, MyDeck Console offers:

- An **Internet Archive (Wayback Machine)** search for snapshots closest to when you saved the page.
- A **Brave Search** fallback when archives do not have what you need.
- A **manual URL** entry path for when you know exactly where the article lives now.
- A built-in **preview** so you can verify the candidate before committing.

When you apply a replacement, MyDeck Console follows Readeck's immutability model: it **clones** the original's metadata onto a new bookmark pointing at the replacement URL, then **deprecates** (archives or deletes) the original. Source-specific labels (`recovered-archive.org`, `replaced-manual`, etc.) make the lineage easy to audit after the fact.

> **Status:** Phase 1.5 in progress. The Svelte UI refactor is active and the Go single-binary migration is underway. See [docs/spec.md](docs/spec.md), [docs/go-migration.md](docs/go-migration.md), and [TODO.md](TODO.md) for current scope.

---

## Requirements

- A running Readeck instance you control.
- Optional: a Brave Search API key for the search-fallback path.
- For Go-binary builds: Go 1.22+.

---

## Setup

### 1. Sign in with Readeck OAuth (PKCE)

MyDeck Console now uses OAuth 2.0 Authorization Code Flow with PKCE.

1. Open the app and go to **Sign in**.
2. Enter your Readeck server URL.
3. Complete authorization in Readeck and return to the app.

Access token metadata and scope are stored in browser `localStorage`. All API calls still go through same-origin `/api/*`.

### 2. Optional — Brave Search API key

The Search fallback is powered by [Brave Search API](https://brave.com/search/api/). The free tier allows 2000 queries / month, which is plenty for personal cleanup.

1. Sign up at [api.search.brave.com](https://api.search.brave.com/).
2. Create a subscription on the **Data for Search — Free** plan.
3. Copy the generated API key.
4. Put it in your `.env` as `BRAVE_API_KEY=...`. Vite's dev server reads it directly. For Go binary runs, pass `--brave-key` (or set `BRAVE_API_KEY`).

The key is injected server-side by the `/brave/` proxy and never enters the SPA bundle. Without a Brave key the Archive and Manual flows still work; the Search tab surfaces an error when it tries to call a proxy with no token configured.

### 3. Deployment options

**Go binary (primary):** single `mydeck-console` executable embedding the SPA. Handles all three proxy routes directly — no other runtime dependencies. Optionally front with any TLS-terminating reverse proxy.

**SPA-only path:** if you already have a web server that can provide the three proxy routes, build the SPA with `make spa` and serve the `dist/` directory from it.

Both paths require the same logical routes:

- `/api/` → your Readeck instance.
- `/cdx/` → `https://web.archive.org/cdx/` (archive.org serves no CORS headers, so the CDX API must be same-origin).
- `/brave/` → `https://api.search.brave.com/` with an injected `X-Subscription-Token` header (Brave is also CORS-blocked for browsers, and this keeps the key server-side).

The app has no server-side state of its own.

---

## Using it

1. Open the app and complete OAuth sign-in.
2. The triage queue loads all bookmarks with `has_errors=true` that are not already archived.
3. Select a bookmark. The app fetches archive.org snapshots (and Brave results if the `/brave/` proxy is configured) in parallel.
4. Tap a candidate to open the Preview view. From there, use the top bar to **Apply** (✓), **Open ↗** in a new tab, or **Delete**.
5. Brave Search results are shown alongside archive candidates automatically when `/brave/` is configured. For a specific URL, use the **⋮ overflow menu → Manual URL** from the Bookmark view.
6. After apply, the bookmark disappears from the queue. The new bookmark lives in Readeck with inherited metadata and a `recovered-<source>` label; the original is archived (or deleted) with a matching `replaced-<source>` label.

---

## Development (SPA)

```
npm install
npm run dev
```

Vite proxies `/api/`, `/cdx/`, and `/brave/` in dev — see [`vite.config.js`](vite.config.js). The Brave proxy reads `BRAVE_API_KEY` from `.env` and injects it as `X-Subscription-Token`.

```
npm run build
```

Outputs to `dist/`.

## Development (Go binary)

SPA development uses `npm run dev` (Vite, no binary needed). To test the binary itself locally, build with:

```
make build
```

The binary lands at `./build/mydeck-console`. Run it via the scripts:

```
./scripts/start-dev.sh    # listens on 127.0.0.1:8889
./scripts/stop-dev.sh
./scripts/status-dev.sh
```

Or run directly with explicit flags:

```
./build/mydeck-console \
  --readeck-upstream "http://192.168.0.11:8888" \
  --listen "127.0.0.1:8889" \
  --brave-key "$BRAVE_API_KEY"
```

Optional flag: `--version`

## Production deployment (Go binary)

1. Build the binary:
   ```
   make build
   ```
   The binary lands at `./build/mydeck-console`.

2. Copy the binary to a stable location. In the same directory, create a `.env`:
   ```
   READECK_UPSTREAM=http://192.168.0.11:8888
   BRAVE_API_KEY=your-key-here
   ```

3. Run directly, or copy the [`scripts/`](scripts/) bash helpers alongside the binary and use those:
   ```
   # Direct
   ./mydeck-console --readeck-upstream http://192.168.0.11:8888 --listen :8890

   # Via scripts (read config from .env in the same directory)
   ./start-prod.sh    # listens on 127.0.0.1:8890
   ./stop-prod.sh
   ./status-prod.sh
   ```

4. Optional — reverse proxy for TLS: point any TLS-terminating proxy at the binary's port. No special headers required.

5. Auto-start on boot: add the binary (or `start-prod.sh`) to your system's init mechanism.

---

## Further reading

- [docs/spec.md](docs/spec.md) — full functional spec and Phase 2 roadmap.
- [docs/distribution.md](docs/distribution.md) — how we plan to ship this to testers.
- [TODO.md](TODO.md) — Phase 1 remainders, UI/UX rethink plan, Phase 2 high-level steps.
