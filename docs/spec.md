# Functional Design Specification — MyDeck Console

**Project:** MyDeck Console (Readeck Bookmark Repair Companion)
**Architecture:** Two-Phase (Phase 1: Frontend PWA PoC → Phase 2: PWA + Go Backend)
**Status:** Phase 1 in tester / validation phase.

This document supersedes `draft_spec.md` and is updated with findings from Phase 1 implementation.

---

## 1. Overview

MyDeck Console is a standalone companion app that helps users identify, reconcile, and repair broken bookmarks stored in Readeck. It is designed primarily for post-import cleanup (e.g. the hundreds-to-thousands of dead links that survive a Pocket export → Readeck import).

Recovery is driven by a dual-source strategy:
- **Historical snapshots** from the Internet Archive CDX API.
- **Live web search** (Brave Search; SearXNG planned for Phase 2).

Because Readeck enforces URL immutability once a bookmark is saved, the system uses a **Clone, Replace, Deprecate** paradigm to preserve data integrity and metadata lineage.

---

## 2. Implementation Strategy

### Phase 1 — Frontend-Only PWA (current)

- 100% client-side Svelte 5 + Vite SPA (not SvelteKit).
- Browser talks to Readeck, archive.org CDX, and Brave Search through a **same-origin reverse proxy** (nginx in prod, Vite's proxy in dev). None of the three work from a browser directly:
  - Readeck would require CORS configuration on the Readeck instance itself.
  - archive.org CDX serves no CORS headers.
  - Brave Search is CORS-blocked and requires an `X-Subscription-Token` header that must stay off the client.
- The `/brave/` proxy injects the subscription token server-side (sourced from `.env`, substituted into nginx config via `./render-nginx.sh`), so the token never enters the SPA bundle.
- Single-bookmark triage (one at a time). No batch processing.
- Relies on Readeck's native extraction engine via `POST /bookmarks`.
- Local persistence:
  - **IndexedDB** for the cached broken-bookmark list (cleanup review can take weeks; caching avoids re-fetching on every session).
  - **localStorage** for user settings (Readeck URL, API token).

### Phase 2 — Production System (Go backend + PWA)

- Go backend proxies all external APIs, handles rate limiting, and orchestrates batch jobs.
- Advanced extraction: multipart HTML injection (mirrors Readeck's browser extension) to strip the Wayback toolbar and preserve images offline.
- Pre-operation `GET /bookmarks/sync?with_json=true` backup before batch writes.
- Concurrent processing via worker pools.
- Dry-run mode.

---

## 3. Core Principles

1. **Immutability first.** Original bookmarks are never URL-mutated. Recovered content becomes a new bookmark.
2. **Metadata fidelity.** The replacement inherits `created`, `is_marked`, `read_progress`, and the original's user labels (minus any system markers).
3. **User-controlled disposition.** No automatic deletion. Every apply is explicitly confirmed; disposition (archive vs. delete) is user-controlled.
4. **Transparency.** Source (archive / search / manual), timestamp delta, and match reasoning are surfaced in the UI.
5. **Idempotent-ish re-repair.** If a user repairs a prior replacement, carried-over labels are filtered so old source/deprecation markers do not accumulate.

---

## 4. Authentication

### Phase 1 — Personal Access Token

- User enters their Readeck server URL and API token into the in-app Settings modal.
- Stored in `localStorage`. No server-side state.
- Settings modal also provides a Test Connection button that hits `GET /api/profile`.

### Phase 2 — OAuth 2.0 with PKCE (optional)

- Makes public distribution friendlier.
- Scopes: `bookmarks:read`, `bookmarks:write`.

---

## 5. Providers & Data Sources

### 5.1 Readeck

- `GET /api/profile` — connection test.
- `GET /api/bookmarks?has_errors=true&is_archived=false&limit=100&offset=N` — broken bookmark list.
  - **Paginated.** Loop using `Total-Count` / `Total-Pages` headers until all pages are fetched (confirmed discovery: default page size ~50).
  - `is_archived=false` excludes already-handled originals (we archive them on repair by default).
- `GET /api/bookmarks/{id}` — fetch full metadata for cloning.
- `POST /api/bookmarks` — **asynchronous**. Returns `202 Accepted`.
  - New id comes from the `Bookmark-Id` or `Location` header, **not** the body (body may be empty).
  - Extraction happens server-side on a queue; the bookmark exists but may not be fully loaded immediately.
- `PATCH /api/bookmarks/{id}` — supports `labels` (full replace), `add_labels`, `remove_labels`, `is_marked`, `read_progress`, `is_archived`.
- `DELETE /api/bookmarks/{id}`.

### 5.2 Internet Archive CDX

- Endpoint: `https://web.archive.org/cdx/search/cdx?...`
- **No CORS headers.** Must be reached via reverse proxy (`/cdx/` → `web.archive.org`).
- Rate-limit behavior: responses can be `429`, `509`, or a `200` with an HTML body containing "You have exceeded the allowed page load frequency". All three cases are handled via a typed `ArchiveRateLimitError` and surfaced in the Archive tab with a Retry button.

### 5.3 Brave Search (Phase 1) / SearXNG (Phase 2)

- Brave: free tier 2000 queries/month, clean REST JSON.
- Accessed via same-origin `/brave/` proxy. `X-Subscription-Token` is injected by the proxy (nginx: `proxy_set_header` reading `${BRAVE_API_KEY}` rendered from `.env`; Vite dev server: `proxy.on('proxyReq', ...)` reading `loadEnv`). The SPA ships zero Brave credentials.
- SearXNG planned for privacy-conscious self-hosters (Phase 2 moves this behind the Go backend).

---

## 6. Core Workflow — Clone, Replace, Deprecate

When the user applies a candidate, the app executes:

1. **Read original** — `GET /api/bookmarks/{oldId}`.
2. **Compute inherited labels** — filter the original's labels to drop prior system markers (`recovered-*`, `replaced-*`, the legacy `replacement` / `replaced` tags), then append this run's source-specific recovery label.
3. **Create replacement** — `POST /api/bookmarks` with:
   - `url` — the new URL.
   - `created` — copied exactly from the original.
   - `labels` — computed in step 2. **Labels are passed at creation time**, not in a follow-up PATCH. This was a hard-won discovery: because `POST` is async, PATCHing labels on a still-loading bookmark races with server-side extraction and silently loses the labels.
4. **Transfer remaining metadata** — `PATCH /api/bookmarks/{newId}` with `is_marked` and `read_progress`. These fields do not race.
5. **Deprecate the original** — based on disposition:
   - **Archive (default):** `PATCH /api/bookmarks/{oldId}` with `add_labels: [deprecationLabel]` and `is_archived: true`. Uses `add_labels` (not `labels`) to avoid blowing away unrelated user labels.
   - **Delete:** `DELETE /api/bookmarks/{oldId}`.

Post-apply: remove from IndexedDB cache and in-memory list.

### 6.1 Label Taxonomy (Phase 1)

Source-specific on purpose — makes forensic review easy after the fact.

| Label | Applied to | Meaning |
|---|---|---|
| `recovered-archive.org` | new bookmark | Replacement URL came from an IA snapshot. |
| `recovered-search` | new bookmark | Replacement came from Brave / SearXNG. |
| `recovered-manual` | new bookmark | User pasted the URL. |
| `replaced-archive.org` | old bookmark | Deprecated because an IA replacement superseded it. |
| `replaced-search` | old bookmark | Deprecated via search result. |
| `replaced-manual` | old bookmark | Deprecated via manual URL. |

A single `replacement` marker was tried early and removed — redundant with the source-specific `recovered-*` label.

---

## 7. User Interface (Current Phase 1 State)

Three-pane Material-ish layout with system light/dark theme (`color-scheme: light dark` + `prefers-color-scheme` overrides in `src/styles/theme.css`).

### 7.1 Left Navigation
- "Broken" (only filter currently active).
- Refresh.
- Settings (gear) → modal with server URL, API token, Test Connection.

### 7.2 Center List — Triage Queue
- Cards show title, favorite star, URL, Saved date, Published date (if present), up to 3 labels + `+N` overflow.
- Selection highlights the card.
- Sourced from IndexedDB on mount; auto-refreshes if `lastSync` is older than `CACHE_STALE_MS` (15 minutes) or cache is empty.

### 7.3 Right Detail Panel

Tabs: **Archive.org**, **Preview**, **More ▾** (dropdown to Search / Manual).

- **Archive.org tab** — split into two sections:
  - *Closest to save date* — the snapshot closest before the bookmark's `created` timestamp plus the closest after. Those bracket the save date and are by far the most likely matches.
  - *All snapshots* — the rest, ordered by timestamp. Users reported that "most recent first" was misleading because recent snapshots of dead URLs are often broken landing pages.
  - Each card has Preview (loads into Preview tab), Open ↗ (new tab), Apply.
  - Rate-limit state is a dedicated empty-state with a Retry button.
- **Preview tab** — iframe of the selected candidate (or original URL if none selected). Loading spinner overlay, cleared on iframe `load`. Uses `{#key previewUrl}` to force iframe remount on URL change. Sticky footer with Open ↗ + Apply.
- **More ▾ → Search** — scored Brave results with pill (high/medium/low) and match reason.
- **More ▾ → Manual** — paste-any-URL input + Apply Manual.

See `docs/ux-redesign.md` (TBD) for the workflow-oriented rethink planned for the next round.

---

## 8. Candidate Scoring

Search results only. Implemented in `src/lib/scoring.js`.

| Band | Range | Meaning |
|---|---|---|
| High | 80–100 | Exact title match + same domain. |
| Medium | 50–79 | Strong title similarity, different domain (common when articles migrate). |
| Low | <50 | Keyword overlap only; manual verification required. |

Archive candidates are **not** scored numerically — they are ranked structurally by delta from the bookmark's `created` date.

---

## 9. Persistence & Caching

- IndexedDB object stores: `bookmarks` (keyPath `id`, index on `cachedAt`) and `meta` (keyPath `key`, used for `lastSync`).
- On mount: hydrate from cache → decide staleness → refresh if needed.
- On successful repair: delete from cache and in-memory list immediately.

---

## 10. Deployment (Phase 1)

Distribution to testers is covered in [distribution.md](distribution.md). Summary:

- **Docker image** (primary) — nginx + built SPA + envsubst'd proxy config. Single env var: `READECK_UPSTREAM`. Published to GHCR per tag.
- **Static bundle** (secondary) — `dist/` tarball attached to each GitHub Release for users running their own reverse proxy.

Runtime requires three proxy passes: `/api/` → Readeck, `/cdx/` → `web.archive.org`, and `/brave/` → `api.search.brave.com` (with injected `X-Subscription-Token`).

---

## 11. Phase 2 Enhancements (Roadmap)

### 11.1 Go backend

- All external API traffic (Readeck, IA, Brave/SearXNG) flows through the backend.
- Handles rate limiting centrally (especially IA).
- Hosts OAuth PKCE dance if we go that route.

### 11.2 Advanced HTML Injection

Instead of handing an `archive.org` URL to `POST /bookmarks`:

1. Backend fetches the raw snapshot HTML from IA.
2. Strips Wayback toolbar / JS injection.
3. Concurrently downloads inline images.
4. Uploads a clean `multipart/form-data` payload to Readeck (same shape as the browser extension).

Result: the saved bookmark renders like the original article, offline-safe, without Wayback chrome.

### 11.3 Safe batch operations

- `GET /bookmarks/sync?with_json=true` snapshot saved to disk before every batch.
- Worker pool processes 10–20 bookmarks in parallel.
- Dry-run mode shows the planned deltas (creates, tags, archives, deletes) before commit.

### 11.4 Capture Selection

User highlights text in the Preview iframe → "Capture Selection" posts that HTML fragment to the backend, which wraps and ships it to Readeck. Useful when a live search result's markup is unreadable but a clean excerpt exists.

### 11.5 SearXNG support

User-supplied SearXNG instance URL; backend proxies the JSON-format query.

---

## 12. Open Questions

- Auth model for Phase 2 distribution — OAuth vs. continue with pasted API tokens.
- Should the app bundle a Brave API key for testers, or require BYO? (Leaning BYO.)
- Do we want a server-side "repair history" log in Phase 2, or is the label taxonomy sufficient audit trail?
