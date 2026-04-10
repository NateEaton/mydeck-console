/**
 * @typedef {Object} ArchiveSnapshot
 * @property {string} url
 * @property {string} timestamp
 * @property {number} status
 */

export class ArchiveClient {
    /**
     * Search for snapshots using CDX API
     * @param {string} originalUrl 
     * @returns {Promise<ArchiveSnapshot[]>}
     */
    async findSnapshots(originalUrl) {
        const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(originalUrl)}&output=json&fl=timestamp,original,statuscode&filter=statuscode:200`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Archive.org API Error');

        const data = await response.json();
        if (!data || data.length <= 1) return [];

        // Skip headers [timestamp, original, statuscode]
        return data.slice(1).map(([timestamp, original, statuscode]) => ({
            timestamp,
            original,
            statuscode,
            url: `https://web.archive.org/web/${timestamp}/${original}`
        })).reverse(); // Newest first
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
