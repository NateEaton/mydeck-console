# Sort — list views

**Status:** Implemented.

Adds a sort control to every drawer list view. Modeled directly on MyDeck
(Android) — see `mydeck-android/app/src/main/java/com/mydeck/app/ui/list/BookmarkListScreen.kt`
(top app bar `actions` block) and `domain/model/SortOption.kt`.

## Scope

Applies to the four drawer entries above the separator in [NavDrawer.svelte](../src/ui-v2/components/NavDrawer.svelte):

- **Triage** — [TriageList.svelte](../src/ui-v2/components/TriageList.svelte)
- **Recovered** — [RecoveredView.svelte](../src/ui-v2/components/RecoveredView.svelte)
- **Replaced** — [ReplacedView.svelte](../src/ui-v2/components/ReplacedView.svelte)
- **Ignored** — [IgnoredView.svelte](../src/ui-v2/components/IgnoredView.svelte)

Not applicable: Settings, User Guide, About, Bookmark, Preview.

## Sort options

Mirrors MyDeck's `SortOption` enum, **with `Duration` removed** (broken
bookmarks have no `reading_time`, and excluding it keeps the menu identical
across all four list views).

| Group       | Default direction | Toggled direction | Field           |
|-------------|-------------------|-------------------|-----------------|
| Added       | Newest first ↓    | Oldest first ↑    | `created`       |
| Published   | Newest first ↓    | Oldest first ↑    | `published`     |
| Title       | A → Z ↑           | Z → A ↓           | `title` (case-insensitive) |
| Site name   | A → Z ↑           | Z → A ↓           | `site_name` (fall back to URL host) |

**Default:** `Added, newest first` — matches the current implicit ordering in
all four views (`(b.created) - (a.created)` reactive sort).

## UI

### Top app bar icon

A new sort button in the `trailing` slot of [TopAppBar.svelte](../src/ui-v2/components/TopAppBar.svelte),
visible only when `routeMode === 'drawer'` and `activeView` is one of the four
list views.

- Icon: `MdiSwapVertical` (matches Android `Icons.Filled.SwapVert`).
  Path data: `M9,3L5,7H8V14H10V7H13M16,17V10H14V17H11L15,21L19,17H16Z`
- `aria-label="Sort"`, `title="Sort"`.
- Place to the **left** of the existing overflow / filter trailing icons.

### Dropdown menu

Tap opens an anchored menu (use the same overflow-menu pattern already in
[AppV2.svelte](../src/ui-v2/AppV2.svelte) lines 726–743 — absolute-positioned
`<div role="menu">` + outside-click handler). One row per group:

```
[↓] Added           ← currently selected, descending
[ ] Published
[ ] Title
[ ] Site name
```

Per row:

- **Leading icon column** (24px). When the group is the active sort, render
  `MdiArrowDown` (descending) or `MdiArrowUp` (ascending) tinted with
  `--md-sys-color-primary`. Otherwise leave the column blank to keep alignment.
  - `MdiArrowDown`: `M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z`
  - `MdiArrowUp`: `M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z`
- **Label.** Bold + primary color when this group is active.
- **Tap behavior:**
  - Inactive group → activate with the group's *default direction*.
  - Active group → toggle to the *other direction* (so `Added newest` → `Added oldest` → `Added newest`).
  - Closes the menu.

This is the same three-state interaction MyDeck uses
(`BookmarkListScreen.kt:512-547`).

## Persistence

Single global preference, persisted to `localStorage` under
`mydeck_sort_option`. Matches MyDeck (sort is a user-level preference, not
per-list). Stored as a string key, e.g. `added_newest` /
`added_oldest` / `published_newest` / `published_oldest` / `title_az` /
`title_za` / `site_az` / `site_za`.

Read once on app init in [AppV2.svelte](../src/ui-v2/AppV2.svelte) (alongside
the existing `localStorage.getItem('readeck_url')` block). Default to
`added_newest` on first run or unrecognized values.

## Implementation notes

### Where the comparator lives

A single `compareBookmarks(a, b, sortOption)` helper in a new
`src/lib/sort.js`. Exports the option enum + display labels + comparator. All
four list views import and apply it.

```js
// rough shape
export const SORT_OPTIONS = {
  added_newest:    { group: 'Added',     dir: 'desc', field: 'created'   },
  added_oldest:    { group: 'Added',     dir: 'asc',  field: 'created'   },
  published_newest:{ group: 'Published', dir: 'desc', field: 'published' },
  // …
};
export function compareBookmarks(a, b, key) { /* … */ }
```

Comparator rules:

- Date fields: parse with `Date.parse(...) || 0`, then numeric compare. Direction flips the sign.
- String fields (`title`, `site_name`): `localeCompare` with
  `{ sensitivity: 'base' }`. For `site`, fall back to the URL host (same logic
  as [BookmarkRow.svelte](../src/ui-v2/components/BookmarkRow.svelte) `hostOf`).
- Stable secondary sort: tie-break on `created DESC` so toggling between
  options doesn't shuffle equal rows.

### Where it gets applied

Replace the existing per-view ad-hoc sort:

| View              | Existing                                                              | Replace with                                  |
|-------------------|-----------------------------------------------------------------------|-----------------------------------------------|
| TriageList        | `sortedBookmarks` reactive in [AppV2.svelte:140-142](../src/ui-v2/AppV2.svelte) | `compareBookmarks(..., sortOption)`           |
| RecoveredView     | `.sort(... created desc)` in `load()`                                 | `compareBookmarks(..., sortOption)`           |
| ReplacedView      | same                                                                  | same                                          |
| IgnoredView       | same                                                                  | same                                          |

Recovered/Replaced/Ignored each receive `sortOption` as a prop from
[AppV2.svelte](../src/ui-v2/AppV2.svelte) and re-sort reactively when it
changes — no refetch needed (data is already in memory after the initial
paginated load).

### Top-bar wiring

[AppV2.svelte](../src/ui-v2/AppV2.svelte) owns `sortOption` state and the
`isListView` flag (`['triage','recovered','replaced','ignored'].includes(activeView)`).
A small `<SortMenu>` component in `src/ui-v2/components/` encapsulates the
button + dropdown and dispatches `change` events. Render it inside the
`trailing` slot only when `routeMode === 'drawer' && isListView && apiToken`.

## Out of scope / open questions

- **Server-side sort.** The Readeck API supports `?sort=` (see
  [openapi-spec.json](openapi-spec.json) line 1951). We deliberately keep sort
  client-side because all four views already load the full result set into
  memory; pushing sort to the server would mean an extra round-trip on every
  toggle for no functional gain.
- **Per-view sort state.** Out of scope for v1 — matches MyDeck's global
  preference. Revisit if user feedback suggests Triage and Recovered want
  different defaults.
- **Duration sort.** Excluded by design (see Scope). Not added back even for
  Recovered/Replaced where `reading_time` could exist, to keep the menu
  identical across views.
