# Development & Release Workflow

## 1. Repository Structure & Hygiene

### Branching Strategy
We use a **Main-First** (Trunk-based) workflow.
*   **`main`**: The primary source of truth. Always buildable and represents the last stable set of features.
*   **`feature/*`**: For new functionality.
*   **`enhancement/*`**: For improvements to existing features.
*   **`fix/*`**: For bug fixes.
*   **`chore/*`**: For maintenance, dependency updates, and release preparation.

### Commit Strategy
*   **In Branches:** Commit often. Messy history is fine.
*   **To Main:** Always use **Squash and Merge**. Keeps `main` history clean and linear.
*   **Conventional Commits:** Use `feat:`, `fix:`, `chore:`, etc., when merging to `main`.

---

## 2. Versioning

`package.json` `version` is the single source of truth. It is injected into the
Go binary at build time via ldflags:

```
go build -ldflags "-X main.version=v$(VERSION)" ./cmd/mydeck-console
```

`make build` and `make build-all` read it automatically via `$(shell node -p ...)`.
`mydeck-console --version` prints the embedded string.

No separate build number or code is needed — `vX.Y.Z` is sufficient for a
personal-tester distribution.

---

## 3. CI/CD & Automation

GitHub Actions handles checks, continuous builds, and release packaging.

### Automated Checks (`checks.yml`)
Runs on pushes to `main`, `feature/**`, `enhancement/**`, `fix/**`, `chore/**`,
and on Pull Requests targeting `main`.

*   `npm ci` — reproducible dependency install
*   `npm run build` — SPA compile check (Vite)
*   `go build ./cmd/mydeck-console` — Go compile check
*   `go vet ./...` — static analysis
*   `go test ./...` — unit tests

**Goal:** catch regressions before merge without waiting for full release packaging.

### Continuous Build (`continuous.yml`)
Runs on every push to `main` (post-merge).

1.  Runs `make build-all` — full SPA build + all five platform binaries.
2.  Updates the rolling **"Latest Build"** pre-release on GitHub with the fresh
    binaries and a new `SHA256SUMS`.

Testers who want the bleeding edge download from "Latest Build." It is always a
pre-release and never tagged `vX.Y.Z`.

Can also be triggered manually from the Actions tab on any branch.

### Official Releases (`release.yml`)
Runs when a tag starting with `v` is pushed (e.g., `v0.1.0`).

*   Builds SPA + all five platform binaries with the tag embedded as the version.
*   Attaches to a GitHub Release:
    *   `mydeck-console-linux-amd64`
    *   `mydeck-console-linux-arm64`
    *   `mydeck-console-darwin-amd64`
    *   `mydeck-console-darwin-arm64`
    *   `mydeck-console-windows-amd64.exe`
    *   `SHA256SUMS`
*   Optionally builds and pushes a Docker image to GHCR
    (`ghcr.io/<owner>/mydeck-console:vX.Y.Z` and `:latest`).

---

## 4. The Release Process (vX.Y.Z)

### Step 1: Prep the Release
1.  Create `chore/prepare-vX.Y.Z` from `main`.
2.  Bump `version` in `package.json` to `X.Y.Z`.
3.  Update `CHANGELOG.md` with tester-relevant changes.
4.  Commit: `chore(release): bump version to X.Y.Z`.
5.  Open PR → Merge to `main`.

### Step 2: Tag and Publish
1.  💻 `git checkout main && git pull`
2.  💻 `git tag vX.Y.Z`
3.  💻 `git push origin vX.Y.Z`
4.  ☁️ GitHub Actions builds the binaries and creates the release automatically.
5.  ☁️ Review the draft release on GitHub, confirm the assets, and publish.

Version scheme: `v0.x.y` during tester phase. No stability promises implied.

---

## 5. Local Verification

Before pushing, run:

```
npm run build          # SPA compile check
go build ./cmd/mydeck-console   # Go compile check
go vet ./...           # static analysis
go test ./...          # unit tests
```

Or use `make build` to run the full SPA + Go build in one step.

> **Synology note:** `/tmp` is mounted `noexec`. Prefix `go test` with
> `GOTMPDIR=~/go-tmp` (create once with `mkdir -p ~/go-tmp`).

---

## 6. Deployment (Local / Synology)

See `docs/nginx-synology.md` (gitignored, local copy only) for the
Synology-specific nginx container setup and `deploy.sh` usage.

For the Go binary:

*   **Dev:** `make build` → `./scripts/start-dev.sh` (binds `127.0.0.1:8889`)
*   **Prod:** `make build` → copy binary + scripts to install dir → `./start-prod.sh` (binds `127.0.0.1:8890`)

The management scripts (`scripts/`) read config from a `.env` in the same
directory as the binary.
