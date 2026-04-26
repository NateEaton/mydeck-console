# MyDeck Console User Guide

MyDeck Console helps you repair broken Readeck bookmarks while preserving history and metadata.

## Before you start

- Sign in with your Readeck server URL through the app's OAuth flow.
- Keep network access available for `/api/` and `/cdx/`.
- Optional: configure Brave proxy support for search fallback through `/brave/`.

## Triage view

- The **Triage** list shows bookmarks with extraction errors that are not archived.
- Open a bookmark to start candidate review.
- Card state icons such as favorite/archive are informational in this workflow.

## Bookmark review

- The Bookmark view loads Archive.org and Brave candidates in parallel.
- Archive results prioritize snapshots closest to the bookmark save date.
- Search results are scored and merged with archive candidates.
- If nothing usable appears, use **Manual URL** from the overflow menu.

## Preview and apply

1. Pick a candidate from Bookmark view.
2. Validate it in Preview.
3. Choose **Apply** to run the repair flow.

Apply uses **Clone, Replace, Deprecate**:

- A new bookmark is created with the replacement URL.
- Important metadata and carried labels are preserved.
- The original bookmark is archived or deleted based on your settings.

## What labels mean

- `recovered-*` labels mark replacement bookmarks created by this app.
- `replaced-*` labels mark original bookmarks that were superseded.
- `Ignored` bookmarks are excluded from triage until you un-ignore them.

## Recovered and Replaced views

- **Recovered**: read-only list of bookmarks created by Apply.
- **Replaced**: read-only list of originals that were deprecated by Apply.
- These views are for review and audit, not direct editing.

## Settings

- **Action on Apply** sets whether originals are archived (default) or deleted.
- **App theme** controls light, dark, or system appearance.
- **Sign out** clears local auth state and bookmark cache.

## Troubleshooting

- Archive.org may rate-limit requests. Wait and retry if needed.
- `401`/`403` errors on Search usually indicate missing proxy token configuration.
- Some pages block iframe embedding. Use **Open in new tab** in Preview.
