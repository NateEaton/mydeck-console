# Reimagining MyDeck-Console UI/UX

**Status:** Design intent for Phase 1.5. Supersedes the current three-pane shell in [App.svelte](../src/App.svelte) and sets the direction for the Svelte work that will precede the first tester release.

## Sequence note

This redesign now ships **before** the Go single-binary migration and **before** the first tester release. The earlier plan was UX-after-testers; the pivot is to not put the smoketest-era shell in front of testers at all. Working order is: **UX refactor → Go single-binary → first tester release → conditional follow-ups (advanced HTML injection, SearXNG, etc.)**. See [TODO.md](../TODO.md) for the checkboxed plan and [go-migration.md](go-migration.md) for the binary details.

## Goals

- Support for both desktop browser and mobile form factors including portrait and landscape.
- Alignment with MyDeck (Android) style, layout, and interactions.
- Enhance interactions for an efficient bookmark-replacement workflow.

## Grounding

Review `../mydeck-android` for the Android app's style, layout, and navigation. Where this document uses terms like "grid card," "Detail dialog," "nav drawer," etc., it means the patterns in the live Android app as of the current release — **not** any orphaned composables that still live under `ui/list/components/` from the ReadeckApp fork. See [mydeck-android/docs/legacy-cleanup.md](../../mydeck-android/docs/legacy-cleanup.md) for the cleanup minispec covering those holdovers.

## Layout

- Top app bar with title on the left and action icons / overflow on the right.
- Far left of the top app bar: hamburger menu icon.
- Left side nav drawer opens partial-width when the hamburger is selected.
- Drawer top: app-name title.
- Drawer body: the specific views defined below, a separator, then **Settings**, **User Guide**, and **About**. Each option is icon + title.

## Views

### Triage List

Primary view, modeled on MyDeck's "My List."

- One card per bookmark with a Readeck-reported server error.
- Scrollable list of cards.
- Cards mirror the live MyDeck **grid** card, with these deliberate differences:
  - **No thumbnail image.** Broken bookmarks frequently have no usable image; the space is reclaimed for metadata.
  - **Title** styled to match MyDeck grid (`titleMedium`-equivalent, two lines max).
  - **Site name** in place of URL, styled like MyDeck grid's host line.
  - **No favicon, no reading-time estimate.** Not useful for the repair workflow.
  - **Dates** on the line below the site name, using MDI icons borrowed from the MyDeck **Detail dialog** (no text labels): created date and, when present, published date.
  - **Label chips** one line below the date row; same treatment as the current console, kept as-is.
  - **Action icons,** inline on the card — matching the current live MyDeck grid card (four inline icons, not a 3-dot overflow):
    - **Favorite** (heart) — dimmed / informational. Reflects bookmark state only; not actionable in this view.
    - **Archive** (box) — dimmed / informational. Reflects bookmark state only; not actionable here. "Dimmed" = lower-contrast color, no hover affordance, no cursor change.
    - **External Link** (replaces MyDeck's globe) — opens the original bookmark URL in a new browser tab.
    - **Delete** (trash) on the far right — actionable, triggers the delete-with-Undo flow described below.
- **Card actions:**
  - Tapping the card anywhere outside the action icons opens the **Bookmark view**.
  - Tapping External Link opens the original URL in a new tab.
  - Tapping Delete uses the snackbar pattern below.

#### Delete interaction (shared with Bookmark view / Preview view)

Matches the live MyDeck pattern — the source of truth is `BookmarkListScreen.kt` with `duration = SnackbarDuration.Indefinite`, not the orphaned `TimedDeleteSnackbar.kt`.

- Snackbar appears at the bottom with "Deleted *\<short title\>*" and an **Undo** button on the right.
- The affected card is greyed out in place; it is not removed yet.
- The snackbar stays up **indefinitely** — no automatic timeout.
- Outcomes:
  - **Undo** → dismiss the snackbar, un-grey the card, leave the bookmark in place.
  - **Any other click or gesture in the UI** → commit the deletion: card is removed from the list, snackbar dismisses, `DELETE /bookmarks/{id}` fires.
- Only one pending-delete snackbar at a time; staging a second one auto-commits the first.

#### Bookmark view

Entered by tapping a Triage List card. Replaces today's right-pane tab stack.

- Top app bar: back arrow on the left, title "Bookmark," 3-dot overflow on the right.
- **Header** (below the top app bar):
  - Bookmark title.
  - Site name.
  - Full URL.
  - Metadata: created date, published date (if present), favorite state, archive state.
  - **User-friendly error summary** (404, 500, redirect, etc.) derived from Readeck's reported error on the bookmark.
- Divider.
- **Results area** below the divider. On entry, fires archive.org and Brave Search in parallel (same as today) but the rendering differs from the smoketest:
  - No separate Archive / Search tabs. One unified candidate list.
  - **Per-source skeleton** while a source is loading — two rows of skeletons labeled "Archive.org" and "Brave Search" so the user knows what's pending.
  - Each source's results appear **as soon as that source returns**, resorting the list as the slower source arrives. (Earlier proposal was "wait for all" — discarded; Brave is usually sub-second, archive.org can take 10–120s, and blocking Brave on archive hurts perceived responsiveness.)
  - Results are **interleaved by confidence score** across both sources, with one exception: a protected **"Closest to save date"** section at the top of the list, containing the archive.org snapshot closest **before** the bookmark's created date plus (only if no pre-create snapshot exists) the closest after. This preserves the "bracketing" insight from the current UI; everything else is interleaved below it.
  - Each card clearly identifies its source (archive.org / Brave Search).
  - If no Brave API key is configured, only archive.org results apply — skeleton for Brave is suppressed.
  - If both sources return empty, show a centered "No candidates found" state.
- **3-dot overflow menu:**
  - **Manual URL** — opens a dialog to paste a replacement URL.
  - **Delete** — closes the Bookmark view, returns to the Triage List, and triggers the shared delete-with-Undo flow on the originating card.
- **Card interaction:** tapping a candidate card (archive.org or Brave) opens the **Preview view**. No inline Preview / Open / Apply buttons on the candidate cards.

#### Preview view

Entered by tapping a candidate card in the Bookmark view.

- Top app bar: back arrow on the left, title "Preview," action icons on the right:
  - **Apply** — runs the bookmark-replacement logic for the previewed candidate.
  - **Delete** — shared delete-with-Undo flow on the underlying bookmark.
  - **Open ↗** — opens the candidate URL in a new tab. Retained because sites that block iframe embedding (X-Frame-Options / CSP `frame-ancestors`) render as a blank preview; Open is the escape hatch.
- Preview content: iframe of the candidate, matching today's behavior (load spinner overlay, `{#key previewUrl}` remount on URL change).

### Recovered

- Lists bookmarks created by the Apply flow — those with `recovered-*` labels.
- Cards use the same shape as the Triage List, with these changes:
  - No action icons.
  - Card tap is a no-op.
- Strictly read-only review; the User Guide should note this.
- Requires a label-filtered Readeck query path (see follow-ups in [TODO.md](../TODO.md)).

### Replaced

- Lists bookmarks deprecated by the Apply flow — those with `replaced-*` labels.
- Same card + interaction rules as Recovered.

## Candidate scoring

The goal is a single confidence number per candidate so the Bookmark view can interleave archive.org and Brave results against each other. Scores must be comparable across sources; they are not just "probability of match" — they're "likelihood this is what the user bookmarked."

### Archive.org

Weight factors, in priority order:

1. **Pre-create snapshots win.** A snapshot timestamped **before** the bookmark's `created` date is strong evidence the article existed before the save; a snapshot timestamped after is weaker (it's more likely to be a redirect / error page captured post-rot). Post-create snapshots only get meaningful weight when no pre-create snapshot exists.
2. **Temporal proximity.** Among pre-create snapshots, shorter distance between snapshot timestamp and `created` boosts the score. Decay is gentle for before, steeper for after.
3. **Longevity bonus.** More snapshots prior to `created`, and a wider span between the earliest and latest pre-create snapshots, indicates the URL was indexed repeatedly over time — a stronger signal that the snapshot content is representative of what was saved. This bonus raises the score of the **closest-to-create** pre-create snapshot; it does not lift all snapshots.
4. **Same-host sanity check.** Already implicit in archive.org — snapshot URLs always share the requested host.

Output: 0–100 score, same scale as Brave, so the two are mergeable.

### Brave Search

Start from the current `scoreCandidate` logic in [scoring.js](../src/lib/scoring.js) (title match + domain match), then add:

1. **Publication-date match bonus.** If the bookmark has a `published` date and the Brave result exposes a published date, reward proximity. Exact date match is a strong signal; within-a-week is a mild signal.
2. **Byline match bonus.** If both the bookmark and the Brave result expose an author / byline, reward match. Useful for the common case where a blog migrated hosts but republished the same articles by the same author (e.g. 500px.com → iso.500px.com).
3. **Same-registrable-domain bonus.** The current logic splits on exact host; reward a shared registrable domain even when the subdomain differs (ditto 500px → iso.500px).

### Interleaving

- Archive's "Closest to save date" section is protected — those one or two candidates always lead, regardless of scored order.
- Everything else, from both sources, is merged and sorted by score descending.
- Ties broken by: pre-create archive snapshot > Brave result > post-create archive snapshot.

## Settings

Modeled on MyDeck's `SettingsScreen`.

### Account

- **Phase 1:** dialog for Readeck server URL + API token + Test Connection (today's shape, kept).
- **Post-OAuth:** pattern after MyDeck's `AccountSettingsScreen` — device-authorization flow. Separate milestone; out of scope for this refactor.

### General

- **Action on Apply:** Archive (default) or Delete the replaced bookmark. Backs the per-repair disposition control; see [TODO.md](../TODO.md).
- **App theme:** light / dark / system.

### Logs

Not planned. The console is a thin client; interesting logs live in the Go binary (post-migration) or browser devtools. Deferred indefinitely; not worth the UI complexity.

## User Guide

Short markdown rendered into a guide view. Covers: setting up server URL + token, reading the Triage List, how repair works end-to-end, what Recovered and Replaced mean, and what "dimmed" state icons signify. Markdown source lives in `docs/` and is rendered client-side — no custom viewer stack.

## About

Scrollable layout patterned on MyDeck's `AboutScreen` but with console-specific content: app name + version, credits (Readeck upstream, original ReadeckApp fork lineage), link to source repo, license text, and server info when a Readeck connection is active.

## Behavioral notes

### Already-archived originals

If a bookmark in the Triage List is already archived in Readeck (`is_archived: true`) and the user's disposition is "Archive original," the Apply flow will re-archive (no-op at the data layer) but the UX should surface this so it's not a silent redundancy. In the Bookmark view's Apply confirmation (or in the header metadata), indicate "Original is already archived — Apply will add the `replaced-*` label only." If the disposition is "Delete," no special handling needed.

### State-icon semantics

The Favorite and Archive icons on Triage List cards are **informational** in Phase 1.5 — not actionable. Moving them to actionable in a future phase is explicitly deferred; the current priority is the repair workflow, not general bookmark management.

### Cross-cutting

- Keyboard shortcuts for the common path (j/k to navigate, p to preview, a to apply, enter to advance) are desirable but not blocking for this milestone — land after the core structure is in.
- Persist in-flight repair state so a page reload doesn't lose the selected bookmark + candidates.

## Workflow summary

The redesign assumes the user's flow is:

1. Review the Triage List.
2. Select a bookmark; review its metadata; wait for archive.org and Brave Search to surface candidates (skeletons for both until they resolve).
3. Tap a candidate to preview it.
4. If the preview looks right, **Apply** to replace the original.
5. Otherwise, **Manual URL** or **Delete** — or back out and try a different candidate.
6. Repeat for the next item in the Triage List.

Compared to the original [spec.md](spec.md): the Clone / Replace / Deprecate workflow, label taxonomy, and immutability invariants are unchanged. What changes is the **shell** — navigation, per-bookmark view composition, preview access, and delete ergonomics. Nothing in the data model or API contract is invalidated.
