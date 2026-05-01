# MyDeck Console

[![License](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/NateEaton/mydeck-console)](https://github.com/NateEaton/mydeck-console/releases/latest)

A companion app for [Readeck](https://readeck.org/) that helps you triage and repair broken bookmarks — the ones that accumulate after a bulk import from Pocket or a few years of link rot.

For each broken bookmark, MyDeck Console offers:

- An **Internet Archive (Wayback Machine)** search for snapshots closest to when you saved the page.
- A **Brave Search** fallback when archives do not have what you need.
- A **manual URL** entry path for when you know exactly where the article lives now.
- A built-in **preview** so you can verify the candidate before committing.

When you apply a replacement, MyDeck Console follows Readeck's immutability model: it **clones** the original's metadata onto a new bookmark pointing at the replacement URL, then **deprecates** (archives or deletes) the original. Source-specific labels (`recovered-archive.org`, `replaced-manual`, etc.) make the lineage easy to audit after the fact.

**Requirements:** A running Readeck instance you control.

---

## Download

Pre-built binaries for Linux, macOS, and Windows are available on the [Releases](https://github.com/NateEaton/mydeck-console/releases) page.

| Platform | Binary |
|---|---|
| Linux x86-64 | `mydeck-console-linux-amd64` |
| Linux ARM64 | `mydeck-console-linux-arm64` |
| macOS x86-64 | `mydeck-console-darwin-amd64` |
| macOS Apple Silicon | `mydeck-console-darwin-arm64` |
| Windows x86-64 | `mydeck-console-windows-amd64.exe` |

### Quick start (Linux / macOS)

```sh
# Linux x86-64 example — adjust the filename for your platform
curl -L -o mydeck-console https://github.com/NateEaton/mydeck-console/releases/latest/download/mydeck-console-linux-amd64
chmod +x mydeck-console
./mydeck-console --readeck-upstream http://your-readeck-host:port
```

Open `http://localhost:8080` in your browser, complete OAuth sign-in, and start triaging.

### Configuration

| Flag | Env var | Required | Description |
|---|---|---|---|
| `--readeck-upstream` | `READECK_UPSTREAM` | Yes | Internal URL of your Readeck instance |
| `--brave-key` | `BRAVE_API_KEY` | No | Brave Search subscription token |
| `--listen` | `LISTEN` | No | Address:port to bind (default `:8080`) |

All flags can also be provided as environment variables. A `.env` file in the same directory as the binary is read automatically by the management scripts in [`scripts/`](scripts/).

`mydeck-console --version` prints the embedded version string.

---

## Key Features

- OAuth 2.0 Authorization Code Flow with PKCE — no API tokens to paste
- Triage queue of all bookmarks with extraction errors, ready to work through one by one
- Internet Archive + Brave Search candidates interleaved by confidence score in a single list
- Archive snapshots ranked by proximity to the original save date, pre-save preferred
- Manual URL entry for direct replacement when you know where the content lives
- Preview with open-in-new-tab before committing to a repair
- **Clone, Replace, Deprecate** repair flow — per-repair disposition control (archive or delete original)
- Source-specific audit labels for full lineage traceability
- Recovered / Replaced / Ignored history views
- Sort and filter across all list views
- Light / dark / system theme

---

## Setup

### 1. Sign in with Readeck OAuth (PKCE)

MyDeck Console uses OAuth 2.0 Authorization Code Flow with PKCE.

1. Open the app and go to **Sign in**.
2. Enter your Readeck server URL.
3. Complete authorization in Readeck and return to the app.

Access token metadata and scope are stored in browser `localStorage`. All API calls go through same-origin proxy routes served by the binary.

### 2. Optional — Brave Search API key

The Search fallback is powered by [Brave Search API](https://brave.com/search/api/). The free tier allows 2,000 queries/month — plenty for personal cleanup.

1. Sign up at [api.search.brave.com](https://api.search.brave.com/).
2. Create a subscription on the **Data for Search — Free** plan.
3. Copy the generated API key.
4. Pass it as `--brave-key` or set `BRAVE_API_KEY` in your environment (or `.env`).

The key is injected server-side by the `/brave/` proxy and never enters the SPA bundle. Without a key the Archive and Manual flows still work; the Search tab shows a configuration error.

### 3. Deployment options

**Go binary (primary):** single `mydeck-console` executable embedding the SPA. Handles `/api/`, `/cdx/`, and `/brave/` proxies directly — no other runtime dependencies. Optionally front with any TLS-terminating reverse proxy.

**SPA-only path:** if you already have a web server that can provide the three proxy routes, build the SPA with `make spa` and serve the `dist/` directory from it.

Both paths require the same logical routes:

- `/api/` → your Readeck instance.
- `/cdx/` → `https://web.archive.org/cdx/` (archive.org serves no CORS headers).
- `/brave/` → `https://api.search.brave.com/` with an injected `X-Subscription-Token` (Brave is CORS-blocked for browsers; keeping the key server-side also avoids exposing it in the browser).

The app has no server-side state of its own.

---

## Using it

1. Open the app and complete OAuth sign-in.
2. The triage queue loads all bookmarks with `has_errors=true` that are not already archived.
3. Select a bookmark. The app fetches archive.org snapshots and Brave results (if configured) in parallel.
4. Tap a candidate to open the Preview view. Use the top bar to **Apply** (✓), **Open ↗** in a new tab, or **Delete**.
5. For a specific URL, use the **⋮ overflow menu → Manual URL** from the Bookmark view.
6. **Apply** asks you to confirm the disposition (archive or delete the original). After apply, the bookmark disappears from the queue. The new bookmark inherits metadata and a `recovered-<source>` label; the original is archived or deleted with a `replaced-<source>` label.
7. To skip a bookmark without repairing it, use **⋮ → Ignore**. Ignored bookmarks are hidden from Triage and tracked in the **Ignored** view; you can un-ignore them at any time.

---

## Development (SPA)

```
npm install
npm run dev
```

Vite proxies `/api/`, `/cdx/`, and `/brave/` in dev — see [`vite.config.js`](vite.config.js). The Brave proxy reads `BRAVE_API_KEY` from `.env`.

```
npm run build
```

Outputs to `dist/`.

## Development (Go binary)

SPA development uses `npm run dev` (Vite, no binary needed). To test the binary locally:

```
make build
```

The binary lands at `./build/mydeck-console`. Run it via the management scripts:

```
./scripts/start-dev.sh    # listens on 127.0.0.1:8889
./scripts/stop-dev.sh
./scripts/status-dev.sh
```

Or run directly with explicit flags:

```
./build/mydeck-console \
  --readeck-upstream "http://your-readeck-host:port" \
  --listen "127.0.0.1:8889" \
  --brave-key "$BRAVE_API_KEY"
```

Optional flag: `--version`

## Production deployment (Go binary)

1. Download the binary for your platform from [releases](https://github.com/NateEaton/mydeck-console/releases), or build it:
   ```
   make build
   ```

2. Copy the binary to a stable location. In the same directory, create a `.env`:
   ```
   READECK_UPSTREAM=http://your-readeck-host:port
   BRAVE_API_KEY=your-key-here
   ```

3. Run directly, or copy the [`scripts/`](scripts/) bash helpers alongside the binary and use those:
   ```
   # Direct
   ./mydeck-console --readeck-upstream http://your-readeck-host:port --listen :8080

   # Via scripts (read config from .env in the same directory)
   ./start-prod.sh
   ./stop-prod.sh
   ./status-prod.sh
   ```

4. Optional — reverse proxy for TLS: point any TLS-terminating proxy at the binary's port. No special headers required.

5. Auto-start on boot: add the binary (or `start-prod.sh`) to your system's init mechanism (systemd, Task Scheduler, etc.).

---

## Building from Source

**Prerequisites:** Node.js 20+, Go 1.22+.

```sh
git clone https://github.com/NateEaton/mydeck-console.git
cd mydeck-console
make build
```

The binary lands at `./build/mydeck-console`. See [docs/WORKFLOW.md](docs/WORKFLOW.md) for the full development and release workflow.

---

## Contributing

Contributions are welcome. Please open an issue before starting significant work to align on approach. See [docs/WORKFLOW.md](docs/WORKFLOW.md) for the development and release workflow.

---

## Acknowledgements

### Built With

- [Svelte](https://svelte.dev/) — UI framework
- [Vite](https://vite.dev/) — Build tooling and dev server
- [Go](https://go.dev/) — Binary server, proxy layer, and embedded asset serving
- [Material Design Icons](https://pictogrammers.com/library/mdi/) — Icon library

### Development

This project was developed with assistance from AI tools including [Claude](https://claude.ai/) (Anthropic), [ChatGPT](https://chatgpt.com/) (OpenAI), and [AIStudio](https://aistudio.google.com/) (Google). The underlying concept, architecture decisions, implementation, and testing were performed by the developer.

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
