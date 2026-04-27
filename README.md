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

**Legacy path (still supported):** nginx-hosted SPA from `dist/` with proxy rules for `/api/`, `/cdx/`, and `/brave/`.

**Go path (in progress, current migration target):** single `mydeck-console` executable embedding SPA assets and handling `/api`, `/cdx`, `/brave` proxy routes directly. See [docs/go-migration.md](docs/go-migration.md).

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
4. For each archive snapshot, you get three actions:
   - **Preview** — loads the candidate into the Preview tab (iframed; some sites block embedding, in which case use Open).
   - **Open ↗** — opens the candidate in a new tab.
   - **Apply** — runs the Clone / Replace / Deprecate sequence.
5. If archive.org does not have what you want, try **More → Search** or **More → Manual**.
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

Build embedded binary (dev SPA build, fast iteration):

```
./deploy.sh binary-dev
```

This builds SPA assets into `cmd/mydeck-console/web/` then runs `go build`. The binary lands at `./build/mydeck-console`.

Start/stop via the scripts (reads `BRAVE_API_KEY` and `READECK_UPSTREAM` from `.env` automatically):

```
./scripts/start-dev.sh    # listens on 127.0.0.1:8889
./scripts/stop-dev.sh
./scripts/status-dev.sh
```

Or run directly with explicit flags:

```
./build/mydeck-console \
  --readeck-upstream "http://192.168.0.11:8080" \
  --listen "127.0.0.1:8889" \
  --brave-key "$BRAVE_API_KEY"
```

Optional flag: `--version`

## Production deployment (Go binary)

1. Set `BIN_INSTALL_DIR` in `.env` to a stable path outside the project directory (e.g. `/volume1/homes/nate/apps/mydeck-console`). Leave unset to keep the binary in `./build/`.
2. Build and install:
   ```
   ./deploy.sh binary-prod
   ```
   This runs a production SPA build, compiles the binary, and copies it to `BIN_INSTALL_DIR/`.
3. Start:
   ```
   ./scripts/start-prod.sh   # listens on 127.0.0.1:8890
   ```
   The script reads `READECK_UPSTREAM`, `BRAVE_API_KEY`, and `BIN_INSTALL_DIR` from `.env` automatically.
4. If nginx fronts the binary (optional, for HTTPS termination):
   ```nginx
   location / {
       proxy_pass http://127.0.0.1:8890;
   }
   ```
5. Stop: `./scripts/stop-prod.sh`

Deploy script mode reference:

- `./deploy.sh dev|prod|test` — legacy nginx-hosted SPA flow
- `./deploy.sh binary-dev|binary-prod` — Go single-binary flow

---

## Further reading

- [docs/spec.md](docs/spec.md) — full functional spec and Phase 2 roadmap.
- [docs/distribution.md](docs/distribution.md) — how we plan to ship this to testers.
- [TODO.md](TODO.md) — Phase 1 remainders, UI/UX rethink plan, Phase 2 high-level steps.
