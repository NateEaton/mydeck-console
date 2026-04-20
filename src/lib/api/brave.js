/**
 * @typedef {Object} BraveCandidate
 * @property {string} title
 * @property {string} url
 * @property {string} description
 * @property {string} hostname
 */

export class BraveClient {
    /**
     * Search the web for replacement candidates.
     *
     * The Brave API is CORS-blocked for browsers and requires X-Subscription-Token,
     * so we call it through a same-origin proxy (/brave/ → api.search.brave.com) that
     * injects the token server-side. The token never enters the SPA bundle.
     *
     * @param {string} query
     * @param {{ count?: number }} [options]
     * @returns {Promise<BraveCandidate[]>}
     */
    async search(query, { count = 10 } = {}) {
        const url = `/brave/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            let message = `${response.status}`;
            try {
                const body = await response.json();
                if (body?.message) message += `: ${body.message}`;
            } catch { /* unparseable body */ }
            if (response.status === 401 || response.status === 403) {
                throw new Error(`Brave Search: proxy token missing or invalid (${message})`);
            }
            throw new Error(`Brave Search API Error: ${message}`);
        }

        const data = await response.json();
        return (data?.web?.results ?? []).map(r => ({
            title: r.title,
            url: r.url,
            description: r.description,
            hostname: r.meta_url?.hostname
        }));
    }
}
