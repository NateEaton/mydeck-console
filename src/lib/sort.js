// Sort options for the four drawer list views (Triage, Recovered, Replaced,
// Ignored). Mirrors MyDeck (Android) `SortOption` enum minus Duration —
// broken bookmarks have no reading_time, and excluding it keeps the menu
// identical across all four list views. See docs/sort.md.

const STORAGE_KEY = 'mydeck_sort_option';

export const SORT_OPTIONS = {
    added_newest:     { group: 'Added',     dir: 'desc', field: 'created'   },
    added_oldest:     { group: 'Added',     dir: 'asc',  field: 'created'   },
    published_newest: { group: 'Published', dir: 'desc', field: 'published' },
    published_oldest: { group: 'Published', dir: 'asc',  field: 'published' },
    title_az:         { group: 'Title',     dir: 'asc',  field: 'title'     },
    title_za:         { group: 'Title',     dir: 'desc', field: 'title'     },
    site_az:          { group: 'Site name', dir: 'asc',  field: 'site'      },
    site_za:          { group: 'Site name', dir: 'desc', field: 'site'      },
};

export const DEFAULT_SORT = 'added_newest';

// Group → [defaultKey (descending or A→Z), toggledKey]. Tap an inactive group
// to land on the default; tap an active group to flip to the other direction.
export const SORT_GROUPS = [
    { label: 'Added',     primary: 'added_newest',     toggled: 'added_oldest'     },
    { label: 'Published', primary: 'published_newest', toggled: 'published_oldest' },
    { label: 'Title',     primary: 'title_az',         toggled: 'title_za'         },
    { label: 'Site name', primary: 'site_az',          toggled: 'site_za'          },
];

function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url || ''; }
}

function siteKey(b) {
    return (b?.site_name || hostOf(b?.url)).toLowerCase();
}

function dateKey(b, field) {
    const v = b?.[field];
    return v ? (Date.parse(v) || 0) : 0;
}

function titleKey(b) {
    return (b?.title || '').toLowerCase();
}

export function compareBookmarks(a, b, key) {
    const opt = SORT_OPTIONS[key] || SORT_OPTIONS[DEFAULT_SORT];
    const sign = opt.dir === 'desc' ? -1 : 1;

    let cmp = 0;
    if (opt.field === 'created' || opt.field === 'published') {
        cmp = dateKey(a, opt.field) - dateKey(b, opt.field);
    } else if (opt.field === 'title') {
        cmp = titleKey(a).localeCompare(titleKey(b), undefined, { sensitivity: 'base' });
    } else if (opt.field === 'site') {
        cmp = siteKey(a).localeCompare(siteKey(b), undefined, { sensitivity: 'base' });
    }

    if (cmp !== 0) return sign * cmp;

    // Stable tie-break: created DESC, then id, so toggling between options
    // doesn't shuffle equal rows.
    const tieDate = dateKey(b, 'created') - dateKey(a, 'created');
    if (tieDate !== 0) return tieDate;
    return (a?.id || '').localeCompare(b?.id || '');
}

export function sortBookmarks(bookmarks, key) {
    return [...bookmarks].sort((a, b) => compareBookmarks(a, b, key));
}

export function loadSortOption() {
    if (typeof localStorage === 'undefined') return DEFAULT_SORT;
    const v = localStorage.getItem(STORAGE_KEY);
    return (v && SORT_OPTIONS[v]) ? v : DEFAULT_SORT;
}

export function saveSortOption(key) {
    if (typeof localStorage === 'undefined') return;
    if (!SORT_OPTIONS[key]) return;
    localStorage.setItem(STORAGE_KEY, key);
}
