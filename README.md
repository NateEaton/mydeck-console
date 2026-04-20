# MyDeck Console

A companion app for [Readeck](https://readeck.org/) that helps you triage and repair broken bookmarks — the ones that accumulate after a bulk import from Pocket or a few years of link rot.

For each broken bookmark, MyDeck Console offers:

- An **Internet Archive (Wayback Machine)** search for snapshots closest to when you saved the page.
- A **Brave Search** fallback when archives do not have what you need.
- A **manual URL** entry path for when you know exactly where the article lives now.
- A built-in **preview** so you can verify the candidate before committing.

When you apply a replacement, MyDeck Console follows Readeck's immutability model: it **clones** the original's metadata onto a new bookmark pointing at the replacement URL, then **deprecates** (archives or deletes) the original. Source-specific labels (`recovered-archive.org`, `replaced-manual`, etc.) make the lineage easy to audit after the fact.

> **Status:** Phase 1 — frontend-only PWA, single-bookmark triage. See [docs/spec.md](docs/spec.md) for the full design and [TODO.md](TODO.md) for what's next.

---

## Requirements

- A running Readeck instance you control.
- A Readeck API token (see below).
- Optional: a Brave Search API key for the search-fallback path.

---

## Setup

### 1. Generate a Readeck API token

1. In Readeck, open **Profile → API Tokens** (or `Settings → Tokens`, depending on your version).
2. Click **Create a new token**.
3. Grant at least `bookmarks:read` and `bookmarks:write` scopes.
4. Copy the token — Readeck will not show it again.

Paste the token (and your Readeck server URL) into the **Settings** modal in MyDeck Console. The app stores it in your browser's `localStorage`; nothing is sent anywhere except to your own Readeck instance.

If you are running MyDeck Console behind the same reverse proxy as Readeck (e.g. the Docker deployment path), you can leave the Server URL blank and it will use the same-origin `/api/` proxy.

### 2. Optional — Brave Search API key

The Search fallback is powered by [Brave Search API](https://brave.com/search/api/). The free tier allows 2000 queries / month, which is plenty for personal cleanup.

1. Sign up at [api.search.brave.com](https://api.search.brave.com/).
2. Create a subscription on the **Data for Search — Free** plan.
3. Copy the generated API key.
4. Put it in your `.env` as `BRAVE_API_KEY=...`. Vite's dev server reads it directly. For prod, run `./render-nginx.sh` to substitute it into the nginx config that ships to the reverse-proxy container (see [Deployment](#3-deployment)).

The key is injected server-side by the `/brave/` proxy and never enters the SPA bundle. Without a Brave key the Archive and Manual flows still work; the Search tab surfaces an error when it tries to call a proxy with no token configured.

### 3. Deployment

**Current (developer workflow):** nginx-hosted SPA with proxy rules for `/api/`, `/cdx/`, and `/brave/`. Example configs live in `nginx/*.conf.template`. Render to working `.conf` files with `./render-nginx.sh` (reads `.env`), then copy those into your nginx container. The rendered `.conf` files are gitignored.

**Planned tester distribution:** a single Go binary with the SPA embedded — no nginx, no `.env` rendering. See [docs/go-migration.md](docs/go-migration.md) for the migration plan and [docs/distribution.md](docs/distribution.md) for the tester-release story that follows it.

Either way, the app needs three reverse-proxy rules:

- `/api/` → your Readeck instance.
- `/cdx/` → `https://web.archive.org/cdx/` (archive.org serves no CORS headers, so the CDX API must be same-origin).
- `/brave/` → `https://api.search.brave.com/` with an injected `X-Subscription-Token` header (Brave is also CORS-blocked for browsers, and this keeps the key server-side).

Phase 1 has no server-side state of its own.

---

## Using it

1. Open the app, paste your Readeck URL and token into **Settings**, hit **Test Connection**, then **Save & Refresh**.
2. The triage queue loads all bookmarks with `has_errors=true` that are not already archived.
3. Select a bookmark. The app fetches archive.org snapshots (and Brave results if the `/brave/` proxy is configured) in parallel.
4. For each archive snapshot, you get three actions:
   - **Preview** — loads the candidate into the Preview tab (iframed; some sites block embedding, in which case use Open).
   - **Open ↗** — opens the candidate in a new tab.
   - **Apply** — runs the Clone / Replace / Deprecate sequence.
5. If archive.org does not have what you want, try **More → Search** or **More → Manual**.
6. After apply, the bookmark disappears from the queue. The new bookmark lives in Readeck with inherited metadata and a `recovered-<source>` label; the original is archived (or deleted) with a matching `replaced-<source>` label.

---

## Development

```
npm install
npm run dev
```

Vite proxies `/api/`, `/cdx/`, and `/brave/` in dev — see [`vite.config.js`](vite.config.js). The Brave proxy reads `BRAVE_API_KEY` from `.env` and injects it as `X-Subscription-Token`.

```
npm run build
```

Outputs to `dist/`.

---

## Further reading

- [docs/spec.md](docs/spec.md) — full functional spec and Phase 2 roadmap.
- [docs/distribution.md](docs/distribution.md) — how we plan to ship this to testers.
- [TODO.md](TODO.md) — Phase 1 remainders, UI/UX rethink plan, Phase 2 high-level steps.
