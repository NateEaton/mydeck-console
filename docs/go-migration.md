# Go Single-Binary Migration

**Status:** Planned — executes **after** the Phase 1.5 UX refactor ([refactor-ui-ux.md](refactor-ui-ux.md)) and **before** the first tester release. The earlier plan put this ahead of the UX work; the pivot was to avoid putting the smoketest shell in front of testers at all. The binary still precedes the tester release because single-file onboarding is a material simplification.
**Motivation:** Replace the SPA-plus-nginx deployment with a single `mydeck-console` binary that embeds the built frontend and serves it alongside the three upstream proxies. Testers would get one file to download, run, and forget.

This is **not** the original Phase 2 vision (Go backend + batch orchestration). That has been dropped. See [spec.md §11](spec.md#11-phase-2-enhancements-roadmap) — it needs revising; batch auto-apply turned out to be unrealistic once you accept that review is inherent to the repair task.

---

## Scope

### What moves to Go

- **Reverse proxy layer** currently provided by nginx:
  - `/api/` → the tester's Readeck instance.
  - `/cdx/` → `web.archive.org`.
  - `/brave/` → `api.search.brave.com` with `X-Subscription-Token` injected server-side.
- **Static file serving** for the SPA, with SPA fallback (`try_files` equivalent → serve `index.html` on 404 for non-asset paths).
- **Config loading.** CLI flags and/or env vars replace `.env` + `render-nginx.sh`.

### What stays exactly as it is

- The entire Svelte app — UI, workflow, scoring, IndexedDB cache, Settings modal.
- `ReadeckClient`, `ArchiveClient`, `BraveClient` — they already call relative paths (`/api/…`, `/cdx/…`, `/brave/…`), so they are agnostic to what's on the other end of those routes.
- The label taxonomy, Clone/Replace/Deprecate sequence, candidate ranking — all pure frontend logic.

### What gets retired

- `nginx/*.conf.template`, `render-nginx.sh`, the nginx container.
- `.env`'s deploy-path variables (deploy becomes `scp` or release download, not a directory copy).

---

## Architecture sketch

```
cmd/mydeck-console/
    main.go              # flag parsing, server startup

internal/
    server/
        server.go        # http.Server setup, graceful shutdown
        routes.go        # route table: /api, /cdx, /brave, static
        static.go        # go:embed dist/, SPA-fallback handler
    proxy/
        readeck.go       # httputil.ReverseProxy for /api
        archive.go       # httputil.ReverseProxy for /cdx, bumped timeout
        brave.go         # httputil.ReverseProxy for /brave, injects X-Subscription-Token
    config/
        config.go        # CLI flags + env fallback

web/                     # build output symlink or copy target; go:embed reads from here
```

- One binary. `go build -o mydeck-console ./cmd/mydeck-console`.
- `go:embed` the Svelte `dist/` so the built SPA ships inside the executable.
- Standard library only where possible (`net/http`, `net/http/httputil`, `flag`, `embed`). Reach for a third-party dep only if it meaningfully reduces code.

### CLI surface (first pass)

```
mydeck-console \
  --listen :8080 \
  --readeck-upstream http://readeck:8000 \
  --brave-key "$BRAVE_API_KEY"
```

All three flags also readable from env (`LISTEN`, `READECK_UPSTREAM`, `BRAVE_API_KEY`). Env provides the defaults; flags override. Fail fast with a clear message if `--readeck-upstream` is missing.

---

## Implementation steps (1–2 days of focused work)

1. Scaffold `cmd/mydeck-console` and `internal/…` packages.
2. Wire `go:embed` against a known path (e.g. `//go:embed all:web`). Add a Make or task script that `npm run build`s the SPA into `web/` before `go build`.
3. Implement the static handler with SPA fallback: serve the requested asset if it exists in the embedded FS, otherwise serve `index.html` with status 200. Explicitly exclude `/api/`, `/cdx/`, `/brave/` from fallback.
4. Implement the three `httputil.ReverseProxy` handlers. For `/brave/`, set `X-Subscription-Token` in a `Director` wrapper.
5. Config loading, including `--help` output and a friendly error when `--readeck-upstream` is absent.
6. Graceful shutdown on SIGINT/SIGTERM.
7. `go test` covering: SPA fallback logic, header injection on `/brave/`, missing-upstream failure.
8. Cross-compile smoke test: `GOOS=linux GOARCH=amd64`, `GOOS=linux GOARCH=arm64`, `GOOS=darwin`, `GOOS=windows`.
9. GitHub Actions workflow that runs `npm ci && npm run build && go build` and attaches platform binaries to each tag's release.

---

## Gotchas to plan for

- **SPA `base` path.** Today the dev build uses `BASE_PATH=/mydeck-console-dev`. The Go binary should serve at root (`/`) by default; deprecate the sub-path build mode, or expose a `--base-path` flag and pass the value into Vite at build time via env.
- **`go:embed` + Vite asset hashing.** Vite produces fingerprinted `assets/index-<hash>.js`. `go:embed all:web` captures whatever is on disk at build time — just make sure the embed happens after `npm run build`, not before. A Makefile target enforces the order.
- **Proxy `Host` header and TLS.** The current nginx configs override Host and set `proxy_ssl_server_name on`. Go's `ReverseProxy` needs `Director` to rewrite `r.Host = target.Host` and the default transport handles TLS SNI correctly — just verify against archive.org, which has bitten us before.
- **Timeout parity.** Match the 120s `proxy_read_timeout` we use for `/cdx/`. Default Go HTTP timeouts are shorter.
- **No service worker yet.** If a PWA/SW ever lands, the SPA fallback handler needs a carve-out for `/sw.js` and friends with no-cache headers.
- **CSP.** Today's `connect-src 'self'` survives unchanged; all upstreams are same-origin through the binary.
- **Settings modal values** (Readeck URL, API token) stay in `localStorage`. The binary doesn't own or proxy user credentials beyond the Brave key — which lives in its own flag.

---

## What this does **not** change

- The repair workflow. Identical.
- The label taxonomy. Identical.
- Auth model. Still a user-pasted Readeck API token stored in the browser. OAuth-with-PKCE is a separate decision and can land later if needed.
- The IA-extraction sidecar question. If the Wayback-rendered-bookmark experience turns out to be unacceptable during testing, the extraction pipeline (fetch snapshot → strip toolbar → inline images → multipart POST to Readeck) becomes a natural second responsibility for this same binary. Adds maybe 300–500 lines of Go, no second process.

---

## Sequencing

1. **Phase 1.5 UX refactor in Svelte** — design intent in [refactor-ui-ux.md](refactor-ui-ux.md). The smoketest shell is replaced before any tester sees it.
2. **Execute this migration.** Port the three proxies and static serving into a Go binary; retire `nginx/*.conf.template` and `render-nginx.sh`. Embeds the refactored SPA.
3. **First tester release** off the binary (see [distribution.md](distribution.md), which pivots to binary-as-primary when this lands).
4. **Advanced HTML injection** only if tester feedback on the Wayback-rendered bookmark warrants it. It lives in this same binary.

Ordering history: originally Go → testers → UX, then reversed to UX → Go → testers so testers aren't asked to evaluate an intentionally throwaway shell.
