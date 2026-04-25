/**
 * @typedef {{ url: string, title: string }} Original
 * @typedef {{ url: string, title?: string, description?: string, hostname?: string, pubDate?: string, author?: string }} Candidate
 * @typedef {{ score: number, reason: string, tier: 'high' | 'medium' | 'low' }} ScoreResult
 * @typedef {{ url: string, title?: string, created?: string, published?: string, author?: string }} BookmarkInput
 * @typedef {{ url: string, timestamp: string, original?: string, statuscode?: string|number }} ArchiveSnapshot
 * @typedef {ArchiveSnapshot & ScoreResult & { preCreate: boolean, delta: number|null, source: 'archive' }} ArchiveScored
 * @typedef {Candidate & ScoreResult & { source: 'brave' }} BraveScored
 * @typedef {{ closest: ArchiveScored[], interleaved: (ArchiveScored | BraveScored)[] }} MergeResult
 */

const STOPWORDS = new Set(['the','a','an','and','or','of','to','in','on','for','with','is','are']);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365.25 * MS_PER_DAY;

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
 * Heuristic registrable-domain extraction: last two dot-separated labels.
 * Wrong for public suffixes like `.co.uk`; acceptable for a ~8-point heuristic.
 * @param {string} hostname
 * @returns {string}
 */
function registrableDomain(hostname) {
  if (!hostname) return '';
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
}

/**
 * Normalize a URL for exact-match comparison: lowercase host, drop fragment
 * and utm_* tracking params, strip trailing slash from non-root paths.
 * Returns empty string on unparseable input.
 * @param {string|null|undefined} url
 * @returns {string}
 */
function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(key) || key === 'fbclid' || key === 'gclid') {
        u.searchParams.delete(key);
      }
    }
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    u.pathname = path;
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname}${u.search}`;
  } catch {
    return '';
  }
}

/**
 * Extract the terminal path segment (the "slug"), stripped of common article
 * extensions and URL-decoded. Empty string for site-root URLs.
 * @param {string|null|undefined} url
 * @returns {string}
 */
function urlSlug(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return '';
    let slug = parts[parts.length - 1];
    try { slug = decodeURIComponent(slug); } catch { /* leave encoded */ }
    slug = slug.toLowerCase().replace(/\.(html?|php)$/i, '');
    return slug;
  } catch {
    return '';
  }
}

/**
 * Parse a 14-char archive timestamp (YYYYMMDDhhmmss) to a Date.
 * @param {string} ts
 * @returns {Date|null}
 */
function parseArchiveTimestamp(ts) {
  if (!ts || typeof ts !== 'string' || ts.length < 8) return null;
  const y = Number(ts.slice(0, 4));
  const m = Number(ts.slice(4, 6)) - 1;
  const d = Number(ts.slice(6, 8));
  const hh = Number(ts.slice(8, 10) || '0');
  const mm = Number(ts.slice(10, 12) || '0');
  const ss = Number(ts.slice(12, 14) || '0');
  const dt = new Date(Date.UTC(y, m, d, hh, mm, ss));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Parse a loose date string to a Date, or null.
 * @param {string|null|undefined} s
 * @returns {Date|null}
 */
function parseDate(s) {
  if (!s) return null;
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Human-friendly "+N mo" / "-N yr" delta string for reason text.
 * @param {number} deltaMs
 * @returns {string}
 */
function humanDelta(deltaMs) {
  const abs = Math.abs(deltaMs);
  const sign = deltaMs >= 0 ? '+' : '-';
  const days = abs / MS_PER_DAY;
  if (days < 30) return `${sign}${Math.max(1, Math.round(days))} d`;
  const months = abs / (MS_PER_YEAR / 12);
  if (months < 18) return `${sign}${Math.round(months)} mo`;
  const years = abs / MS_PER_YEAR;
  return `${sign}${years.toFixed(years < 10 ? 1 : 0)} yr`;
}

/**
 * Derive tier band from a 0–100 score.
 * @param {number} score
 * @returns {'high' | 'medium' | 'low'}
 */
function tierFor(score) {
  return score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';
}

/**
 * Clamp n to [lo, hi].
 * @param {number} n
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Score a single Brave candidate against the original bookmark, with
 * optional pub-date / byline / registrable-domain bonuses when those
 * fields are present on the candidate.
 * @param {BookmarkInput & Original} original
 * @param {Candidate} candidate
 * @returns {ScoreResult}
 */
export function scoreBraveCandidate(original, candidate) {
  try {
    const origTitle = (original?.title ?? '').trim().toLowerCase();
    const candTitle = (candidate?.title ?? '').trim().toLowerCase();
    const origHost  = safeHostname(original?.url ?? '');
    const candHost  = candidate?.hostname ?? safeHostname(candidate?.url ?? '');
    const sameHost  = !!(origHost && candHost && origHost === candHost);
    const origReg   = registrableDomain(origHost);
    const candReg   = registrableDomain(candHost);
    const sameReg   = !!(origReg && candReg && origReg === candReg);
    const origSlug  = urlSlug(original?.url);
    const candSlug  = urlSlug(candidate?.url);
    const sameSlug  = !!(origSlug && candSlug && origSlug === candSlug);
    const origNormUrl = normalizeUrl(original?.url);
    const candNormUrl = normalizeUrl(candidate?.url);
    const urlExact  = !!(origNormUrl && candNormUrl && origNormUrl === candNormUrl);

    // URL-structural signals dominate when present: they describe the actual
    // resource identity, independent of how Brave rendered the title.
    if (urlExact) {
      return { score: 99, reason: 'Exact URL match', tier: tierFor(99) };
    }
    if (sameHost && sameSlug) {
      return { score: 93, reason: 'Moved within site (same slug)', tier: tierFor(93) };
    }
    if (sameReg && !sameHost && sameSlug) {
      return { score: 90, reason: 'Same article at new subdomain', tier: tierFor(90) };
    }

    const sim       = titleSimilarity(origTitle, candTitle);
    const exactMatch = origTitle.length > 0 && origTitle === candTitle;

    let score, reason;
    if (exactMatch && sameHost)      { score = 95; reason = 'Exact title + same domain'; }
    else if (exactMatch)             { score = 75; reason = 'Exact title, different domain'; }
    else if (sim >= 0.7 && sameHost) { score = 85; reason = 'Strong title match + same domain'; }
    else if (sim >= 0.7)             { score = 65; reason = 'Strong title match, different domain'; }
    else if (sim >= 0.4)             { score = 40; reason = 'Partial title match'; }
    else                             { score = 20; reason = 'Keyword/URL overlap only'; }

    const bonuses = [];

    if (!sameHost && !sameReg && sameSlug) {
      score += 10;
      bonuses.push('matching slug');
    } else if (!sameHost && sameReg) {
      score += 8;
      bonuses.push('same site');
    }

    const origPub = parseDate(original?.published);
    const candPub = parseDate(candidate?.pubDate);
    if (origPub && candPub) {
      const diffDays = Math.abs(origPub.getTime() - candPub.getTime()) / MS_PER_DAY;
      if (diffDays <= 1) { score += 10; bonuses.push('pub-date match'); }
      else if (diffDays <= 7) { score += 5; bonuses.push('pub-date close'); }
    }

    const origAuthor = (original?.author ?? '').trim().toLowerCase();
    const candAuthor = (candidate?.author ?? '').trim().toLowerCase();
    if (origAuthor && candAuthor) {
      if (origAuthor === candAuthor) {
        score += 8;
        bonuses.push('byline match');
      } else {
        const origParts = origAuthor.split(/\s+/).filter(Boolean);
        const candParts = candAuthor.split(/\s+/).filter(Boolean);
        const origLast = origParts[origParts.length - 1];
        const candLast = candParts[candParts.length - 1];
        if (origLast && candLast && origLast === candLast) {
          score += 4;
          bonuses.push('last-name match');
        }
      }
    }

    score = clamp(Math.round(score), 0, 100);
    if (bonuses.length) reason = `${reason} (+${bonuses.join(', +')})`;
    return { score, reason, tier: tierFor(score) };
  } catch {
    return { score: 20, reason: 'Keyword/URL overlap only', tier: 'low' };
  }
}

/**
 * Back-compat alias: App.svelte still imports `scoreCandidate`.
 * @param {Original} original
 * @param {Candidate} candidate
 * @returns {ScoreResult}
 */
export const scoreCandidate = scoreBraveCandidate;

/**
 * Score the full archive snapshot set together. Longevity and pre/post
 * counts are set-level facts, so each snapshot's score depends on its
 * peers as well as its own distance from `created`.
 * @param {BookmarkInput} original
 * @param {ArchiveSnapshot[]} snapshots
 * @returns {ArchiveScored[]}
 */
export function scoreArchiveSnapshots(original, snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return [];
  const created = parseDate(original?.created);

  const enriched = snapshots.map(s => {
    const snapDate = parseArchiveTimestamp(s.timestamp);
    const delta = (created && snapDate) ? (snapDate.getTime() - created.getTime()) : null;
    return { snap: s, snapDate, delta };
  });

  if (!created) {
    return enriched.map(({ snap, delta }) => ({
      ...snap,
      score: 30,
      reason: 'Snapshot (no save date to compare)',
      tier: tierFor(30),
      preCreate: false,
      delta,
      source: /** @type {'archive'} */ ('archive')
    }));
  }

  const pre  = enriched.filter(e => e.delta != null && e.delta < 0);
  const post = enriched.filter(e => e.delta != null && e.delta >= 0);
  const unknown = enriched.filter(e => e.delta == null);

  pre.sort((a, b) => a.delta - b.delta);
  post.sort((a, b) => a.delta - b.delta);

  const closestPre  = pre.length  ? pre[pre.length - 1]  : null;
  const closestPost = post.length ? post[0]              : null;

  let longevityBonus = 0;
  if (pre.length >= 1) {
    const earliest = pre[0].snapDate.getTime();
    const latest   = pre[pre.length - 1].snapDate.getTime();
    const spanYears = Math.max(0, (latest - earliest) / MS_PER_YEAR);
    const countFactor = Math.min(1, Math.log(1 + pre.length) / Math.log(1 + 20));
    const spanFactor  = Math.min(1, spanYears / 5);
    longevityBonus = 25 * countFactor * (0.4 + 0.6 * spanFactor);
  }

  /** @param {number} absMs */
  const preDecay = (absMs) => {
    const years = absMs / MS_PER_YEAR;
    return Math.min(40, 15 * years / 1 + Math.max(0, (years - 1)) * 3.75);
  };
  /** @param {number} absMs */
  const postDecay = (absMs) => {
    const years = absMs / MS_PER_YEAR;
    return Math.min(60, 30 * years);
  };

  /** @type {ArchiveScored[]} */
  const scored = [];

  for (const e of pre) {
    const absMs = Math.abs(e.delta);
    const isClosest = e === closestPre;
    let base = 70 - preDecay(absMs);
    if (isClosest) base += longevityBonus;
    else if (pre.length > 1) base += longevityBonus * 0.25;
    const score = clamp(Math.round(base), 0, 100);
    const wellArchived = longevityBonus >= 15 && isClosest ? ', well-archived site' : '';
    const reason = isClosest
      ? `Closest snapshot before save (${humanDelta(e.delta)})${wellArchived}`
      : `Pre-save snapshot (${humanDelta(e.delta)})`;
    scored.push({
      ...e.snap,
      score,
      reason,
      tier: tierFor(score),
      preCreate: true,
      delta: e.delta,
      source: 'archive'
    });
  }

  const havePre = pre.length > 0;
  for (const e of post) {
    const absMs = Math.abs(e.delta);
    const isClosest = e === closestPost;
    let score;
    let reason;
    if (havePre) {
      // post-create snapshots are demoted when pre-create evidence exists —
      // cleaner signal, and they should sort below any decent Brave result
      const base = 30 - Math.min(20, postDecay(absMs) * 0.5);
      score = clamp(Math.round(base), 0, 30);
      reason = `Post-save snapshot (${humanDelta(e.delta)})`;
    } else if (isClosest) {
      const base = 55 - Math.min(25, postDecay(absMs) * 0.5);
      score = clamp(Math.round(base), 0, 60);
      reason = `Post-save fallback, closest after (${humanDelta(e.delta)})`;
    } else {
      const base = 40 - Math.min(30, postDecay(absMs));
      score = clamp(Math.round(base), 0, 50);
      reason = `Post-save snapshot (${humanDelta(e.delta)})`;
    }
    scored.push({
      ...e.snap,
      score,
      reason,
      tier: tierFor(score),
      preCreate: false,
      delta: e.delta,
      source: 'archive'
    });
  }

  for (const e of unknown) {
    scored.push({
      ...e.snap,
      score: 25,
      reason: 'Snapshot (undatable)',
      tier: tierFor(25),
      preCreate: false,
      delta: null,
      source: 'archive'
    });
  }

  return scored;
}

/**
 * Stable-sort candidates descending by score, returning a new array.
 * @template {{ score: number }} T
 * @param {T[]} candidates
 * @returns {T[]}
 */
export function sortByScore(candidates) {
  if (!Array.isArray(candidates)) return [];
  return candidates.map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.score - a.c.score || a.i - b.i)
    .map(({ c }) => c);
}

/**
 * Merge scored archive snapshots and scored Brave candidates into a single
 * list for the unified Bookmark view. The "Closest to save date" bracket
 * (closest pre-create snapshot, plus closest post-create only when no
 * pre-create exists) is emitted separately — everything else is sorted by
 * score with a pre-create > Brave > post-create tie-break.
 * @param {ArchiveScored[]} archive
 * @param {BraveScored[]} brave
 * @returns {MergeResult}
 */
export function mergeCandidates(archive, brave) {
  const archiveArr = Array.isArray(archive) ? archive : [];
  const braveArr   = Array.isArray(brave)   ? brave   : [];

  const pre  = archiveArr.filter(a => a.preCreate);
  const post = archiveArr.filter(a => !a.preCreate);

  let closestPre = null;
  if (pre.length) {
    closestPre = pre.reduce((best, cur) => {
      if (cur.delta == null) return best;
      if (!best || Math.abs(cur.delta) < Math.abs(best.delta)) return cur;
      return best;
    }, null);
  }

  let closestPost = null;
  if (!closestPre && post.length) {
    closestPost = post.reduce((best, cur) => {
      if (cur.delta == null || cur.delta < 0) return best;
      if (!best || cur.delta < best.delta) return cur;
      return best;
    }, null);
  }

  /** @type {ArchiveScored[]} */
  const closest = [];
  if (closestPre)  closest.push(closestPre);
  if (closestPost) closest.push(closestPost);

  const protectedSet = new Set(closest);

  /** @type {(ArchiveScored | BraveScored)[]} */
  const rest = [];
  for (const a of archiveArr) if (!protectedSet.has(a)) rest.push(a);
  for (const b of braveArr)   rest.push({ ...b, source: 'brave' });

  const tieRank = (c) => {
    if (c.source === 'archive') return c.preCreate ? 0 : 2;
    return 1;
  };

  const interleaved = rest
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const d = b.c.score - a.c.score;
      if (d !== 0) return d;
      const r = tieRank(a.c) - tieRank(b.c);
      if (r !== 0) return r;
      return a.i - b.i;
    })
    .map(({ c }) => c);

  return { closest, interleaved };
}
