# TODO

Top-level working list. Items move to closed issues / commit messages once done.

Working order: **UX refactor → Go single-binary → first tester release → conditional follow-ups.** The earlier plan (tester release before UX) was reversed so testers don't see the smoketest shell. See [docs/refactor-ui-ux.md](docs/refactor-ui-ux.md) for UX design intent and [docs/go-migration.md](docs/go-migration.md) for the binary plan.

---

## Phase 1 remainder — verify before the refactor

One bounded item worth closing on the current shell so the refactor isn't debugging two problems at once:

- [ ] Confirm the **Brave Search** path works end-to-end through the `/brave/` proxy. Only the archive.org flow has been exercised; verify the injected `X-Subscription-Token` reaches Brave and results come back before the Bookmark view is rebuilt around both sources.

Disposition control and disposition-default-in-Settings are no longer separate remainders — they fold into the UX refactor (specced in `refactor-ui-ux.md` under Settings → General and the Apply flow).

---

## Phase 1.5 UI/UX refactor — next

Design intent in [docs/refactor-ui-ux.md](docs/refactor-ui-ux.md). Implementation checkboxes, grouped by surface:

### Shell + navigation

- [ ] Top app bar with hamburger menu + left nav drawer.
- [ ] Drawer items: Triage, Recovered, Replaced, separator, Settings, User Guide, About.
- [ ] Responsive layout: desktop and mobile (portrait + landscape).
- [ ] Retire the current three-pane layout in [src/App.svelte](src/App.svelte).

### Triage List

- [ ] Cards match the live MyDeck grid shape: no thumbnail, title + site name, date icons (MDI, from MyDeck Detail dialog), label chips, four inline action icons.
- [ ] Action icons in order: **Favorite** (dimmed/informational), **Archive** (dimmed/informational), **External Link** (opens original URL in new tab), **Delete**.
- [ ] Dimmed-icon visual treatment: lower-contrast color, no hover affordance, no cursor change.
- [ ] Delete-with-Undo snackbar — indefinite duration; commit on any other tap/gesture in the UI; only one pending at a time.

### Bookmark view (replaces today's right-pane tabs)

- [ ] Top app bar: back arrow, title "Bookmark," 3-dot overflow.
- [ ] Header: title, site name, full URL, created + published dates, favorite/archive state, user-friendly error (404/500/redirect/etc.) derived from Readeck's error reason.
- [ ] Unified candidate list — archive.org + Brave Search interleaved by confidence.
- [ ] Per-source skeleton while a source is loading; each source renders as it returns and the list resorts.
- [ ] Protected "Closest to save date" section at top: closest-before snapshot preferred; closest-after only when no pre-create snapshot exists.
- [ ] 3-dot overflow menu: Manual URL (dialog), Delete (shared snackbar flow).
- [ ] Tapping a candidate opens the Preview view (no inline Preview / Open / Apply buttons on candidate cards).
- [ ] Empty state when both sources return nothing.

### Preview view

- [ ] Top app bar: back, Apply, Delete, Open ↗.
- [ ] Preview iframe behavior matches today (`{#key previewUrl}` remount, spinner overlay).

### Recovered / Replaced views

- [ ] Read-only list of bookmarks with `recovered-*` labels (Recovered) or `replaced-*` labels (Replaced).
- [ ] Cards use Triage List shape but no action icons and no tap action.
- [ ] Add a label-filtered Readeck query path in [src/lib/api/readeck.js](src/lib/api/readeck.js).

### Settings

- [ ] General → **Action on Apply** (Archive default, Delete option). Backs the per-repair disposition chooser in the Apply flow.
- [ ] General → **App theme**: light / dark / system.
- [x] Account dialog: OAuth 2.0 Authorization Code Flow with PKCE — sign-in, signed-in state with server URL + scopes, sign-out with best-effort token revoke. ([src/lib/api/oauth.js](src/lib/api/oauth.js), [src/ui-v2/components/SignInView.svelte](src/ui-v2/components/SignInView.svelte), [src/ui-v2/components/SettingsView.svelte](src/ui-v2/components/SettingsView.svelte))
- [ ] **Ignored bookmarks** — list of bookmarks hidden via the eye-off "Ignore (keep as-is)" action, with per-item un-ignore and a "Clear all ignored" option. Ignored IDs are stored in IndexedDB `meta['ignored']`; no un-ignore UI exists yet.

### Other drawer entries

- [ ] User Guide — markdown rendered client-side from `docs/user-guide.md`.
- [ ] About — patterned on MyDeck's `AboutScreen`, with console-specific content (version, credits, license, active Readeck server info).

### Scoring rewrite ([src/lib/scoring.js](src/lib/scoring.js))

- [ ] **Archive.org** scoring (0–100): pre-create snapshots preferred; gentle decay with distance to `created` for pre-create, steeper decay for post-create; longevity bonus — snapshot count and span-years among pre-create snapshots lift the closest-to-create candidate's score.
- [ ] Post-create snapshots only meaningfully scored when no pre-create snapshot exists.
- [ ] **Brave Search** augmentation on top of current logic: publication-date proximity bonus (exact match strong, within-a-week mild); byline match bonus (when both sides expose author); same-registrable-domain bonus (ditto subdomain migrations like `500px.com` → `iso.500px.com`).
- [ ] Output 0–100 on both sources so the Bookmark view can merge/interleave.
- [ ] Tie-break order for interleave: pre-create archive snapshot > Brave result > post-create archive snapshot.

### Behavioral / cross-cutting

- [ ] Detect **already-archived originals** in the Triage payload and surface it in the Bookmark view header + Apply confirmation ("Original is already archived — Apply will add the `replaced-*` label only").
- [ ] Persist in-flight repair state (selected bookmark, candidates, preview URL) so a page reload doesn't lose context.

### Deferred in this milestone

- Keyboard shortcuts (j/k navigate, p preview, a apply, enter advance).
- Making Favorite / Archive on cards actionable (informational only in 1.5).
- In-app Logs view — deferred indefinitely; not worth the UI complexity for a thin client.

---

## Go single-binary migration — after UX refactor

Full plan in [docs/go-migration.md](docs/go-migration.md). Summary checkboxes:

- [ ] Scaffold `cmd/mydeck-console` + `internal/{server,proxy,config}` packages.
- [ ] `go:embed` the Svelte `dist/` with a build script that enforces `npm run build` before `go build`.
- [ ] Static handler with SPA fallback; carve out `/api/`, `/cdx/`, `/brave/`.
- [ ] Three `httputil.ReverseProxy` handlers. `/brave/` injects `X-Subscription-Token` via `Director`.
- [ ] CLI flags + env defaults (`--listen`, `--readeck-upstream`, `--brave-key`). Fail fast on missing upstream.
- [ ] Graceful shutdown, 120s `/cdx/` timeout, correct Host/SNI for archive.org.
- [ ] Tests: SPA fallback, Brave header injection, missing-upstream error.
- [ ] Cross-compile for linux/amd64, linux/arm64, darwin, windows.
- [ ] GitHub Actions release workflow: `npm ci && npm run build && go build`, attach platform binaries to each tag.
- [ ] Retire `nginx/*.conf.template`, `render-nginx.sh`, and the nginx container from docs and repo.

---

## Tester release — after Go migration

- [ ] `v0.x.0` tag + release with platform binaries and one-line quick-start.
- [ ] Optional Docker image wrapping the binary for docker-compose testers (secondary; binary is primary).
- [ ] Short `CHANGELOG.md`.
- [ ] Feedback channel decided (issues vs. private repo vs. email).

---

## Phase 2 residual items

After the UX refactor, Go migration, and first tester release, the remaining Phase 2 work is small. Context in [docs/spec.md §11](docs/spec.md#11-phase-2-roadmap) and [docs/go-migration.md](docs/go-migration.md).

- [ ] **Advanced HTML injection** — conditional on tester feedback that the Wayback-rendered bookmark is unacceptable. Fits inside the existing Go binary.
- [ ] **SearXNG integration** — user-supplied instance URL, same scoring pipeline as Brave. Small once the Go shell exists.
- [ ] **Capture Selection** — speculative; build only if the need surfaces during testing.

Dropped: worker-pool batch processing, dry-run batch diffs, server-side repair audit log. The SPA-side `GET /bookmarks/sync?with_json=true` download covers the pre-repair backup case without needing a backend. (OAuth PKCE was originally on this list but landed in Phase 1.5 — see Settings → Account.)
