


Here is the completely revised **Functional Design Specification and Implementation Plan**. It has been re-architected around the **Two-Phase Delivery Strategy**, embraces Readeck’s **Immutability Paradigm**, and incorporates the optimal **Authentication and Search** paths discussed.

---

# Functional Design Specification & Implementation Plan
**Project:** Bookmark Repair Tool (Readeck Companion)
**Architecture:** Two-Phase (Phase 1: Frontend PWA PoC $\rightarrow$ Phase 2: PWA + Go Backend)

---

## 1. Overview
A standalone companion app designed to help users identify, reconcile, and repair broken bookmarks stored in Readeck. Recovery is achieved via a dual-source strategy: historical snapshots (Internet Archive) and live web search (Brave Search / SearXNG). 

Because Readeck enforces bookmark immutability (URLs cannot be altered once saved), the system relies on a **Clone, Replace, and Deprecate** paradigm, ensuring data integrity and exact metadata transfer.

---

## 2. Implementation Strategy: The Two-Phase Approach

To validate the complex UX and candidate-scoring logic quickly, the project is split into two phases:

### Phase 1: Proof of Concept (Frontend-Only PWA)
* **Architecture:** 100% Client-side. The browser talks directly to Readeck, Archive.org, and Search APIs.
* **Scope:** Single-bookmark processing (one-at-a-time triage).
* **Extraction:** Relies purely on Readeck's native extraction engine by sending the resolved URL to `POST /bookmarks`.
* **Goal:** Prove the UX, validate the decision model, and refine candidate scoring.
* **Constraint Workaround:** Requires running the app on the same domain as Readeck, using a local dev proxy, or utilizing a CORS-disabling browser extension for testing.

### Phase 2: Production System (Go Backend + PWA)
* **Architecture:** Go backend proxies all requests, orchestrates batch jobs, and handles API rate limits.
* **Scope:** Concurrent batch processing, dry-runs, and pre-operation JSON backups (`GET /bookmarks/sync`).
* **Extraction:** Introduces configurable **Multipart HTML Injection** (mirroring the Readeck Browser Extension) to bypass Archive.org toolbars and ensure offline image preservation.
* **Goal:** Deliver a robust, power-user utility capable of safely repairing hundreds of bookmarks simultaneously.

---

## 3. Core Principles
1. **Immutability First:** Original bookmarks are never mutated. Recovered content is created as a brand-new bookmark.
2. **Metadata Fidelity:** The new bookmark perfectly inherits the original’s creation date (`created`), favorites status (`is_marked`), read progress, and labels.
3. **User-Controlled Actions:** No automatic deletion. All modifications require explicit user confirmation.
4. **Transparency:** Source (Archive vs. Search), timestamp, and confidence scores are prominently displayed.

---

## 4. Authentication

### Phase 1: Generated API Key (Personal Access Token)
* Frictionless setup mirroring the official browser extension.
* User inputs their **Readeck Server URL** and **API Token** into a local "Settings" modal.
* Credentials are encrypted/stored securely in the browser's `IndexedDB` or `localStorage`.

### Phase 2: OAuth 2.0 (Optional)
* For easier public distribution, implement the Readeck OAuth Authorization Code flow with PKCE (`bookmarks:read`, `bookmarks:write` scopes).

---

## 5. Providers & Data Sources

### 5.1 Archive Recovery
* **Provider:** Internet Archive CDX API.
* **Strategy:** Query for `statuscode:200` closest to the original bookmark's `created` timestamp.

### 5.2 Web Search Recovery (The Live Fallback)
Executed when archives fail or user requests alternatives.
* **Primary Search Provider:** **Brave Search API** (Free tier: 2,000 queries/month). Provides excellent REST JSON responses with high privacy standards.
* **Advanced / Self-Hosted Option:** **SearXNG**. Users can provide a URL to their own SearXNG instance to utilize a zero-cost, privacy-respecting metasearch proxy.

---

## 6. Core Workflow: The "Clone, Replace, Deprecate" Lifecycle

When a user clicks **"Apply"** to accept a recovered candidate, the app executes the following API sequence to honor Readeck's immutability:

1. **Read Original:** Fetch original metadata via `GET /bookmarks/{id}`.
2. **Create Replacement:** 
   * `POST /bookmarks`
   * Body includes: `url` (the Archive/Search link) and `created` (inherited exactly from the original bookmark).
   * *Note: Phase 1 relies on Readeck's native readability engine here.*
3. **Transfer Metadata:** 
   * `PATCH /bookmarks/{new_id}`
   * Apply original `read_progress`, `is_marked`, and `add_labels` (original labels).
4. **Tag the New Bookmark:** 
   * `PATCH /bookmarks/{new_id}` 
   * Add a system label (e.g., `recovered-archive.org` or `recovered-search`).
5. **Deprecate the Original:** 
   * Based on user preference:
     * *Option A (Safe):* `PATCH /bookmarks/{old_id}` to append `link-dead` label and set `is_archived: true`.
     * *Option B (Destructive):* `DELETE /bookmarks/{old_id}`.

---

## 7. User Interface Design (3-Pane Layout)

Designed for rapid triage, resembling an RSS reader.

### 7.1 Left Navigation Panel
* **Filters:** All Errors, Archive Matches, Search Matches, No Matches Found.
* **Status:** Needs Review, Ready to Apply (Phase 2), Completed.
* **Settings Gear:** Access to API Key, Server URL, and Search Provider config.

### 7.2 Center List Panel (Triage Queue)
* Displays broken bookmarks (`GET /bookmarks?has_errors=true`).
* **Indicators:** 
  * Archive match pill (Green/Yellow based on time delta).
  * Search match pill (with Confidence Score).

### 7.3 Right Detail Panel (Review & Action)
* **Tab A: Archive Candidates:** Snapshot URLs, capture dates, time diffs.
* **Tab B: Search Candidates:** Result URLs, titles, snippets, match explanation (e.g., "Exact Title Match").
* **Tab C: Preview:** Iframe preview of the selected candidate. Includes a "Preview Blocked? Open in New Tab" fallback button for sites with strict `X-Frame-Options`.
* **Action Footer:** "Accept Candidate" (triggers the Clone/Replace flow), "Reject," or "Manual Override URL."

---

## 8. Candidate Scoring & Aggregation

Each candidate (especially from Search) is assigned a **Confidence Score (0-100%)** and a **Match Reason**:
* **High Confidence (80-100%):** Exact title match + Same domain.
* **Medium Confidence (50-79%):** High title string similarity + Different domain (e.g., article moved to Medium/Substack).
* **Low Confidence (<50%):** Keyword match only (requires manual user verification).

---

## 9. Phase 2 Enhancements (Roadmap)

Once the Phase 1 PoC is validated, the introduction of the Go backend will unlock:

### 9.1 Advanced HTML Injection (Extraction Override)
Instead of passing an `archive.org` URL to `POST /bookmarks`, the Go backend will:
1. Fetch the raw HTML from the Internet Archive.
2. Strip the Wayback Machine JS toolbars and CSS wrappers.
3. Download the `<img>` assets concurrently.
4. Upload a clean, offline-ready `multipart/form-data` payload to Readeck (mirroring the official browser extension).

### 9.2 Safe Batch Operations
* **Pre-Operation Backup:** Automatically call `GET /bookmarks/sync?with_json=true` and save the user's library to disk before batch execution.
* **Concurrency:** Process 10-20 bookmarks simultaneously via Go worker pools.
* **Dry-Run Mode:** Show the user exactly how many bookmarks will be cloned, tagged, and archived before executing the API calls.

### 9.3 Advanced "Capture Selection"
If a live search result has terrible formatting that Readeck struggles to parse, the user can highlight text inside the Right Panel's preview iframe, click "Capture Selection," and the backend will inject *only that specific HTML fragment* into Readeck.

---

## 10. Summary of Next Steps for Development

1. **Setup Phase 1 Environment:** Initialize the PWA (React/Vue/Svelte).
2. **Build Settings Modal:** Establish connection to Readeck (`GET /profile`) using a manually provided API Key.
3. **Fetch Errors:** Implement `GET /bookmarks?has_errors=true`.
4. **Implement Resolvers:** Write the CDX API fetcher and the Brave Search / SearXNG API fetcher.
5. **Build the Clone/Replace Logic:** Implement the 5-step API sequence defined in Section 6.
6. **Test & Validate:** Run through manual triage testing to refine the UI and confidence scoring.