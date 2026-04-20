/**
 * @typedef {Object} ArchiveSnapshot
 * @property {string} url
 * @property {string} timestamp
 * @property {number} status
 */

export class ArchiveRateLimitError extends Error {
    constructor(message = 'Archive.org rate limit reached. Try again in a few minutes.') {
        super(message);
        this.name = 'ArchiveRateLimitError';
        this.rateLimited = true;
    }
}

export class ArchiveClient {
    /**
     * Search for snapshots using CDX API
     * @param {string} originalUrl
     * @returns {Promise<ArchiveSnapshot[]>}
     */
    async findSnapshots(originalUrl) {
        // Same-origin proxy (/cdx/ → web.archive.org/cdx/) — archive.org sends no CORS headers
        const url = `/cdx/search/cdx?url=${encodeURIComponent(originalUrl)}&output=json&fl=timestamp,original,statuscode&filter=statuscode:200&limit=200`;

        let response;
        try {
            response = await fetch(url);
        } catch (e) {
            throw new Error(`Archive.org network error: ${e.message}`);
        }

        // 429 = too many requests; 509 = bandwidth exceeded. Archive.org sometimes returns
        // 200 with an HTML rate-limit page ("You have exceeded the allowed page load frequency").
        if (response.status === 429 || response.status === 509) {
            throw new ArchiveRateLimitError();
        }
        if (!response.ok) throw new Error(`Archive.org API Error: ${response.status}`);

        const text = await response.text();
        if (/exceeded the allowed page load frequency/i.test(text)) {
            throw new ArchiveRateLimitError();
        }

        let data;
        try { data = JSON.parse(text); }
        catch { throw new Error('Archive.org returned non-JSON response'); }
        if (!data || data.length <= 1) return [];

        return data.slice(1).map(([timestamp, original, statuscode]) => ({
            timestamp,
            original,
            statuscode,
            url: `https://web.archive.org/web/${timestamp}/${original}`
        })).reverse();
    }

    /**
     * Find the snapshot closest to a given date
     * @param {string} originalUrl 
     * @param {string} targetDate ISO date string
     */
    async findClosest(originalUrl, targetDate) {
        const snapshots = await this.findSnapshots(originalUrl);
        if (snapshots.length === 0) return null;

        const targetTs = targetDate.replace(/[-:T]/g, '').slice(0, 14);
        
        // Sort by absolute time difference
        return snapshots.sort((a, b) => {
            const diffA = Math.abs(Number(a.timestamp) - Number(targetTs));
            const diffB = Math.abs(Number(b.timestamp) - Number(targetTs));
            return diffA - diffB;
        })[0];
    }
}
