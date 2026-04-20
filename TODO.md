# TODO

Top-level working list. Items move to closed issues / commit messages once done.

---

## Phase 1 — remainders before tester release

- [ ] Per-repair **disposition control**: let the user choose archive-original vs. delete-original at apply time, with the default read from Settings. Currently hardcoded to archive.
- [ ] **Disposition default** setting surfaced in the Settings modal.
- [ ] **Post-apply monitoring** of the new bookmark: because `POST /bookmarks` is async, show the replacement's extraction status (pending / loaded / errored) instead of optimistically removing the row and hoping for the best.
- [ ] Ability to **undo / revert** within a short window after apply (at minimum: re-surface the archived original and offer to delete the freshly created replacement).
- [ ] Confirm **Brave Search** path end-to-end now that the `/brave/` proxy is in place (token injected server-side via `.env` + `render-nginx.sh`; only archive.org flow has been exercised so far).
- [ ] Dev vs. prod config surface audit (env-driven proxy targets, CSP now that Brave and archive.org are same-origin).
- [ ] Distribution work per [docs/distribution.md](docs/distribution.md): Dockerfile, entrypoint, release workflow, static tarball.

---

## UI/UX — step back and rethink for Phase 1.5

The current three-pane layout + tabs grew organically. Before adding more features, do a clean redesign around the *workflow* rather than the data shape. The redesign should account for:

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

Deliverable: a short `docs/ux-redesign.md` written *before* coding, sketching screens and state transitions. Loop in at least one tester for feedback before implementation.

---

## Phase 2 — high-level plan

Each item below is a discovery / design exercise followed by implementation; details live in [docs/spec.md §11](docs/spec.md).

- [ ] **Decide backend language & runtime** (spec currently says Go; revisit if the tester cohort has other preferences).
- [ ] **Backend skeleton**: HTTP server, config loading, structured logging, graceful shutdown.
- [ ] **API proxy layer**: Readeck, archive.org CDX, Brave / SearXNG — centralized rate limiting, retry, and caching.
- [ ] **OAuth 2.0 + PKCE** for Readeck (alternative to API tokens; needed for any distribution beyond personal use).
- [ ] **Pre-operation backup** wired to `GET /bookmarks/sync?with_json=true` before any batch write.
- [ ] **Batch orchestration**: worker pool, cancellation, progress reporting.
- [ ] **Dry-run mode**: compute the full set of creates / patches / deletes and preview before executing.
- [ ] **Advanced HTML injection**: fetch IA snapshot → strip Wayback chrome → inline images → multipart POST to Readeck. Mirrors the browser extension's extraction path.
- [ ] **Capture Selection**: iframe bridge for "save just this highlighted fragment".
- [ ] **SearXNG integration**: user-supplied instance URL, same scoring pipeline as Brave.
- [ ] **Repair history / audit log**: decide whether labels are enough or a server-side log is warranted.
- [ ] **Distribution**: extend the Docker story to a two-container compose (SPA + backend), or a single image if we embed the frontend.
