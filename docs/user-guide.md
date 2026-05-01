# MyDeck Console User Guide

MyDeck Console helps you repair broken Readeck bookmarks while preserving history and metadata.

## Before you start

- Sign in with your Readeck server URL through the app's OAuth flow (see **Sign in** below).
- The binary must be running and reachable for `/api/` and `/cdx/` routes to work.
- Optional: start the binary with `--brave-key` to enable Brave Search as an additional candidate source.

## Sign in

1. Open **Settings → Account** (or the Sign in screen on first launch).
2. Enter your Readeck server URL (e.g. `https://read.example.com`).
3. Tap **Sign in with Readeck** — you are redirected to Readeck to authorize the app.
4. After authorizing, you are returned to the app and the triage queue loads.

Sign out is available in **Settings → Account**. Signing out clears local auth state and the cached bookmark list.

## Triage view

The **Triage** list shows bookmarks with extraction errors that are not archived — the queue of things to repair.

- Open a bookmark to start candidate review.
- Favorite and archive state icons on cards are informational in this workflow — they reflect the bookmark's current state in Readeck but cannot be changed from here.
- To skip a bookmark without repairing it, open it and use **⋮ → Ignore (keep as-is)**. The bookmark is hidden from Triage and tracked in the **Ignored** view.
- To delete a bookmark directly from the list, tap the delete icon on the card. A snackbar appears with an **Undo** option; any other action commits the delete.

## Bookmark view

Tapping a bookmark opens the Bookmark view, which loads archive.org and Brave Search candidates in parallel.

- **Archive candidates** are ranked by proximity to the bookmark's save date. Snapshots taken before the save date are preferred; the closest-before snapshot is pinned at the top.
- **Brave Search results** are scored and merged with archive candidates in a single interleaved list.
- Each source renders its results as they arrive — you don't have to wait for both.
- If nothing usable appears, use **⋮ → Manual URL** to enter a replacement URL directly.
- Use **⋮ → Ignore (keep as-is)** to skip the bookmark and move on.
- Use **⋮ → Delete** to remove the original bookmark.

## Preview and apply

1. Tap a candidate from the Bookmark view to open Preview.
2. The Preview iframe loads the candidate URL. Use **Open ↗** to open it in a new tab if the page blocks iframe embedding.
3. When satisfied, tap **Apply** (✓) in the top bar.
4. A confirmation dialog shows the repair details and lets you choose the **disposition** for the original bookmark: **Archive** (default) or **Delete**. Confirm to proceed.

Apply uses **Clone, Replace, Deprecate**:

- A new bookmark is created at the replacement URL with the original's metadata and labels preserved.
- The original bookmark is archived or deleted based on the chosen disposition.
- After apply, the bookmark disappears from the queue.

## What labels mean

Source-specific labels are applied automatically during repair to make lineage easy to audit in Readeck.

**Labels on the new bookmark** (the replacement):

- `recovered-archive.org` — replacement came from an Internet Archive snapshot
- `recovered-search` — replacement came from Brave Search
- `recovered-manual` — replacement URL was entered manually

**Labels on the original bookmark** (the deprecated one):

- `replaced-archive.org` — deprecated by an archive replacement
- `replaced-search` — deprecated by a search replacement
- `replaced-manual` — deprecated by a manual replacement

## Recovered and Replaced views

- **Recovered**: read-only list of bookmarks created by Apply, identifiable by `recovered-*` labels.
- **Replaced**: read-only list of original bookmarks deprecated by Apply, identifiable by `replaced-*` labels.

These views are for review and audit. Cards show the same information as Triage cards but have no action icons.

## Ignored view

Bookmarks you have chosen to skip appear in the **Ignored** view. From here you can:

- **Un-ignore** an individual bookmark to return it to the Triage queue.
- **Clear all** (button at the top of the view) to return all ignored bookmarks to Triage at once.

Ignored state is stored locally in the browser (IndexedDB) — it does not affect the bookmark in Readeck.

## Sort and filter

The four list views — **Triage**, **Recovered**, **Replaced**, and **Ignored** — each have sort and filter controls in the top app bar.

### Sort

- Tap the **sort** icon to choose the list order: Added, Published, Title, or Site name.
- The active group shows a direction arrow (↓ descending, ↑ ascending).
- Tap the active group again to reverse direction.
- The sort preference is shared across all four views and remembered between sessions.

### Filter

- Tap the **filter** icon to open the filter panel.
- Available fields: search (full text across title, description, URL, and site), title, site, label, date range, type (Article / Picture / Video), and toggles for Favorite, Archived, and With labels.
- Active filters appear as chips below the top bar; tap ✕ on a chip to clear that field.
- The top bar title shows the filtered count, e.g. `Triage (12)`.
- Each view has its own independent filter state; filters reset when you reload the app.

## Settings

- **Account** — shows your signed-in Readeck server and sign-out option.
- **Action on Apply** — sets the default disposition when repairing: Archive (default) or Delete.
- **App theme** — Light, Dark, or System.

## Troubleshooting

- **Archive.org rate limit**: archive.org applies per-session rate limits. If the Archive tab shows a rate-limit error, wait a few minutes and tap Retry.
- **Search tab shows an error**: the binary was not started with a `--brave-key`. Archive and Manual flows are unaffected.
- **Some pages block preview**: the page blocks iframe embedding. Use **Open ↗** to verify in a new tab, then use Manual URL or tap Apply directly.
- **Bookmark doesn't disappear after Apply**: the repair completed but the cache may not have refreshed. Pull-to-refresh or navigate away and back to reload the queue.
