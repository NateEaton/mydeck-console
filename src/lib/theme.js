/**
 * App theme: 'system' (follows OS preference), 'light', or 'dark'.
 *
 * Storage: localStorage['app_theme']. The dark variant is applied as a
 * `.dark` class on documentElement, matching the selectors in theme.css.
 *
 * For 'system' we also subscribe to `prefers-color-scheme` change events so
 * the user toggling their OS setting flips us in real time.
 */

const STORAGE_KEY = 'app_theme';
const VALID = new Set(['system', 'light', 'dark']);

export function getTheme() {
  const v = localStorage.getItem(STORAGE_KEY);
  return VALID.has(v) ? v : 'system';
}

export function setTheme(t) {
  if (!VALID.has(t)) return;
  localStorage.setItem(STORAGE_KEY, t);
  applyTheme(t);
}

export function applyTheme(t) {
  const isDark = t === 'dark' || (t === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', isDark);
}

function systemPrefersDark() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

let mqlListener = null;
export function setupSystemThemeListener() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  if (mqlListener) return;
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mqlListener = () => {
    if (getTheme() === 'system') applyTheme('system');
  };
  mql.addEventListener('change', mqlListener);
}
