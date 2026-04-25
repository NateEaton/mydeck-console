/**
 * @typedef {Object} ClassifiedError
 * @property {'http' | 'network' | 'extract-failed' | 'loading' | 'unknown'} kind
 * @property {number} [code]      HTTP status code (when kind === 'http')
 * @property {string} summary     One-line human-facing description
 * @property {string} [detail]    Optional second line with more context
 * @property {boolean} liveUrl    True when the original URL likely still responds (extract-failed case)
 */

const HTTP_STATUS_TEXT = {
  400: 'Bad request',
  401: 'Authentication required',
  403: 'Forbidden',
  404: 'Page not found',
  405: 'Method not allowed',
  408: 'Request timeout',
  410: 'Page gone',
  429: 'Rate limited',
  500: 'Server error',
  502: 'Upstream error',
  503: 'Service unavailable',
  504: 'Gateway timeout',
};

/**
 * Classify a Readeck extraction log into a user-facing error shape.
 * Log format from Readeck is line-oriented with `[LEVEL]` prefixes and
 * key="value" tail fields. This parser keys off stable substrings.
 * @param {string} logText
 * @returns {ClassifiedError}
 */
export function classifyExtractionLog(logText) {
  const text = logText || '';
  if (!text.trim()) return unknown();

  const httpCodeMatch = text.match(/Invalid status code \((\d{3})\)/);
  if (httpCodeMatch) {
    const code = Number(httpCodeMatch[1]);
    const label = HTTP_STATUS_TEXT[code] || `HTTP ${code}`;
    return {
      kind: 'http',
      code,
      summary: `${code} ${label}`,
      liveUrl: false,
    };
  }

  // Network-layer failures. Readeck wraps Go's net errors; we match the
  // characteristic fragments rather than any one exact message.
  if (/dial tcp|no such host|i\/o timeout|connection refused|TLS handshake|certificate|EOF/i.test(text)) {
    return {
      kind: 'network',
      summary: 'Network error',
      detail: firstErrLine(text) || 'Readeck could not connect to the host.',
      liveUrl: false,
    };
  }

  // Extract-failed-but-live: page was fetched (no "cannot load resource" / status code error)
  // but the readability passes all yielded zero-length content.
  const extractFail =
    /could not extract content/i.test(text) ||
    countMatches(text, /parsed article length is too short/gi) >= 2;
  if (extractFail) {
    return {
      kind: 'extract-failed',
      summary: 'Readeck could not extract the article',
      detail: 'The page loaded, but the parser could not find meaningful content. The original URL may still be readable in a browser.',
      liveUrl: true,
    };
  }

  // State-based fallbacks when no log content is conclusive.
  if (/^\s*$/.test(text)) return unknown();

  return unknown();
}

/**
 * Fallback classifier when no log is available — works off the bookmark's
 * `state` / `loaded` fields alone. Used when `resources.log.src` hasn't
 * resolved yet or the fetch failed.
 * @param {{ state?: number, loaded?: boolean }} bookmark
 * @returns {ClassifiedError}
 */
export function classifyBookmarkState(bookmark) {
  if (!bookmark) return unknown();
  if (bookmark.state === 2) {
    return { kind: 'loading', summary: 'Still loading', liveUrl: false };
  }
  if (bookmark.loaded === false) {
    return { kind: 'loading', summary: 'Not yet loaded', liveUrl: false };
  }
  return unknown();
}

function unknown() {
  return { kind: 'unknown', summary: 'Unavailable', liveUrl: false };
}

/** Return the first [ERRO] line's err="..." value, stripped of quotes. */
function firstErrLine(text) {
  const m = text.match(/\[ERRO\][^\n]*?err="([^"]+)"/);
  return m ? m[1] : '';
}

function countMatches(text, regex) {
  const m = text.match(regex);
  return m ? m.length : 0;
}
