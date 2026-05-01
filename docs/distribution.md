# Distribution Spec — Tester Release

**Status:** Current. The Go single-binary migration has landed. Supersedes the earlier nginx-hosted plan.
**Audience:** A small group of existing MyDeck / Readeck self-hosters willing to help test repair workflows.
**Explicit non-goal:** Production-grade release. No multi-user auth, no hardened defaults, no public signup flow.

---

## Goals

1. A tester should be able to go from "heard about it" to "repairing a bookmark" in under 5 minutes. One binary download, two flags, done.
2. Testers can update to new builds by swapping the binary (or re-pulling the image) and can report a specific version via `mydeck-console --version`.
3. The Readeck API token is entered via the in-app **Settings modal**, same as today. The binary handles the Brave token and Readeck upstream via flags/env.
4. Cover both "just give me a binary" users and "I'd prefer a Docker image for my compose stack" users.

## Non-goals (for this round)

- Multi-arch builds beyond what GitHub Actions gives for free (`linux/amd64`, `linux/arm64`, `darwin/amd64`, `darwin/arm64`, `windows/amd64`).
- Signed binaries/images, SBOMs, supply-chain hardening.
- Automatic Readeck discovery. Authentication uses OAuth 2.0 PKCE — testers sign in through the in-app OAuth flow.
- Persisted per-user server-side state. The binary is stateless; the SPA uses IndexedDB + localStorage in the browser.

---

## Distribution forms

### A. Platform binary (primary path)

A single statically-linked `mydeck-console` binary per platform, produced by `go build` with the Svelte `dist/` embedded via `go:embed`. It serves the SPA and the three proxies (`/api/`, `/cdx/`, `/brave/`) from one port.

**Configuration surface (CLI flags; env vars of the same names serve as defaults):**

| Flag / Env | Required | Purpose | Example |
|---|---|---|---|
| `--readeck-upstream` / `READECK_UPSTREAM` | Yes | Internal URL of the tester's Readeck instance. Used as the `/api/` proxy target. | `http://readeck:8000` |
| `--brave-key` / `BRAVE_API_KEY` | No | Brave Search subscription token. When set, the `/brave/` proxy injects it as `X-Subscription-Token`. Unset → the Search tab surfaces a "proxy token missing" error; Archive and Manual still work. | *(unset)* |
| `--listen` / `LISTEN` | No | Address:port to bind. Default `:8080`. | `:9090` |

The Readeck API token is entered in the in-app **Settings modal** and lives in the browser's `localStorage`. It never reaches the binary's config surface.

**Startup behavior:**

- If `--readeck-upstream` is unset, the binary exits immediately with a clear error. No half-working state.
- If `--brave-key` is unset, the binary starts normally; the `/brave/` proxy forwards an empty token and Brave returns 401, which the SPA surfaces cleanly.

**Publishing:**

- Built via GitHub Actions on tag push. One workflow job matrix-builds:
  - `linux/amd64`, `linux/arm64`
  - `darwin/amd64`, `darwin/arm64`
  - `windows/amd64`
- Each binary attached to the GitHub Release named `vX.Y.Z`.
- Checksums (`SHA256SUMS`) attached alongside.
- `mydeck-console --version` prints the embedded version + commit hash for feedback triage.

**Example tester onboarding (README one-liner):**

```
# Linux amd64
curl -L -o mydeck-console https://github.com/<owner>/mydeck-console/releases/latest/download/mydeck-console-linux-amd64
chmod +x mydeck-console
./mydeck-console --readeck-upstream http://localhost:8000 --brave-key $BRAVE_API_KEY
```

Tester opens `http://localhost:8080`, enters their Readeck API token in Settings, is working.

### B. Docker image (secondary path)

For testers running a docker-compose stack who'd rather add a service than drop a binary on the host.

A minimal image: `FROM scratch` (or `gcr.io/distroless/static`) + the binary + `ENTRYPOINT ["/mydeck-console"]`. No nginx, no template substitution, no entrypoint script.

**Publishing:**

- Pushed to GHCR (`ghcr.io/<owner>/mydeck-console`).
- Tags `:vX.Y.Z` on every git tag; `:latest` points at the newest tag.
- Multi-arch (`amd64`, `arm64`) via `docker/build-push-action` using the binaries already built by the release workflow.

**Example compose snippet:**

```yaml
services:
  mydeck-console:
    image: ghcr.io/<owner>/mydeck-console:latest
    command:
      - --readeck-upstream=http://readeck:8000
    environment:
      BRAVE_API_KEY: ${BRAVE_API_KEY:-}
    ports:
      - "8082:8080"
    depends_on:
      - readeck
```

---

## Release process

1. Bump `version` in `package.json` (propagated into the binary via `-ldflags -X main.version=...`).
2. Update `CHANGELOG.md` with tester-relevant changes.
3. Tag: `git tag vX.Y.Z && git push --tags`.
4. GitHub Actions workflow `.github/workflows/release.yml`:
   - Checks out at the tag.
   - `npm ci && npm run build` (produces `web/` / `dist/`).
   - Matrix-builds Go binaries across the supported platforms with the SPA embedded.
   - Creates a GitHub Release and attaches each platform binary plus `SHA256SUMS`.
   - Builds and pushes the Docker image (wrapping the linux binaries) to GHCR with tags `:vX.Y.Z` and `:latest`.
   - Auto-generates release notes from commit messages (or pulls from `CHANGELOG.md`).

Version scheme: `v0.x.y` while in tester phase. No stability promises implied.

---

## Repo additions required

- `cmd/mydeck-console/main.go` plus the `internal/…` tree per [go-migration.md](go-migration.md).
- `Dockerfile` — `FROM scratch` (or distroless), copies the prebuilt binary, `ENTRYPOINT ["/mydeck-console"]`. No runtime dependencies.
- `.github/workflows/release.yml` — build matrix + attach to release + push image.
- `CHANGELOG.md`.
- README updates:
  - "Quick start (binary)" section.
  - "Docker alternative" section.
  - "What config lives where" note: flags/env for the binary's config surface; Settings modal for the Readeck API token.

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
