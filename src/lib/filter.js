// Filter logic for the four drawer list views. Mirrors MyDeck (Android)
// `FilterFormState` minus excluded fields (Author, Progress, Is downloaded,
// With errors). The filter is applied as "filter within a filter" — narrows
// the active view's preset, never broadens scope across views.
// See docs/filter.md.

// Bookmark type values come from Readeck (`article` / `photo` / `video`).
// Display labels map `photo` ↔ Picture to match the MyDeck UI.
export const TYPE_VALUES = ['article', 'photo', 'video'];
export const TYPE_LABELS = { article: 'Article', photo: 'Picture', video: 'Video' };

export function defaultFilterState() {
    return {
        search: '',
        title: '',
        site: '',
        label: null,
        fromDate: '',
        toDate: '',
        types: new Set(),
        isFavorite: null,
        isArchived: null,
        withLabels: null,
    };
}

// Per-view preset — fields that are pinned by the drawer view's own query.
// Used to hide tri-states in the form that would always be no-op or always-empty.
const PRESETS = {
    triage:    { isArchived: false },
    recovered: { withLabels: true  },
    replaced:  { isArchived: true, withLabels: true },
    ignored:   { withLabels: true  },
};

export function presetFor(view) {
    return PRESETS[view] || {};
}

// True if the filter narrows the view further than the preset alone.
export function hasActiveFilters(state) {
    if (!state) return false;
    return (
        !!state.search ||
        !!state.title ||
        !!state.site ||
        !!state.label ||
        !!state.fromDate ||
        !!state.toDate ||
        (state.types && state.types.size > 0) ||
        state.isFavorite != null ||
        state.isArchived != null ||
        state.withLabels != null
    );
}

function ci(s) { return (s || '').toString().toLowerCase(); }

function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url || ''; }
}

function siteOf(b) {
    return b?.site_name || hostOf(b?.url);
}

function dateMs(s) {
    if (!s) return NaN;
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : NaN;
}

// dateString = 'YYYY-MM-DD' from <input type="date">. fromDate is start-of-day,
// toDate is end-of-day (inclusive).
function startOfDayMs(yyyymmdd) {
    if (!yyyymmdd) return null;
    const ms = Date.parse(`${yyyymmdd}T00:00:00`);
    return Number.isFinite(ms) ? ms : null;
}
function endOfDayMs(yyyymmdd) {
    if (!yyyymmdd) return null;
    const ms = Date.parse(`${yyyymmdd}T23:59:59.999`);
    return Number.isFinite(ms) ? ms : null;
}

export function matchesFilter(b, state) {
    if (!state) return true;

    if (state.search) {
        const q = ci(state.search);
        const hay = [b?.title, b?.description, b?.url, b?.site_name].map(ci).join(' ');
        if (!hay.includes(q)) return false;
    }
    if (state.title && !ci(b?.title).includes(ci(state.title))) return false;
    if (state.site && !ci(siteOf(b)).includes(ci(state.site))) return false;

    if (state.label) {
        const labels = b?.labels || [];
        if (!labels.includes(state.label)) return false;
    }

    const from = startOfDayMs(state.fromDate);
    const to = endOfDayMs(state.toDate);
    if (from !== null || to !== null) {
        const created = dateMs(b?.created);
        if (!Number.isFinite(created)) return false;
        if (from !== null && created < from) return false;
        if (to !== null && created > to) return false;
    }

    if (state.types && state.types.size > 0) {
        if (!state.types.has(b?.type)) return false;
    }

    if (state.isFavorite === true && !b?.is_marked) return false;
    if (state.isFavorite === false && !!b?.is_marked) return false;

    if (state.isArchived === true && !b?.is_archived) return false;
    if (state.isArchived === false && !!b?.is_archived) return false;

    if (state.withLabels === true && !((b?.labels || []).length > 0)) return false;
    if (state.withLabels === false && (b?.labels || []).length > 0) return false;

    return true;
}

// Collect distinct labels from an in-memory bookmark list, with counts. Used
// by the label picker. v1 keeps it client-side — no extra API call.
export function collectLabels(bookmarks) {
    const counts = new Map();
    for (const b of bookmarks || []) {
        for (const l of b?.labels || []) {
            counts.set(l, (counts.get(l) || 0) + 1);
        }
    }
    return counts;
}
