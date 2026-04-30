# TODO

Top-level working list. Items move to closed issues / commit messages once done.

Working order: **UX refactor → Go single-binary → first tester release → conditional follow-ups.** The earlier plan (tester release before UX) was reversed so testers don't see the smoketest shell. See [docs/refactor-ui-ux.md](docs/refactor-ui-ux.md) for UX design intent and [docs/go-migration.md](docs/go-migration.md) for the binary plan.

---

## Phase 1 remainder — verify before the refactor

One bounded item worth closing on the current shell so the refactor isn't debugging two problems at once:

- [x] Confirm the **Brave Search** path works end-to-end through the `/brave/` proxy. Verified: `X-Subscription-Token` reaches Brave, results come back, scored, and interleave with Archive.org snapshots in the Bookmark view.

Disposition control and disposition-default-in-Settings are no longer separate remainders — they fold into the UX refactor (specced in `refactor-ui-ux.md` under Settings → General and the Apply flow).

---

## Phase 1.5 UI/UX refactor — next

Design intent in [docs/refactor-ui-ux.md](docs/refactor-ui-ux.md). Implementation checkboxes, grouped by surface:

### Shell + navigation

- [x] Top app bar with hamburger menu + left nav drawer. ([src/ui-v2/components/TopAppBar.svelte](src/ui-v2/components/TopAppBar.svelte))
- [x] Drawer items: Triage, Recovered, Replaced, separator, Settings, User Guide, About. ([src/ui-v2/components/NavDrawer.svelte](src/ui-v2/components/NavDrawer.svelte); drawer also includes Ignored)
- [x] Responsive layout: desktop and mobile (portrait + landscape). (permanent drawer ≥768 px, modal drawer below; [src/ui-v2/AppV2.svelte](src/ui-v2/AppV2.svelte))
- [x] Retire the current three-pane layout in [src/App.svelte](src/App.svelte). (App.svelte deleted; [src/main.js](src/main.js) mounts AppV2 directly)

### Triage List

- [x] Cards match the live MyDeck grid shape: no thumbnail, title + site name, date icons (MDI, from MyDeck Detail dialog), label chips, four inline action icons. ([src/ui-v2/components/TriageCard.svelte](src/ui-v2/components/TriageCard.svelte))
- [x] Action icons in order: **Favorite** (dimmed/informational), **Archive** (dimmed/informational), **External Link** (opens original URL in new tab), **Delete**.
- [x] Dimmed-icon visual treatment: lower-contrast color, no hover affordance, no cursor change.
- [x] Delete-with-Undo snackbar — indefinite duration; commit on any other tap/gesture in the UI; only one pending at a time. ([src/ui-v2/components/DeleteSnackbar.svelte](src/ui-v2/components/DeleteSnackbar.svelte))

### Bookmark view (replaces today's right-pane tabs)

- [x] Top app bar: back arrow, title "Bookmark," 3-dot overflow. ([src/ui-v2/AppV2.svelte](src/ui-v2/AppV2.svelte))
- [x] Header: title, site name, full URL, created + published dates, favorite/archive state, user-friendly error (404/500/redirect/etc.) derived from Readeck's error reason. ([src/ui-v2/components/BookmarkView.svelte](src/ui-v2/components/BookmarkView.svelte))
- [x] Unified candidate list — archive.org + Brave Search interleaved by confidence. ([src/ui-v2/components/CandidateList.svelte](src/ui-v2/components/CandidateList.svelte), [src/ui-v2/components/CandidateCard.svelte](src/ui-v2/components/CandidateCard.svelte))
- [x] Per-source skeleton while a source is loading; each source renders as it returns and the list resorts.
- [x] Protected "Closest to save date" section at top: closest-before snapshot preferred; closest-after only when no pre-create snapshot exists.
- [x] 3-dot overflow menu: Manual URL (dialog), Delete (shared snackbar flow). (overflow menu also includes View extraction log, Open original, Ignore)
- [x] Tapping a candidate opens the Preview view (no inline Preview / Open / Apply buttons on candidate cards).
- [x] Empty state when both sources return nothing.

### Preview view

- [x] Top app bar: back, Apply, Delete, Open ↗. (trailing slot in AppV2 for `routeMode === 'preview'`; also includes Ignore)
- [x] Preview iframe behavior matches today (`{#key previewUrl}` remount, spinner overlay). ([src/ui-v2/components/PreviewView.svelte](src/ui-v2/components/PreviewView.svelte))

### Recovered / Replaced views

- [x] Read-only list of bookmarks with `recovered-*` labels (Recovered) or `replaced-*` labels (Replaced). ([src/ui-v2/components/RecoveredView.svelte](src/ui-v2/components/RecoveredView.svelte), [src/ui-v2/components/ReplacedView.svelte](src/ui-v2/components/ReplacedView.svelte))
- [x] Cards use Triage List shape but no action icons and no tap action. ([src/ui-v2/components/BookmarkRow.svelte](src/ui-v2/components/BookmarkRow.svelte))
- [x] Add a label-filtered Readeck query path in [src/lib/api/readeck.js](src/lib/api/readeck.js). (`getBookmarksByLabels`)

### Settings

- [x] General → **Action on Apply** (Archive default, Delete option). Backs the per-repair disposition chooser in the Apply flow. ([src/ui-v2/components/SettingsView.svelte](src/ui-v2/components/SettingsView.svelte))
- [x] General → **App theme**: light / dark / system. ([src/lib/theme.js](src/lib/theme.js), applied pre-mount in [src/main.js](src/main.js); `:root.dark` selector in [src/styles/theme.css](src/styles/theme.css))
- [ ] General → **Brave Search API key** — per-user key entered in Settings instead of (or as override for) the deploy-time `.env` value. The `/brave/` proxy is still required for CORS bypass; only the `X-Subscription-Token` source moves from server to browser. Implementation sketch: nginx `map` directive to fall back to `${BRAVE_API_KEY}` env when the browser sends no header (preserves backward compat); same fallback in vite dev proxy; BraveClient takes an `apiKey` ctor arg; SettingsView field with Save / Test / Clear; `localStorage['brave_api_key']`. When neither browser nor server has a key, suppress Brave gracefully (one-time hint) instead of erroring per bookmark. Bundle this with the other General Settings work above. Aligns well with Phase 2 distribution (per-user keys, no shared deployment quota).
- [x] Account dialog: OAuth 2.0 Authorization Code Flow with PKCE — sign-in, signed-in state with server URL + scopes, sign-out with best-effort token revoke. ([src/lib/api/oauth.js](src/lib/api/oauth.js), [src/ui-v2/components/SignInView.svelte](src/ui-v2/components/SignInView.svelte), [src/ui-v2/components/SettingsView.svelte](src/ui-v2/components/SettingsView.svelte))
- [x] **Ignored bookmarks** — list of bookmarks hidden via the eye-off "Ignore (keep as-is)" action, with per-item un-ignore and a "Clear all ignored" option. Ignored IDs are stored in IndexedDB `meta['ignored']`. ([src/ui-v2/components/IgnoredView.svelte](src/ui-v2/components/IgnoredView.svelte))

### Other drawer entries

- [x] User Guide — markdown rendered client-side from `docs/user-guide.md`. ([src/ui-v2/components/UserGuideView.svelte](src/ui-v2/components/UserGuideView.svelte), [src/lib/markdown.js](src/lib/markdown.js))
- [x] About — patterned on MyDeck's `AboutScreen`, with console-specific content (version, credits, license, active Readeck server info). ([src/ui-v2/components/AboutView.svelte](src/ui-v2/components/AboutView.svelte))

### Scoring rewrite ([src/lib/scoring.js](src/lib/scoring.js))

- [x] **Archive.org** scoring (0–100): pre-create snapshots preferred; gentle decay with distance to `created` for pre-create, steeper decay for post-create; longevity bonus — snapshot count and span-years among pre-create snapshots lift the closest-to-create candidate's score. ([src/lib/scoring.js](src/lib/scoring.js))
- [x] Post-create snapshots only meaningfully scored when no pre-create snapshot exists.
- [x] **Brave Search** augmentation on top of current logic: publication-date proximity bonus (exact match strong, within-a-week mild); byline match bonus (when both sides expose author); same-registrable-domain bonus (ditto subdomain migrations like `500px.com` → `iso.500px.com`).
- [x] Output 0–100 on both sources so the Bookmark view can merge/interleave.
- [x] Tie-break order for interleave: pre-create archive snapshot > Brave result > post-create archive snapshot.

### Behavioral / cross-cutting

- [x] Detect **already-archived originals** and surface it in the Bookmark view header + Apply confirmation ("Original is already archived — Apply will add the `replaced-*` label only"). ([src/ui-v2/components/BookmarkView.svelte](src/ui-v2/components/BookmarkView.svelte) note block; [src/ui-v2/components/ApplyConfirmDialog.svelte](src/ui-v2/components/ApplyConfirmDialog.svelte) per-radio sub-text)
- [x] Persist in-flight repair state (selected bookmark, candidates, preview URL) so a page reload doesn't lose context. (`sessionStorage[repair_state]` in [src/ui-v2/AppV2.svelte](src/ui-v2/AppV2.svelte))

### Deferred in this milestone

- Keyboard shortcuts (j/k navigate, p preview, a apply, enter advance).
- Making Favorite / Archive on cards actionable (informational only in 1.5).
- In-app Logs view — deferred indefinitely; not worth the UI complexity for a thin client.
- **Cross-device sync of the ignored list** (low priority, research). The ignored set lives in browser IndexedDB `meta['ignored']`, so it doesn't follow the user across devices. Options to investigate: (a) export/import as JSON file from Settings; (b) store the list as a Readeck-side bookmark with a sentinel label and a JSON payload in its body; (c) use a Readeck profile-scoped storage primitive if one exists or appears later. Worth ~30 min of API exploration before committing to a direction.

---

## Go single-binary migration — in progress

Full plan in [docs/go-migration.md](docs/go-migration.md). Runtime scaffold is complete (see `cmd/`, `internal/`); remaining items below.

- [x] Scaffold `cmd/mydeck-console` + `internal/{server,proxy,config}` packages.
- [x] `go:embed` the Svelte `dist/` with a build script that enforces `npm run build` before `go build` (`deploy.sh binary-dev|binary-prod`).
- [x] Static handler with SPA fallback; carve out `/api/`, `/cdx/`, `/brave/`.
- [x] Three `httputil.ReverseProxy` handlers. `/brave/` injects `X-Subscription-Token` via `Director`.
- [x] CLI flags + env defaults (`--listen`, `--readeck-upstream`, `--brave-key`). Fail fast on missing upstream.
- [x] Graceful shutdown, 120s `/cdx/` timeout, correct Host/SNI for archive.org.
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
