# TODO

Top-level working list. Items move to closed issues / commit messages once done.

Working order: **Go migration → first tester release → UX rethink → HTML-injection-if-needed.** See [docs/go-migration.md](docs/go-migration.md) for why this sequence.

---

## Phase 1 — remainders worth landing before the Go migration

Small, bounded items that make sense to finish while the nginx-hosted setup is still live so the binary ports a clean frontend, not a half-finished one:

- [ ] Per-repair **disposition control**: let the user choose archive-original vs. delete-original at apply time, with the default read from Settings. Currently hardcoded to archive.
- [ ] **Disposition default** setting surfaced in the Settings modal.
- [ ] Confirm **Brave Search** path end-to-end now that the `/brave/` proxy is in place (only archive.org flow has been exercised so far).

Everything else (post-apply monitoring, undo, queue filters, etc.) moves into the UX rethink.

---

## Go migration — next

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

## Tester release

- [ ] `v0.x.0` tag + release with platform binaries and one-line quick-start.
- [ ] Optional Docker image wrapping the binary for docker-compose testers (secondary; binary is primary).
- [ ] Short `CHANGELOG.md`.
- [ ] Feedback channel decided (issues vs. private repo vs. email).

---

## Phase 1.5 UI/UX rethink — after first tester release

The current three-pane layout + tabs grew organically. Drive this redesign yourself from a workflow-first perspective; use tester feedback to fine-tune the *content-finding* edges (what scoring feels wrong, which edge-case snapshots mislead) rather than to shape the navigation itself. Checklist:

### Triage queue (list view)

- [ ] **Full metadata visibility** on each card: saved date, published date (when present), author, site host, labels, read progress, favorited, Readeck's own error reason if available.
- [ ] **Filter and search** the queue: by domain, by label, by date range (saved / published), by presence of a search match, by full-text of title/URL.
- [ ] Bulk indicators (e.g. "this domain has 47 broken bookmarks — address them together?").

### Selection → cascading repair flow

Instead of parallel tabs, present as ordered steps so the user always knows where they are.

- [ ] **Step 1 — archive.org** is attempted first and displayed prominently.
  - Results split into "closest to save date" and "all snapshots" (already implemented — keep).
  - Preview + apply inline without leaving the step.
- [ ] **Step 2 — manual / assisted search** kicks in as an explicit fallback when archive.org yields nothing usable (no matches, all previews broken, user dismisses).
  - Brave Search results ranked by confidence.
  - Paste-a-URL manual entry in the same step.
  - Both paths converge on the same preview + apply surface.
- [ ] **Preview** is not a sibling tab — it's the review step for whichever candidate (archive or manual) the user is currently considering.

### Apply

- [ ] Disposition chooser (archive / delete) with the settings default pre-selected, plus a "remember for this session" option.
- [ ] Explicit confirmation showing the full diff: old URL → new URL, inherited metadata, labels that will be added to each side.

### After apply

- [ ] **Status panel / toast** that tracks the newly created bookmark: "extracting…" → "loaded" (or "errored, click to inspect"). Polls `GET /bookmarks/{newId}` until terminal.
- [ ] Surface the replacement's own URL / Readeck permalink so the user can click through.
- [ ] Optional "continue to next in queue" prompt — many testers will process dozens in a session.

### Cross-cutting

- [ ] Keyboard shortcuts for the common path (j/k to navigate queue, p to preview, a to apply, enter to advance).
- [ ] Persist in-flight repair state so a page reload doesn't lose context.
- [ ] Decide whether to keep the three-pane layout or move to a more guided single-column flow once a bookmark is selected.

Deliverable: a short `docs/ux-redesign.md` written *before* coding, sketching screens and state transitions. Testers' feedback informs content-finding edges, not the navigation redesign.

---

## Phase 2 — residual items

After the migration and first tester release, the remaining Phase 2 work is small. Full context in [docs/spec.md §11](docs/spec.md#11-phase-2-roadmap) and [docs/go-migration.md](docs/go-migration.md).

- [ ] **Advanced HTML injection** — conditional on testers reporting the Wayback-rendered bookmark is unacceptable. Fits inside the existing binary.
- [ ] **SearXNG integration** — user-supplied instance URL, same scoring pipeline as Brave. Small once the Go shell exists.
- [ ] **Capture Selection** — speculative; build only if the need surfaces during testing.

Dropped: worker-pool batch processing, dry-run batch diffs, OAuth PKCE, server-side repair audit log. The SPA-side `GET /bookmarks/sync?with_json=true` download covers the pre-repair backup case without needing a backend.
