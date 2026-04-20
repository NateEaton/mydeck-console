// Brave Search: the subscription token lives in .env and is injected by the
// same-origin /brave/ proxy (nginx in prod, Vite in dev). It deliberately never
// enters the SPA bundle.

// Cache hydration policy: if the cached list is older than this, auto-refresh on mount.
export const CACHE_STALE_MS = 15 * 60 * 1000;

export const RECOVERY_LABEL_ARCHIVE = 'recovered-archive.org';
export const RECOVERY_LABEL_SEARCH = 'recovered-search';
export const RECOVERY_LABEL_MANUAL = 'recovered-manual';

// Source-specific deprecation labels applied to the *original* (old) bookmark.
export const DEPRECATION_LABEL_ARCHIVE = 'replaced-archive.org';
export const DEPRECATION_LABEL_SEARCH = 'replaced-search';
export const DEPRECATION_LABEL_MANUAL = 'replaced-manual';
