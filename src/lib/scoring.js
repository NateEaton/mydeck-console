/**
 * @typedef {{ url: string, title: string }} Original
 * @typedef {{ url: string, title?: string, description?: string, hostname?: string }} Candidate
 * @typedef {{ score: number, reason: string, tier: 'high' | 'medium' | 'low' }} ScoreResult
 */

const STOPWORDS = new Set(['the','a','an','and','or','of','to','in','on','for','with','is','are']);

/**
 * Normalize a string for token comparison.
 * @param {string} s
 * @returns {string[]}
 */
function tokenize(s) {
  if (!s) return [];
  return s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(t => t && !STOPWORDS.has(t));
}

/**
 * Compute token-set Jaccard similarity between two strings.
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {number}
 */
export function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Extract hostname from a URL string without throwing.
 * @param {string} url
 * @returns {string}
 */
function safeHostname(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

/**
 * Score a single candidate against the original bookmark.
 * @param {Original} original
 * @param {Candidate} candidate
 * @returns {ScoreResult}
 */
export function scoreCandidate(original, candidate) {
  try {
    const origTitle = (original?.title ?? '').trim().toLowerCase();
    const candTitle = (candidate?.title ?? '').trim().toLowerCase();
    const origHost  = safeHostname(original?.url ?? '');
    const candHost  = candidate?.hostname ?? safeHostname(candidate?.url ?? '');
    const sameHost  = origHost && candHost && origHost === candHost;
    const sim       = titleSimilarity(origTitle, candTitle);
    const exactMatch = origTitle.length > 0 && origTitle === candTitle;

    let score, reason;
    if (exactMatch && sameHost)      { score = 95; reason = 'Exact title + same domain'; }
    else if (exactMatch)             { score = 75; reason = 'Exact title, different domain'; }
    else if (sim >= 0.7 && sameHost) { score = 85; reason = 'Strong title match + same domain'; }
    else if (sim >= 0.7)             { score = 65; reason = 'Strong title match, different domain'; }
    else if (sim >= 0.4)             { score = 40; reason = 'Partial title match'; }
    else                             { score = 20; reason = 'Keyword/URL overlap only'; }

    const tier = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';
    return { score, reason, tier };
  } catch {
    return { score: 20, reason: 'Keyword/URL overlap only', tier: 'low' };
  }
}

/**
 * Stable-sort candidates descending by score, returning a new array.
 * @param {(Candidate & ScoreResult)[]} candidates
 * @returns {(Candidate & ScoreResult)[]}
 */
export function sortByScore(candidates) {
  if (!Array.isArray(candidates)) return [];
  return candidates.map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.score - a.c.score || a.i - b.i)
    .map(({ c }) => c);
}
