# Agent Guide — mydeck-console

This file is the portable source of truth for any AI assistant working in this
repo. Claude-specific notes live in [CLAUDE.md](CLAUDE.md), which is a thin
wrapper that defers to this document.

## What this project is

**mydeck-console** is a frontend-only Svelte 5 + Vite SPA (not SvelteKit) that
helps Readeck users repair bookmarks broken by a Pocket import — expired links,
redirects, missing content. It reads and writes against a running Readeck
instance via the user's API token. The user is a Synology home-lab operator
self-hosting Readeck in Docker.

The Phase 1.5 UI/UX refactor is largely complete — the shell redesign (hamburger
drawer, Bookmark/Preview views, unified candidate list, scoring rewrite,
Recovered/Replaced/Ignored views, OAuth PKCE) is done. The Go single-binary
runtime scaffold is also done (`cmd/`, `internal/`). Remaining work before the
first tester release: a few deferred UX items (Brave key in Settings, persist
repair state), Go tests, cross-compile, and GitHub Actions release workflow. See
[docs/spec.md](docs/spec.md) for the full spec, [TODO.md](TODO.md) for the
outstanding checklist, and [docs/go-migration.md](docs/go-migration.md) for the
binary work.

## Ground rules

These are non-negotiable unless the user explicitly lifts them for a task:

1. **The user handles all git writes.** Do not run `git commit`, `git push`,
   `git add`, `git reset --hard`, or any destructive git operation. Read-only
   git (`git status`, `git log`, `git diff`) is fine.
2. **The user handles all app builds and deploys.** Do not run `npm run build`,
   `npm run dev` (except to type-check a change via the user's running process),
   `make build`, or `./deploy.sh`. Edit the files and tell the user what to run.
3. **Never commit secrets.** `BRAVE_API_KEY` lives in `.env` (gitignored) and
   gets injected server-side by the `/brave/` proxy. It must never appear in
   client code, bundled output, or committed configs. If you see it in
   `src/**` or a tracked file, flag it immediately.
4. **Edit, don't rewrite.** Prefer `Edit` over `Write` for existing files.
   Don't reorganize unless asked.
5. **Ask before scope creep.** If a task hints at a larger refactor, surface
   the tradeoff and wait. The user drives the architecture.

## Architecture, in one screen

```
Browser (Svelte SPA)
    │
    ▼  same-origin requests only
Go binary  (see cmd/mydeck-console/, internal/)
    │
    ├── /api/     → Readeck upstream (user's own instance)
    ├── /cdx/     → web.archive.org (CDX API; 120s timeout, no CORS upstream)
    └── /brave/   → api.search.brave.com (X-Subscription-Token injected here)
```

All three upstream APIs are reached via a same-origin reverse proxy. The SPA
only ever speaks to relative paths. Two reasons this matters:

- **CORS.** archive.org and Brave both block browser-origin requests.
- **Secret hygiene.** The Brave API key is injected by the proxy, never shipped
  to the client.

### Key files and what they own

| File / dir                         | Purpose                                               |
|------------------------------------|-------------------------------------------------------|
| [src/main.js](src/main.js)         | Mounts AppV2 into `#app`. No flags, no v1 fallback. |
| [src/ui-v2/AppV2.svelte](src/ui-v2/AppV2.svelte) | Drawer + TopAppBar shell; OAuth callback handling, sign in/out, view routing. |
| [src/ui-v2/components/](src/ui-v2/components/)   | View components: TriageList, BookmarkView, PreviewView, SignInView, SettingsView, NavDrawer, TopAppBar, dialogs. |
| [src/lib/api/readeck.js](src/lib/api/readeck.js) | Readeck client: list, repair (Clone/Replace/Deprecate). Always same-origin (`/api/...` through proxy). |
| [src/lib/api/oauth.js](src/lib/api/oauth.js)     | OAuth 2.0 Auth Code Flow + PKCE: client registration, sign-in redirect, callback exchange, revoke. |
| [src/lib/api/archive.js](src/lib/api/archive.js) | archive.org CDX client + `ArchiveRateLimitError` |
| [src/lib/api/brave.js](src/lib/api/brave.js)     | Brave Search client (goes through `/brave/` proxy) |
| [src/lib/cache.js](src/lib/cache.js)             | IndexedDB candidate cache (`CACHE_STALE_MS` gated) + ignored-bookmark store. |
| [src/lib/scoring.js](src/lib/scoring.js)         | Candidate ranking: URL-structural fast-path, archive snapshot scoring, Brave augmentation, merge. |
| [src/lib/readeckErrors.js](src/lib/readeckErrors.js) | Classifier over the extraction-log text → typed error for the BookmarkView header. |
| [src/lib/config.js](src/lib/config.js)           | Label constants, cache TTL. **No secrets.**          |
| [vite.config.js](vite.config.js)                 | Dev-server proxy config for `/api`, `/cdx`, `/brave` |
| [.env.example](.env.example)                     | Shows `READECK_UPSTREAM`, `BRAVE_API_KEY` |
| [cmd/mydeck-console/main.go](cmd/mydeck-console/main.go) | Go binary entry point: flag parsing, server startup, graceful shutdown |
| [internal/server/](internal/server/)             | `server.go` (http.Server), `routes.go` (route table), `static.go` (SPA fallback) |
| [internal/proxy/](internal/proxy/)               | `readeck.go`, `archive.go`, `brave.go` — three `httputil.ReverseProxy` handlers |
| [internal/config/config.go](internal/config/config.go) | CLI flags + env fallback (`--listen`, `--readeck-upstream`, `--brave-key`) |
| [Makefile](Makefile)                             | `spa`, `build`, `build-all`, `run-dev`, `clean` — local builds and CI cross-compile |
| [scripts/](scripts/)                             | `start-prod.sh`, `stop-prod.sh`, `status-prod.sh`, `run-instance.sh` |

## Conventions learned the hard way

Write these down and don't re-discover them:

- **Readeck POST /bookmarks is async.** It returns 202 with a `Bookmark-Id`
  header (and a `Location` header). Pass labels **at creation time** — adding
  them after the response returns races the extraction worker and loses labels
  that touch extraction-derived fields.
- **Readeck pagination is offset + `Total-Count` header.** Filter with
  `&is_archived=false` to exclude already-handled bookmarks from the triage
  queue.
- **archive.org CDX has no CORS headers** and is frequently slow. Rate limits
  manifest as 429/509 **or** as an HTML body containing "exceeded the allowed
  page load frequency." Detect both. Timeout at 120s to avoid spurious 504s.
- **Brave Search is CORS-blocked for browsers.** The `X-Subscription-Token`
  must be injected by the proxy layer (nginx or Vite dev server or the future
  Go binary). The client just hits `/brave/res/v1/web/search?...` and never
  sees the key. 401/403 from `/brave/` means the proxy is missing the token —
  surface that as a config problem, not a user error.
- **Label taxonomy is source-specific.** Recovery labels are
  `recovered-archive.org`, `recovered-search`, `recovered-manual`. Deprecation
  labels are `replaced-archive.org`, `replaced-search`, `replaced-manual`.
  There is **no** generic `replacement` label — it was removed. When carrying
  labels forward during repair, strip legacy `replacement`, `recovered-*`,
  `replaced-*`, and `replaced` from the carried set.
- **CSP is `connect-src 'self'`.** All network calls are same-origin. Do not
  add direct fetches to external hosts; add a proxy route.
- **Svelte 5 in legacy mode.** We use classic reactivity and `on:click`, not
  runes. Don't migrate to runes without discussing.
- **Auth is OAuth 2.0 Authorization Code Flow with PKCE.** Sign-in via
  `SignInView` — user enters Readeck server URL, SPA registers an ephemeral
  client (RFC 7591), redirects to `<server>/authorize`, exchanges the
  returned code at `/api/oauth/token`. Access token + token id + scopes live
  in `localStorage` (`readeck_access_token`, `readeck_token_id`,
  `readeck_token_scope`); the user-entered server URL lives in `readeck_url`
  for display only — **never** use it as the API base URL, all `/api/*`
  calls must go through the same-origin proxy. Sign-out best-effort revokes
  via `POST /api/profile/tokens/{id}/delete`. Tokens are long-lived (no
  refresh flow). Legacy `readeck_token` (v1 personal access token) is read
  as a fallback during migration but cleared on first OAuth sign-in.

## Common tasks — how to approach them

- **Add a new proxy route.** Add it to `vite.config.js` for dev and to
  `internal/server/routes.go` + the appropriate `internal/proxy/` handler for
  the Go binary. Use the existing `/brave/` handler as the template for header
  injection.
- **Change the label taxonomy.** Edit `src/lib/config.js` constants and the
  carry-forward filter in `src/lib/api/readeck.js`. Update
  [docs/spec.md](docs/spec.md).
- **Touch preview behavior.** The iframe remount trick uses Svelte's `{#key}`
  directive. The preview footer is `position: sticky; bottom: 0` with
  `flex-wrap: wrap` so Apply stays visible.
- **Add settings.** Settings live in
  [src/ui-v2/components/SettingsView.svelte](src/ui-v2/components/SettingsView.svelte).
  Persist via `localStorage`; do not introduce a store library for this.

## Sub-agents

The user has a Pro subscription — 5-hour and weekly rate limits matter. Default
is **do not spawn sub-agents**. When they do help:

- **Serial only, never parallel.** Parallel spawns burn the quota fast.
- **Announce before spawning** so the user can veto.
- **Good cases:** broad Explore/Grep sweeps across the repo, scoped one-shots
  a Sonnet-class model can finish without iteration.
- **Bad cases:** tight iterative work, anything where Opus-level reasoning is
  load-bearing, anything that would benefit from seeing the user's reactions.

## What's next (as of 2026-04-29)

1. ~~**Phase 1 verification:** confirm Brave Search works end-to-end.~~ Done.
2. ~~**Phase 1.5 UX refactor**~~ Largely done. Shell redesign, Bookmark/Preview
   views, unified candidate list, scoring rewrite, Recovered/Replaced/Ignored
   views, OAuth PKCE, User Guide, About — all complete. Remaining deferred items:
   Brave Search API key in Settings, persist in-flight repair state. See [TODO.md](TODO.md).
3. **Go single-binary migration** — [docs/go-migration.md](docs/go-migration.md). **Runtime scaffold done.**
   `cmd/`, `internal/server`, `internal/proxy`, `internal/config` are implemented.
   nginx templates and deploy.sh are gitignored; Makefile added.
   Remaining: tests, cross-compile, GitHub Actions release workflow.
   The full refactored SPA will be embedded before the tester release.
4. First tester release off the binary.
5. Conditional follow-ups: advanced HTML injection, SearXNG, capture-selection
   — only if tester feedback warrants.
