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

export class ReadeckClient {
    constructor(baseUrl = '', apiToken = '') {
        this.baseUrl = baseUrl;
        this.apiToken = apiToken;
    }

    async request(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
            ...options.headers,
        };

        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Readeck API Error: ${error.message || response.statusText}`);
        }
        
        if (response.status === 204) return null;
        return response.json();
    }

    async getProfile() {
        return this.request('/api/profile');
    }

    /**
     * @returns {Promise<ReadeckBookmark[]>}
     */
    async getBrokenBookmarks() {
        // According to spec: GET /bookmarks?has_errors=true
        // Note: Check if Readeck uses pagination. Standard is often ?order=created-desc
        return this.request('/api/bookmarks?has_errors=true');
    }

    async getBookmark(id) {
        return this.request(`/api/bookmarks/${id}`);
    }

    async createBookmark(data) {
        // data: { url, created, ... }
        return this.request('/api/bookmarks', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateBookmark(id, data) {
        return this.request(`/api/bookmarks/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteBookmark(id) {
        return this.request(`/api/bookmarks/${id}`, {
            method: 'DELETE',
        });
    }

    /**
     * Repairs a bookmark by cloning metadata to a new URL and deprecating the old one.
     */
    async repairBookmark(oldId, newUrl, options = { deprecateAction: 'archive' }) {
        const original = await this.getBookmark(oldId);
        
        // 1. Create matching replacement
        const replacement = await this.createBookmark({
            url: newUrl,
            created: original.created,
        });

        // 2. Transfer metadata
        await this.updateBookmark(replacement.id, {
            read_progress: original.read_progress,
            is_marked: original.is_marked,
        });
        
        // 3. Add labels (original + recovery tag)
        const labelsToSync = [...(original.labels || [])];
        if (!labelsToSync.includes('recovered')) labelsToSync.push('recovered');
        
        await this.updateBookmark(replacement.id, {
            add_labels: labelsToSync
        });

        // 4. Deprecate original
        if (options.deprecateAction === 'delete') {
            await this.deleteBookmark(oldId);
        } else {
            // Option A: Safe deprecation
            await this.updateBookmark(oldId, {
                add_labels: ['link-dead'],
                is_archived: true
            });
        }

        return replacement;
    }
}
