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

Phase 1 (the current shell) is done. The repair workflow — triage queue, archive
rediscovery, preview, Clone/Replace/Deprecate — works end to end. See
[docs/spec.md](docs/spec.md) for the full Phase 1 spec, [TODO.md](TODO.md) for
what's outstanding, and [docs/go-migration.md](docs/go-migration.md) for the
next major change.

## Ground rules

These are non-negotiable unless the user explicitly lifts them for a task:

1. **The user handles all git writes.** Do not run `git commit`, `git push`,
   `git add`, `git reset --hard`, or any destructive git operation. Read-only
   git (`git status`, `git log`, `git diff`) is fine.
2. **The user handles all app builds and deploys.** Do not run `npm run build`,
   `npm run dev` (except to type-check a change via the user's running process),
   `./deploy.sh`, or `./render-nginx.sh`. Edit the files and tell the user what
   to run.
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
nginx (today)  OR  Go binary (planned — see docs/go-migration.md)
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
| [src/App.svelte](src/App.svelte)   | Single-component UI: triage, preview, More menu, settings modal |
| [src/lib/api/readeck.js](src/lib/api/readeck.js) | Readeck client: list, repair (Clone/Replace/Deprecate) |
| [src/lib/api/archive.js](src/lib/api/archive.js) | archive.org CDX client + `ArchiveRateLimitError` |
| [src/lib/api/brave.js](src/lib/api/brave.js)     | Brave Search client (goes through `/brave/` proxy) |
| [src/lib/cache.js](src/lib/cache.js)             | IndexedDB candidate cache, `CACHE_STALE_MS` gated |
| [src/lib/scoring.js](src/lib/scoring.js)         | Candidate ranking (archive save-date delta, etc.) |
| [src/lib/config.js](src/lib/config.js)           | Label constants, cache TTL. **No secrets.**          |
| [vite.config.js](vite.config.js)                 | Dev-server proxy config for `/api`, `/cdx`, `/brave` |
| [nginx/*.conf.template](nginx/)                  | Prod reverse-proxy templates, rendered by render-nginx.sh |
| [render-nginx.sh](render-nginx.sh)               | Envsubst (or sed fallback) renderer driven by `.env` |
| [.env.example](.env.example)                     | Shows `READECK_UPSTREAM`, `BRAVE_API_KEY`, deploy dirs |

The nginx templates and `render-nginx.sh` will be retired when the Go migration
lands — see [docs/go-migration.md](docs/go-migration.md).

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
- **User credentials stay in `localStorage`.** Readeck URL and API token are
  entered via the Settings modal and never leave the browser except as an
  `Authorization` header on `/api/` calls.

## Common tasks — how to approach them

- **Add a new proxy route.** Add it to `vite.config.js` for dev, add a
  `location` block to both `nginx/*.conf.template` files for prod, and update
  `docs/go-migration.md` routes list. Use the existing `/brave/` block as the
  template for header injection.
- **Change the label taxonomy.** Edit `src/lib/config.js` constants and the
  carry-forward filter in `src/lib/api/readeck.js`. Update
  [docs/spec.md](docs/spec.md).
- **Touch preview behavior.** The iframe remount trick uses Svelte's `{#key}`
  directive. The preview footer is `position: sticky; bottom: 0` with
  `flex-wrap: wrap` so Apply stays visible.
- **Add settings.** The Settings modal is inside `App.svelte`. Persist via
  `localStorage`; do not introduce a store library for this.

## Sub-agents

The user has a Pro subscription — 5-hour and weekly rate limits matter. Default
is **do not spawn sub-agents**. When they do help:

- **Serial only, never parallel.** Parallel spawns burn the quota fast.
- **Announce before spawning** so the user can veto.
- **Good cases:** broad Explore/Grep sweeps across the repo, scoped one-shots
  a Sonnet-class model can finish without iteration.
- **Bad cases:** tight iterative work, anything where Opus-level reasoning is
  load-bearing, anything that would benefit from seeing the user's reactions.

## What's next (as of 2026-04-20)

1. Finish Phase 1 remainders: disposition control UI, disposition default in
   Settings, Brave end-to-end verification. See [TODO.md](TODO.md).
2. **Go single-binary migration** — [docs/go-migration.md](docs/go-migration.md).
   Ordering was deliberately flipped to put this **before** the first tester
   release because the binary cuts more tester friction than a UX polish pass
   does.
3. First tester release off the binary.
4. Phase 1.5 UX rethink, driven by the user as designer plus tester feedback
   on content-finding edge cases.
