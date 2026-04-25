/**
 * Readeck OAuth 2.0 Authorization Code Flow with PKCE.
 *
 * Spec: https://datatracker.ietf.org/doc/html/rfc7636 (PKCE),
 *       https://datatracker.ietf.org/doc/html/rfc7591 (Dynamic Client Registration).
 *
 * Flow used by this SPA:
 *   1. registerClient()       — POST /api/oauth/client (ephemeral, 10 min lifetime)
 *   2. buildAuthUrl()         — redirect browser to <server>/authorize?...
 *   3. (user signs in / approves at Readeck)
 *   4. (browser returns to redirect_uri with ?code=...&state=...)
 *   5. exchangeCodeForToken() — POST /api/oauth/token, get access_token
 *   6. revokeToken()          — POST /api/profile/tokens/{id}/delete on sign-out
 *
 * Tokens have no expiry / refresh — same lifetime as personal access tokens.
 */

const SCOPES = 'bookmarks:read bookmarks:write profile:read';
const CLIENT_NAME = 'MyDeck Console';
const CLIENT_URI = 'https://github.com/NateEaton/mydeck-console';
const SOFTWARE_ID = 'com.mydeck.console';
const SOFTWARE_VERSION = '0.1.0';

// Transient state lives in sessionStorage so a separate tab with its own
// flow can't trample it, and so it dies with the tab if the user gives up.
const SESSION_KEYS = {
  verifier: 'oauth_pkce_verifier',
  state: 'oauth_state',
  clientId: 'oauth_client_id',
  serverUrl: 'oauth_server_url',
  redirectUri: 'oauth_redirect_uri',
};

/* ------------------------------------------------------------------ */
/* PKCE helpers                                                       */
/* ------------------------------------------------------------------ */

function generateRandomString(length = 64) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    out += alphabet[buf[i] % alphabet.length];
  }
  return out;
}

function base64UrlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function pkceChallengeFromVerifier(verifier) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return base64UrlEncode(new Uint8Array(digest));
}

/* ------------------------------------------------------------------ */
/* Server feature check                                               */
/* ------------------------------------------------------------------ */

/**
 * GET /api/info — public route, no auth needed. Verifies the server is
 * a Readeck instance and exposes the `oauth` feature flag.
 *
 * Uses the same-origin /api/ reverse proxy to avoid CORS. The user-entered
 * server URL is informational here; the proxy is the source of truth for
 * what Readeck instance we actually talk to.
 *
 * @returns {Promise<{ supportsOAuth: boolean, info: object }>}
 */
export async function fetchServerInfo() {
  const res = await fetch('/api/info', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Server info request failed (${res.status})`);
  const info = await res.json();
  const features = Array.isArray(info?.features) ? info.features : [];
  return { supportsOAuth: features.includes('oauth'), info };
}

/* ------------------------------------------------------------------ */
/* Step 1 — register an ephemeral client                              */
/* ------------------------------------------------------------------ */

/**
 * Register an ephemeral OAuth client (RFC 7591). Goes through the same-origin
 * /api/ proxy.
 *
 * @param {string} redirectUri  Where Readeck will redirect after auth — must
 *                              exactly match the value passed to /authorize
 * @returns {Promise<{ client_id: string }>}
 */
async function registerClient(redirectUri) {
  const body = {
    client_name: CLIENT_NAME,
    client_uri: CLIENT_URI,
    software_id: SOFTWARE_ID,
    software_version: SOFTWARE_VERSION,
    grant_types: ['authorization_code'],
    redirect_uris: [redirectUri],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };

  const res = await fetch('/api/oauth/client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Client registration failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Step 2 — start the flow (registers client, stashes state, redirect) */
/* ------------------------------------------------------------------ */

/**
 * Kick off the OAuth flow. After this call returns, the browser will
 * have navigated to the authorization page; control returns to the SPA
 * via the redirect_uri after the user approves.
 *
 * @param {string} serverUrl   Absolute Readeck origin — used only for the
 *                              top-level /authorize browser redirect.
 *                              Must match what the SPA's /api/ proxy points to,
 *                              otherwise the registered client_id won't be
 *                              recognized at /authorize.
 * @param {string} redirectUri Must exactly match the URI registered;
 *                              SPA generally passes its own current location.
 */
export async function startSignIn(serverUrl, redirectUri) {
  const verifier = generateRandomString(64);
  const challenge = await pkceChallengeFromVerifier(verifier);
  const state = generateRandomString(32);

  const { client_id } = await registerClient(redirectUri);

  // Stash everything we'll need on the callback side BEFORE we navigate
  // away. sessionStorage survives the OAuth round-trip in the same tab.
  sessionStorage.setItem(SESSION_KEYS.verifier, verifier);
  sessionStorage.setItem(SESSION_KEYS.state, state);
  sessionStorage.setItem(SESSION_KEYS.clientId, client_id);
  sessionStorage.setItem(SESSION_KEYS.serverUrl, serverUrl);
  sessionStorage.setItem(SESSION_KEYS.redirectUri, redirectUri);

  const params = new URLSearchParams({
    client_id,
    redirect_uri: redirectUri,
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    response_type: 'code',
  });

  window.location.assign(`${stripTrailingSlash(serverUrl)}/authorize?${params}`);
}

/* ------------------------------------------------------------------ */
/* Step 3 — handle the redirect back to the SPA                        */
/* ------------------------------------------------------------------ */

/**
 * If the current URL contains an OAuth callback (`?code=...&state=...`
 * or `?error=...`), pulls the saved PKCE state, exchanges the code for
 * an access token, and returns the result. Otherwise returns null.
 *
 * Caller is responsible for clearing the URL after a successful exchange
 * (so a refresh doesn't replay the now-stale code).
 *
 * @returns {Promise<{
 *   accessToken: string,
 *   tokenId: string | null,
 *   scope: string | null,
 *   serverUrl: string,
 * } | { error: string, errorDescription?: string } | null>}
 */
export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const error = params.get('error');

  if (!code && !error) return null;

  const verifier = sessionStorage.getItem(SESSION_KEYS.verifier);
  const expectedState = sessionStorage.getItem(SESSION_KEYS.state);
  const clientId = sessionStorage.getItem(SESSION_KEYS.clientId);
  const serverUrl = sessionStorage.getItem(SESSION_KEYS.serverUrl);

  // Always clear the transient state — we either consume it now or it's stale.
  clearTransientState();

  if (error) {
    return {
      error,
      errorDescription: params.get('error_description') || undefined,
    };
  }

  if (!verifier || !clientId || !serverUrl) {
    return { error: 'invalid_state', errorDescription: 'Sign-in session was lost. Try again.' };
  }
  if (!returnedState || returnedState !== expectedState) {
    return { error: 'invalid_state', errorDescription: 'OAuth state mismatch — possible CSRF attempt.' };
  }

  const tokenRes = await fetch('/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    let errBody = null;
    try { errBody = await tokenRes.json(); } catch { /* */ }
    return {
      error: errBody?.error || 'token_request_failed',
      errorDescription: errBody?.error_description || `HTTP ${tokenRes.status}`,
    };
  }

  const tok = await tokenRes.json();
  return {
    accessToken: tok.access_token,
    tokenId: tok.id ?? null,
    scope: tok.scope ?? null,
    serverUrl,
  };
}

/* ------------------------------------------------------------------ */
/* Sign-out — revoke the token server-side                             */
/* ------------------------------------------------------------------ */

/**
 * Best-effort revoke. Failure to reach the server should not block local
 * sign-out — caller should still clear local state.
 *
 * Goes through the same-origin /api/ proxy.
 *
 * @param {string} accessToken
 * @param {string|null} tokenId  Token ID returned alongside access_token at exchange
 */
export async function revokeToken(accessToken, tokenId) {
  if (!tokenId) return;
  try {
    await fetch(`/api/profile/tokens/${tokenId}/delete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
  } catch {
    // network failure on sign-out is non-fatal — local state still cleared
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

export function clearTransientState() {
  for (const k of Object.values(SESSION_KEYS)) sessionStorage.removeItem(k);
}

function stripTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * The SPA's own URL (origin + pathname, no query/hash). Same value is
 * registered as redirect_uri and passed to the authorize URL — they
 * must match exactly.
 */
export function defaultRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}
