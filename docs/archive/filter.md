# Filter — list views

**Status:** Implemented.

Adds an in-list filter to every drawer list view. Modeled on MyDeck (Android) —
see `mydeck-android/app/src/main/java/com/mydeck/app/ui/components/FilterBottomSheet.kt`,
`FilterBar.kt`, and `domain/model/FilterFormState.kt`.

The console's filter is **a filter within a filter**: each list is already
pre-filtered by its drawer preset (Triage = `has_errors=true & is_archived=false`;
Recovered/Replaced = label sets; Ignored = local store). The user-applied
filter narrows that set further — it never broadens scope across lists.

## Scope

Same four list views as [sort.md](sort.md):

- **Triage** — [TriageList.svelte](../src/ui-v2/components/TriageList.svelte)
- **Recovered** — [RecoveredView.svelte](../src/ui-v2/components/RecoveredView.svelte)
- **Replaced** — [ReplacedView.svelte](../src/ui-v2/components/ReplacedView.svelte)
- **Ignored** — [IgnoredView.svelte](../src/ui-v2/components/IgnoredView.svelte)

Not applicable: Settings, User Guide, About, Bookmark, Preview.

## Differences from MyDeck

Per assignment:

- **Excluded fields:** `Author`, all `Progress` attributes (Unviewed / In progress / Completed), `Is downloaded` (Android `isLoaded`), `With errors`.
  - Rationale: Author is rarely populated for repair-flow bookmarks; progress
    requires Readeck reading-position data we don't surface; `is_downloaded`
    only matters to the Android offline cache; `with_errors` is the *defining*
    filter of the Triage view (no-op there) and irrelevant elsewhere.
- **Title behavior:** Top app bar title shows the original view name with the
  filtered count in parens — e.g. `Triage (12)` — *not* MyDeck's
  `Filtered List (12)`. When filter resets, drop back to the bare view name
  (`Triage`).
- **Scope is per-list.** No global filter state. Each list owns its own
  `FilterFormState`. Switching drawer entries does not carry filters across.

## Included fields

Match MyDeck's `FilterFormState` minus the exclusions above:

| Field         | Type                  | UI control                                |
|---------------|-----------------------|-------------------------------------------|
| `search`      | string (full text)    | Outlined text input, full width           |
| `title`       | string                | Outlined text input                       |
| `site`        | string                | Outlined text input                       |
| `label`       | string (single select)| Read-only field → opens label picker      |
| `fromDate`    | date                  | Read-only field → opens date picker       |
| `toDate`      | date                  | Read-only field → opens date picker       |
| `types`       | Set<Type>             | `Article` / `Video` / `Picture` chips     |
| `isFavorite`  | tri-state             | `Any` / `Yes` / `No` segmented control    |
| `isArchived`  | tri-state             | `Any` / `Yes` / `No` segmented control    |
| `withLabels`  | tri-state             | `Any` / `Yes` / `No` segmented control    |

**Layout in the bottom sheet** (top to bottom):

1. `search` (full width)
2. `title` (full width — single column since `author` is excluded)
3. `site` / `label` side-by-side
4. `fromDate` / `toDate` side-by-side
5. `Type` chip row
6. Tri-state rows: Favorite, Archived, With labels
7. Action row: `Reset` (only when any filter is active) + `Search` button

Hide tri-states the active view's preset has already pinned (would always be
no-op or always-empty):

| View      | Hide                            |
|-----------|---------------------------------|
| Triage    | `isArchived` (preset = false)   |
| Recovered | `withLabels` (always true)      |
| Replaced  | `isArchived` (preset = true), `withLabels` (always true) |
| Ignored   | `withLabels` (always true)      |

This mirrors how MyDeck `FilterFormState.fromPreset` masks out the
preset-pinned fields in the active-chip bar.

## UI

### Top app bar icon

A new filter button in the `trailing` slot of [TopAppBar.svelte](../src/ui-v2/components/TopAppBar.svelte),
visible only when `routeMode === 'drawer'` and `activeView` is one of the four
list views. Sits to the right of the [sort](sort.md) button.

- Icon: `MdiFilterVariant` (matches Android `Icons.Filled.FilterList`).
  Path data: `M6,13H18V11H6M3,6V8H21V6M10,18H14V16H10V18Z`
- `aria-label="Filter"`, `title="Filter"`.

Tapping opens the filter bottom sheet.

### Bottom sheet

A new `<FilterBottomSheet>` component in `src/ui-v2/components/`. Fixed to the
viewport bottom on mobile, centered modal on wide. Existing dialogs in this
codebase ([ApplyConfirmDialog.svelte](../src/ui-v2/components/ApplyConfirmDialog.svelte),
[ManualUrlDialog.svelte](../src/ui-v2/components/ManualUrlDialog.svelte))
provide the modal/scrim pattern; extend it with a slide-up sheet on narrow
screens.

Props:

```js
export let open = false;
export let preset;            // { isArchived?, withLabels?, ... } from view defaults
export let value;             // current FilterFormState
export let availableLabels;   // Map<labelName, count> for the picker
```

Events: `apply` (with new state), `reset`, `dismiss`.

State management mirrors `FilterBottomSheet.kt`:

- Local copies of every field, seeded from `value` on open.
- `Reset` button visible only when `hasActiveFilters`.
- `Apply` (button labeled "Search") commits the local state via `apply` event
  and the parent closes the sheet.
- Dismiss (scrim tap, Esc) discards local edits.

### Active-filter chip bar

A `<FilterBar>` component, rendered between the top app bar and the list
content (immediately above `TriageList` / `RecoveredView` / etc. in
[AppV2.svelte](../src/ui-v2/AppV2.svelte)). Visible only when the filter
differs from the view's preset.

- Horizontal `LazyRow`-equivalent (a flex row with `overflow-x: auto`).
- One `InputChip` per active filter, e.g. `Title: foo`, `Site: example.com`,
  `Type: Article`, `Favorite: Yes`, `From: Apr 12, 2026`.
- Each chip has a trailing `MdiClose` (`MdiClose` already in icons module);
  tapping it clears that one field (reverts to preset value, not always `null`).
- Tapping the bar background re-opens the bottom sheet.

Mirrors `FilterBar.kt` synthetic-chip rules: when a tri-state preset value was
overridden to `null` (broadened scope), show a `Field: Any` chip whose
dismiss-action restores the preset value.

### Title with count

In [AppV2.svelte](../src/ui-v2/AppV2.svelte), update the `topBarTitle`
reactive (line 155):

```js
$: filteredCount = currentListFilteredLength;  // length after filter applied
$: hasFilter = filterStates[activeView]?.hasActiveFilters() ?? false;
$: topBarTitle = !apiToken ? 'Sign in'
  : routeMode === 'preview' ? 'Preview'
  : routeMode === 'bookmark' ? 'Bookmark'
  : (hasFilter
      ? `${VIEW_TITLES[activeView]} (${filteredCount})`
      : (VIEW_TITLES[activeView] || activeView));
```

Reset → bare title, no count. Active → `Triage (12)`, `Recovered (4)`, etc.

## Persistence

**Per-view, in-memory only** — does not survive a reload. Matches the
"each list owns its own filter" semantics; persisting would surprise users
who expect their filters to clear when they revisit the app.

State shape: `let filterStates = { triage: null, recovered: null, replaced: null, ignored: null };`
Each entry is either `null` (no filter, equals preset) or a `FilterFormState`
object.

**Open question:** persist to `sessionStorage` keyed per view, so a hard
refresh during repair work doesn't wipe an in-progress filter? Mirror the
existing `REPAIR_STATE_KEY` pattern. Default to in-memory only for v1; revisit
if testers ask.

## Implementation notes

### Where the predicate lives

A single `matchesFilter(bookmark, filterState)` helper in a new
`src/lib/filter.js`. Pure function, no Svelte deps. Exports the
`FilterFormState` shape, default factory, `hasActiveFilters` check, and
preset-overrides for each view.

```js
export function defaultFilterState() { /* … */ }
export function presetFor(view) { /* { isArchived: false } for triage, … */ }
export function hasActiveFilters(state, preset) { /* differs from preset */ }
export function matchesFilter(bookmark, state) { /* boolean */ }
```

Predicate rules (per field):

- `search`: case-insensitive substring across `title`, `description`, `url`, `site_name`.
- `title`: case-insensitive substring on `bookmark.title`.
- `site`: case-insensitive substring on `bookmark.site_name` (fall back to URL host).
- `label`: `bookmark.labels?.includes(state.label)`.
- `fromDate` / `toDate`: `Date.parse(bookmark.created)` within `[from, to]` (inclusive). Compare against `created` to match Android.
- `types`: `state.types.size === 0 || state.types.has(bookmark.type)`. Bookmark types come from Readeck (`article` / `video` / `photo`). Map `photo` → `Picture`.
- `isFavorite`: tri-state vs. `bookmark.is_marked`.
- `isArchived`: tri-state vs. `bookmark.is_archived`.
- `withLabels`: tri-state vs. `(bookmark.labels?.length ?? 0) > 0`.

### Wiring into list views

Apply the filter **after** sort but **before** rendering. Each list view
already returns a sorted array; pipe through `.filter(b => matchesFilter(b, state))`.

For [AppV2.svelte](../src/ui-v2/AppV2.svelte) Triage:

```js
$: filteredBookmarks = sortedBookmarks
  .filter(b => matchesFilter(b, filterStates.triage ?? presetFor('triage')));
```

Pass `filteredBookmarks` to `<TriageList>`. The other three views own their
fetch + sort already; add the filter step inside each.

### Label picker

Reuse-or-build a small `<LabelPicker>` (single-select). Available labels for
the picker come from `client.listAllLabels()` — add a thin method on
[ReadeckClient](../src/lib/api/readeck.js) hitting `GET /api/bookmarks/labels`
(per [openapi-spec.json](openapi-spec.json)). Cache per session in
[AppV2.svelte](../src/ui-v2/AppV2.svelte); do not refetch on every sheet open.

### Date picker

Use the native `<input type="date">` for v1 — avoids a third-party calendar
component and matches the rest of the console's HTML-native form controls
(see [SignInView.svelte](../src/ui-v2/components/SignInView.svelte)).

## Out of scope / open questions

- **Server-side filtering.** The Readeck API supports nearly all of these
  query params (see [openapi-spec.json](openapi-spec.json) lines ~1975+). We
  keep filter client-side because Recovered/Replaced fan out across multiple
  label queries client-side already; pushing a unified filter server-side
  would require restructuring `getBookmarksByLabels`. Revisit if list sizes
  blow up past tens of thousands.
- **Filter persistence across reloads.** See note above. v1: in-memory only.
- **Free-text label match vs. exact.** v1: single-select exact match (matches
  MyDeck). Multi-label-AND filtering deferred.
- **Filter applies to the list count badge in [NavDrawer.svelte](../src/ui-v2/components/NavDrawer.svelte)?**
  No — drawer counts reflect the *unfiltered* preset list (so users can see
  what they'd return to). Only the top-app-bar title carries the filtered count.
