/**
 * @typedef {Object} ReadeckBookmark
 * @property {string} id
 * @property {string} url
 * @property {string} title
 * @property {string} created
 * @property {boolean} is_marked
 * @property {number} read_progress
 * @property {string[]} labels
 */

const PAGE_LIMIT = 100;

export class ReadeckClient {
    constructor(baseUrl = '', apiToken = '') {
        this.baseUrl = baseUrl;
        this.apiToken = apiToken;
    }

    /** Returns parsed JSON body (or null for 204). Throws on non-2xx. */
    async request(path, options = {}) {
        const res = await this._fetch(path, options);
        if (res.status === 204) return null;
        return res.json();
    }

    /** Returns the raw Response so callers can read headers. Throws on non-2xx. */
    async _fetch(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
        };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            let message = response.statusText;
            try {
                const body = JSON.parse(text);
                message = body.message || body.error || message;
            } catch { if (text) message = text.slice(0, 200); }
            throw new Error(`Readeck ${response.status}: ${message}`);
        }
        return response;
    }

    async getProfile() {
        return this.request('/api/profile');
    }

    /**
     * Fetches every broken bookmark by paging through the API.
     * Readeck returns Total-Count / Total-Pages headers; we loop until done.
     * @returns {Promise<ReadeckBookmark[]>}
     */
    async getBrokenBookmarks() {
        // is_archived=false excludes ones we already replaced (we archive originals on repair).
        const all = [];
        let offset = 0;
        while (true) {
            const res = await this._fetch(
                `/api/bookmarks?has_errors=true&is_archived=false&limit=${PAGE_LIMIT}&offset=${offset}`
            );
            const page = await res.json();
            if (!Array.isArray(page) || page.length === 0) break;
            all.push(...page);

            const total = Number(res.headers.get('Total-Count') ?? res.headers.get('total-count'));
            if (Number.isFinite(total) && all.length >= total) break;
            if (page.length < PAGE_LIMIT) break;
            offset += PAGE_LIMIT;
            if (offset > 100_000) break;
        }
        return all;
    }

    async getBookmark(id) {
        return this.request(`/api/bookmarks/${id}`);
    }

    /**
     * POST /bookmarks — Readeck returns 202 with Location header containing the new id.
     * Body shape varies by version; we try body.id first, then parse Location.
     * @returns {Promise<{ id: string }>}
     */
    async createBookmark(data) {
        const res = await this._fetch('/api/bookmarks', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        let body = null;
        try { body = await res.json(); } catch { /* empty body is allowed */ }

        let id = body?.id || body?.bookmark_id || body?.link_id;
        if (!id) {
            const loc = res.headers.get('Location') || res.headers.get('location') || res.headers.get('Bookmark-Id');
            if (loc) {
                const m = loc.match(/\/bookmarks\/([^/?#]+)/) || [null, loc.split('/').pop()];
                id = m[1];
            }
        }
        if (!id) throw new Error('Readeck create: could not resolve new bookmark id from response');
        return { ...(body || {}), id };
    }

    async updateBookmark(id, data) {
        if (!id) throw new Error('updateBookmark called without id');
        return this.request(`/api/bookmarks/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteBookmark(id) {
        if (!id) throw new Error('deleteBookmark called without id');
        return this.request(`/api/bookmarks/${id}`, {
            method: 'DELETE',
        });
    }

    /**
     * Repairs a bookmark by cloning metadata to a new URL and deprecating the old one.
     *
     * Readeck's POST /bookmarks is async (202 Accepted + server-side fetch). PATCHing labels
     * on a still-loading bookmark was racy — we now pass labels at creation time via the
     * bookmarkCreate.labels field and then only PATCH is_marked / read_progress.
     *
     * @param {string} oldId
     * @param {string} newUrl
     * @param {{ deprecateAction?: 'archive' | 'delete', recoveryLabel?: string, deprecationLabel?: string }} [options]
     */
    async repairBookmark(oldId, newUrl, options = {}) {
        const {
            deprecateAction = 'archive',
            recoveryLabel = 'recovered',
            deprecationLabel = 'replaced',
        } = options;
        const original = await this.getBookmark(oldId);

        // Inherit original labels except deprecation/recovery markers (in case the original
        // was itself a prior replacement). Add this run's recovery label.
        const carried = (original.labels || []).filter(l =>
            l !== 'replacement' &&
            !l.startsWith('recovered-') &&
            !l.startsWith('replaced-') &&
            l !== 'replaced'
        );
        const newLabels = Array.from(new Set([...carried, recoveryLabel]));

        const replacement = await this.createBookmark({
            url: newUrl,
            created: original.created,
            labels: newLabels,
        });

        await this.updateBookmark(replacement.id, {
            read_progress: original.read_progress,
            is_marked: original.is_marked,
        });

        if (deprecateAction === 'delete') {
            await this.deleteBookmark(oldId);
        } else {
            // add_labels (not full replace) — safer since we don't want to risk removing
            // other user labels on the original if our inherited list was stale.
            await this.updateBookmark(oldId, {
                add_labels: [deprecationLabel],
                is_archived: true,
            });
        }

        return replacement;
    }
}
