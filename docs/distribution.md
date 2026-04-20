# Distribution Spec — Tester Release

**Status:** Draft
**Audience:** A small group of existing MyDeck / Readeck self-hosters willing to help test repair workflows.
**Explicit non-goal:** Production-grade release. No multi-user auth, no hardened defaults, no public signup flow.

---

## Goals

1. A tester should be able to go from "heard about it" to "repairing a bookmark" in under 10 minutes, using tools they already have (Docker or nginx/Caddy).
2. Testers can update to new builds quickly as iteration continues, and can report a specific version back in feedback.
3. No changes to how app config (Readeck URL, API token, Brave key) is entered — the existing in-app **Settings modal** remains the only configuration surface. Env vars / baked-in config are deliberately out of scope for this round.
4. Cover both "just give me a container" users and "I already have a reverse proxy" users.

## Non-goals (for this round)

- Multi-arch image builds beyond what GitHub Actions gives us for free (`linux/amd64`, `linux/arm64`).
- Signed images, SBOMs, supply-chain hardening.
- Automatic Readeck discovery or OAuth — testers paste an API token like today.
- Persisted per-user server-side state. The app remains a pure SPA with IndexedDB + localStorage.

---

## Distribution forms

### A. Docker image (primary path)

A single `nginx:alpine`-based image containing:

- The Vite-built SPA in `/usr/share/nginx/html`.
- An nginx config that:
  - Serves the SPA with SPA-style fallback to `index.html`.
  - Proxies `/api/` → the tester's Readeck instance.
  - Proxies `/cdx/` → `https://web.archive.org/cdx/` (no CORS headers from archive.org).
  - Proxies `/brave/` → `https://api.search.brave.com/` with `X-Subscription-Token` injected server-side (Brave is also CORS-blocked, and this keeps the key off the SPA bundle).

**Required runtime input (env vars):**

| Var | Purpose | Example |
|---|---|---|
| `READECK_UPSTREAM` | Internal URL of their Readeck container or host | `http://readeck:8000` |

**Optional:**

| Var | Purpose | Default |
|---|---|---|
| `LISTEN_PORT` | Port nginx binds inside the container | `80` |
| `BRAVE_API_KEY` | Brave Search subscription token. When set, the `/brave/` proxy injects it as `X-Subscription-Token`. Unset → Search tab surfaces a clear "proxy token missing" error but the rest of the app still works. | *(unset)* |

The Readeck API token is still entered via the in-app **Settings modal** and lives in the browser's `localStorage`. `READECK_UPSTREAM` only controls where the reverse proxy forwards `/api/` requests; `BRAVE_API_KEY` only controls what token the `/brave/` proxy injects. Neither is shown in the UI.

**Entrypoint behavior:**

- On container start, `envsubst` renders `/etc/nginx/templates/default.conf.template` → `/etc/nginx/conf.d/default.conf`, substituting `${READECK_UPSTREAM}`, `${LISTEN_PORT}`, and `${BRAVE_API_KEY}`.
- If `READECK_UPSTREAM` is unset, the container fails fast with a clear error message rather than silently serving a broken app.
- If `BRAVE_API_KEY` is unset, the container starts anyway — the Brave proxy will forward with an empty token and Brave will return 401, which the SPA surfaces as "proxy token missing".

**Publishing:**

- Image pushed to **GHCR** (`ghcr.io/<owner>/mydeck-console`).
- Tags: `:vX.Y.Z` on every git tag; `:latest` always points at the newest tag (not `main`, so testers don't get half-finished work).
- Built via GitHub Actions on tag push. Multi-arch (`amd64`, `arm64`) using `docker/build-push-action` + `setup-qemu`.

**Example tester onboarding (compose snippet in README):**

```yaml
services:
  mydeck-console:
    image: ghcr.io/<owner>/mydeck-console:latest
    environment:
      READECK_UPSTREAM: http://readeck:8000
      BRAVE_API_KEY: ${BRAVE_API_KEY:-}  # optional, enables the Search tab
    ports:
      - "8082:80"
    depends_on:
      - readeck
```

Tester then opens `http://host:8082`, enters their Readeck API token in Settings, and is working.

### B. Static bundle (secondary path)

For testers who already run nginx, Caddy, or Traefik in front of Readeck and would rather not add a container.

- Attach `mydeck-console-vX.Y.Z.tar.gz` (the contents of `dist/`) to each GitHub Release.
- README section: "Serve behind your own reverse proxy" with:
  - Where to unpack the files.
  - The three proxy `location` blocks required (`/api/` → Readeck, `/cdx/` → `web.archive.org`, `/brave/` → `api.search.brave.com` with injected `X-Subscription-Token`).
  - Minimum headers / CSP notes if any.

No rendered nginx config is shipped (the rendered `.conf` files contain the Brave token and are gitignored). The `nginx/*.conf.template` files in the repo plus `./render-nginx.sh` serve as the reference and are called out in the README.

---

## Release process

1. Bump `version` in `package.json`.
2. Update `CHANGELOG.md` (created as part of this work) with tester-relevant changes.
3. Tag: `git tag vX.Y.Z && git push --tags`.
4. GitHub Actions workflow `.github/workflows/release.yml`:
   - Checks out at the tag.
   - `npm ci && npm run build`.
   - Builds and pushes the multi-arch image to GHCR with tags `:vX.Y.Z` and `:latest`.
   - Creates a GitHub Release and attaches `mydeck-console-vX.Y.Z.tar.gz` (contents of `dist/`).
   - Auto-generates release notes from commit messages (or pulls from `CHANGELOG.md`).

Version scheme: `v0.x.y` while in tester phase. No stability promises implied.

---

## Repo additions required

- `Dockerfile` — multi-stage: `node:lts-alpine` build → `nginx:alpine` runtime.
- `docker/nginx.conf.template` — the envsubst-ready config.
- `docker/entrypoint.sh` — validates `READECK_UPSTREAM`, runs envsubst, execs nginx.
- `.github/workflows/release.yml` — build + push on tag.
- `CHANGELOG.md`.
- README updates:
  - "Quick start (Docker)" section.
  - "Static bundle" section.
  - "What config lives where" note: env var for proxy target; Settings modal for everything else.

---

## Tester-facing rough edges to call out in README

- The app talks to Readeck from the **browser** via the app's own `/api/` proxy. If Readeck is only reachable from the tester's LAN, the browser must also be on the LAN.
- Archive.org has aggressive per-session rate limits; the app handles this gracefully but testers should know to wait a few minutes if they hit it.
- IndexedDB cache is per-browser-per-origin — switching devices means re-fetching the broken-bookmark list (cheap, but worth flagging).
- No telemetry. Tester feedback comes via whatever channel we set up (issues, email, etc.) — to be decided before first release.

---

## Open questions (to resolve with testers on board)

1. Feedback channel: GitHub Issues on a public repo, a private repo with invites, or something lighter?
2. Do we want a `:nightly` tag built from `main` for the most-engaged testers, or keep `:latest` == newest tag only?
3. Brave Search API key — tester-supplied via `BRAVE_API_KEY`, or do we ship a shared key with rate-limit warnings? (Leaning tester-supplied; keeps scope small and keeps our Brave quota out of the blast radius.)
