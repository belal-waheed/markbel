# Markbel Architecture, Multi-Domain Analysis & System Engineering Plan

> **Living Technical Blueprint & Roadmap**  
> **Repository:** `d:\dev\projects\markbel`  
> **Status:** Production / v2.5.18  
> **Targets:** Web PWA, Android APK (Capacitor), Chromium Extension, Edge Extension, Firefox Extension, Cloudflare Workers Edge, `@markbel/mcp` Server.  
> **Test Matrix & Network Resilience Source of Truth:** [tests/TEST_MATRIX.md](file:///d:/dev/projects/markbel/tests/TEST_MATRIX.md)

---

## 1. Executive Summary & Multi-Domain Ecosystem

Markbel is an offline-first, local-first bookmark manager and personal knowledge vault. It operates across 6 distinct distribution targets from a single unified TypeScript codebase:

```
                                  ┌─────────────────────────────┐
                                  │   Cloudflare Workers Edge   │
                                  │     (mark.obel.workers.dev) │
                                  │   Hono + D1 + R2 + Resend   │
                                  └──────────────▲──────────────┘
                                                 │
                      ┌──────────────────────────┼──────────────────────────┐
                      │ delta sync (/api/sync)   │ REST API (/api/agent/v1) │
                      ▼                          ▼                          ▼
       ┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
       │         Web PWA          │ │       Android APK        │ │      Local / Remote      │
       │  React 19 + Tailwind v4  │ │ Capacitor 8 + Android    │ │        MCP Server        │
       │  Dexie.js + Workbox SW   │ │ WebView + Native Share   │ │      (@markbel/mcp)      │
       └──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
                      ▲                          ▲
                      │                          │
       ┌──────────────┴───────────┐ ┌────────────┴─────────────┐
       │   Chromium Extension     │ │    Firefox Extension     │
       │  Chrome & Edge MV3       │ │ Gecko MV3 Background     │
       │  Popup + Background SW   │ │ Isolated Extension Dexie │
       └──────────────────────────┘ └──────────────────────────┘
```

### Domain Architecture Matrix

| Domain Target | Runtime Environment | Storage Engine | Network Transport | Offline Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Web PWA** | Modern Desktop/Mobile Browser | IndexedDB (`markbel-db` via Dexie) | Fetch + Service Worker (Workbox) | Full offline read/write, sync on reconnect |
| **Android APK** | Android WebView (`https://localhost`) | IndexedDB in WebView sandbox | Native HTTP / WebView Fetch | Offline read/write; native Android Share Intent |
| **Chromium Extension** | Chrome / Edge MV3 Extension | Isolated Extension IndexedDB | Extension Background SW Fetch | Isolated outbox syncs to Cloudflare D1 |
| **Firefox Extension** | Firefox MV3 (Gecko) | Isolated Extension IndexedDB | Background Script Fetch | Isolated outbox syncs to Cloudflare D1 |
| **Cloudflare Edge** | Cloudflare Workers (V8 Isolate) | Cloudflare D1 (SQLite) + KV | HTTPS Edge Gateway | Master source of truth, LWW conflict resolution |
| **Agent / MCP** | Node.js stdio / SSE | Stateless Agent Proxy | HTTP Bearer PAT | Headless CRUD, search, smart rules, batching |

---

## 2. In-Depth Root Cause Analysis: Caching & Offline Failures

### 2.1 The "Image Disappearing" & Flakiness Defect
Testing and user telemetry revealed that bookmark thumbnail images frequently disappear, flicker, or get replaced with broken placeholder icons (`ImageOff`). 

Our deep codebase investigation revealed **5 independent root causes** compounding this behavior:

#### Root Cause 1: Artificial Offline Image Blackout in `BookmarkImage.tsx`
* **File:** `src/components/BookmarkImage.tsx` (Lines 31-41 & 84-88)
* **Code:**
  ```tsx
  export function getInitialStage(src?: string | null, fallbackSrc?: string | null): ImageStage {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "PLACEHOLDER"; // BUG: Forces placeholder even if image is cached!
    }
    ...
  }
  ```
* **Failure Mechanism:** Whenever `navigator.onLine` is false or temporarily flickers (common on mobile, subway, Android APK, or Wi-Fi handshakes), `BookmarkImage` **actively suppresses image rendering** and forces the component into `PLACEHOLDER` stage (`ImageOff` icon). It completely bypasses the browser's HTTP disk cache, Service Worker CacheStorage, and memory cache.

#### Root Cause 2: Incomplete Workbox Service Worker Image Whitelist
* **File:** `vite.config.ts` (Lines 72-86)
* **Code:**
  ```ts
  urlPattern: /^https:\/\/(?:i\.ytimg\.com|www\.google\.com\/s2\/favicons|pbs\.twimg\.com|avatars\.githubusercontent\.com)\/.*$/,
  handler: 'CacheFirst',
  options: { cacheName: 'external-thumbnail-cache', ... }
  ```
* **Failure Mechanism:** The Service Worker only caches thumbnails from exactly 4 hardcoded domains (YouTube, Google Favicons, Twitter, GitHub). Any bookmark image from Substack, Medium, Reddit, Dev.to, Wikipedia, Unsplash, news publications, or user blogs is **never cached by the Service Worker**. When the user goes offline, these images fail to load.

#### Root Cause 3: Cloudflare Edge Image Proxy MIME Rejection (HTTP 415)
* **File:** `worker/src/index.ts` (Lines 1836-1843 & 1954-1956)
* **Code:**
  ```ts
  const ALLOWED_IMAGE_MIMES = new Set([
    "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/x-icon"
  ]);
  if (!ALLOWED_IMAGE_MIMES.has(rawContentType)) {
    return c.text("Unsupported image media type", 415);
  }
  ```
* **Failure Mechanism:**
  1. Vector logos / SVGs (`image/svg+xml`) are rejected with `415 Unsupported image media type`.
  2. Many S3/Cloudinary/CDN endpoints omit the `Content-Type` header or send generic `application/octet-stream` or `binary/octet-stream`. The worker proxy immediately rejects them with 415.
  3. When `BookmarkImage.tsx` receives a 415 from `/api/proxy/image`, it considers the proxy failed and switches to `FAVICON` or `PLACEHOLDER`.

#### Root Cause 4: Android APK Mixed Content & Referer Blocking
* **File:** `src/components/BookmarkImage.tsx` & `capacitor.config.ts`
* **Failure Mechanism:**
  1. On Android APK, the web context runs under `https://localhost`. Thumbnails with insecure `http://` URLs are blocked by default by Android WebView's `MIXED_CONTENT_NEVER_ALLOW` security policy.
  2. Many publishing platforms (Substack, Medium, Twitter, Notion) return `403 Forbidden` for hotlinked images if the `Referer` header is missing or unrecognized.

#### Root Cause 5: Ephemeral Instagram/Facebook Signed CDN URLs
* **File:** `src/lib/mediaHeuristics.ts` & `src/components/BookmarkImage.tsx`
* **Failure Mechanism:** Facebook/Instagram/Threads image URLs include query signatures with `oe=<hex_timestamp>`. These URLs expire within 24 to 48 hours. After expiration, the CDN returns 403. The client detects expiration and defaults to favicon, losing the visual preview.

---

### 2.2 Offline Caching & Synchronization Failures

#### Root Cause 1: Workbox `/api/*` NetworkOnly Trap
* **File:** `vite.config.ts` (Lines 96-99)
* **Code:**
  ```ts
  {
    urlPattern: /^\/api\/.*$/,
    handler: 'NetworkOnly',
  }
  ```
* **Failure Mechanism:** Any fetch to `/api/*` is intercepted by Workbox. While offline, `NetworkOnly` causes the Service Worker to throw an immediate network exception rather than allowing graceful degradation or mock fallback.

#### Root Cause 2: Extension Popup Web Locks Hang
* **File:** `src/db/adapters/WebEnvironment.ts` (Lines 68-79) & `src/sync/SyncManager.ts`
* **Code:**
  ```ts
  await navigator.locks.request(lockName, (lock) => { ... });
  ```
* **Failure Mechanism:** In Chromium/Edge/Firefox extensions, when the user clicks away from the extension popup, the popup's window DOM and JS runtime are instantly destroyed. If the popup was in the middle of holding the Web Lock `markbel-sync-leader`, the browser lock can become orphaned for tens of seconds. When the user reopens the popup, it defaults to `Follower` state, disabling immediate push until lock timeout.

#### Root Cause 3: Zero Local Storage of Thumbnail Blobs
* **File:** `src/db/db.ts` (`LocalBookmark`)
* **Failure Mechanism:** Markbel stores only the thumbnail URL string in Dexie. It does NOT store the binary image blob or data URL. In a true offline-first application, when an image is fetched, it should be cached in CacheStorage or IndexedDB so that the visual UI renders 100% identically offline without relying on ephemeral browser HTTP caches.

---

## 3. The Comprehensive Engineering Plan

### Phase 1: Robust Image Pipeline & Zero-Blackout Architecture
**Goal:** Eliminate all image disappearing bugs and ensure images render offline whenever previously viewed.

1. **Purge Offline Blackout in `BookmarkImage.tsx`:**
   - Remove `!navigator.onLine -> PLACEHOLDER`. Allow browser to attempt loading from cache even when offline.
   - Only transition to `PLACEHOLDER` if both direct load AND proxy load return a hard 404/410 and no favicon exists.
2. **Harden Cloudflare Image Proxy (`worker/src/index.ts`):**
   - Add `image/svg+xml`, `application/octet-stream`, `binary/octet-stream`, and sniff byte headers for PNG/JPEG magic numbers when `Content-Type` is generic.
   - Return permissive CORS (`Access-Control-Allow-Origin: *`) and long-lived cache headers (`Cache-Control: public, max-age=604800, s-maxage=2592000, immutable`).
3. **Universal Service Worker Image Caching (`vite.config.ts`):**
   - Replace the narrow 4-domain regex with a general image route handler:
     - Cache all `/api/proxy/image*` requests with `CacheFirst` (max 500 entries, 30 days).
     - Cache any cross-origin request where `request.destination === 'image'` using `StaleWhileRevalidate` with quota purging.
4. **Automatic HTTPS Upgrading:**
   - Automatically upgrade `http://` image URLs to `https://` during scraping (`mediaHeuristics.ts`) to prevent Android WebView mixed-content blocks.

---

### Phase 2: True Offline-First Image Persistence (Dexie Blob Cache / Cache API)
**Goal:** Guarantee instant image loading on Android APK and offline PWA.

1. **Thumbnail Blob Storage Service:**
   - When a bookmark is viewed or saved, download a downsampled thumbnail (max 400px width, WebP) directly into a dedicated Dexie table (`db.cachedThumbnails`) or native Cache API bucket.
   - Serve thumbnails via `URL.createObjectURL(blob)` when offline, completely decoupling visual rendering from remote network state.
2. **Android APK Mixed Content & WebView Optimization:**
   - In `android/app/src/main/java/.../MainActivity.java`, configure `WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE` and enable DOM storage / database quotas.

---

### Phase 3: Cross-Platform Extension & Multi-Vault Architecture
**Goal:** Full parity across Chromium, Edge, and Firefox extensions, with multi-vault collaboration.

1. **Extension Web Lock Resilience:**
   - In `WebEnvironment.ts`, add timeout guards to `acquireLeaderLock` so extensions never stay locked when popups close abruptly.
2. **Extension Multi-Vault Switcher:**
   - Add a vault selector dropdown in `extension/src/popup/` querying `/api/agent/v1/collaborators/shared-vaults`.
   - Pass `X-Vault-Owner` header during sync so extension users can save bookmarks directly into personal or shared team vaults.

---

### Phase 4: Agent Ecosystem & Knowledge Discovery [DELIVERED]
**Goal:** Frictionless AI agent adoption and enterprise-grade knowledge search.

1. **1-Click MCP Client Config Generator:**
   - Implemented "AI Agent & MCP Studio" card in `SettingsPage.tsx` with copyable configs for Claude Desktop, Cursor, Zed, Antigravity / Gemini CLI, and generic CLI, complete with active token detection and 1-click copy feedback.
2. **NPM Distribution Workflow:**
   - Verified `@markbel/mcp` configuration, shebang execution, and fallback to `MARKBEL_BASE_URL || MARKBEL_API_URL`.
3. **High-Performance Knowledge Search Ranking & Snippets:**
   - Upgraded `GET /bookmarks/search` with multi-token term splitting across `(title, url, description, site_name, article_content)`, 6-tier relevance scoring `ORDER BY CASE` prioritizing exact and prefix title matches, and contextual snippet generation.

---

### Modernization Phase 1: Security Hardening & Atomic Batching [DELIVERED]
**Goal:** Eliminate insecure JWT defaults, resolve N+1 transaction loops, and clean store permissions.

1. **JWT Fail-Fast Invariant:**
   - Enforced fail-fast HTTP 500 error on missing `JWT_SECRET` in `worker/src/middleware/auth.ts` and `worker/src/index.ts`, eliminating the insecure fallback string literal.
   - Removed sandbox cron bypass in `worker/src/index.ts`, strictly requiring `CRON_SECRET` or `JWT_SECRET`.
2. **N+1 Group Deletion Elimination:**
   - Refactored `handleDeleteGroup` in `src/views/BookmarksPage.tsx` to execute atomic batching via `bookmarkRepository.bulkUpdate(groupBookmarkIds, { group: "Unsorted" })`.
3. **Extension Production Manifest Hardening:**
   - Stripped development localhost host permissions (`localhost:3001`) from `extension/manifest.json` and `extension/manifest.firefox.json` for web store review readiness.
4. **Automated Security Verification:**
   - Added test suite `src/sync/AuthSecurity.test.ts` (5 tests) verifying JWT fail-fast, cron rejection, and bulkUpdate batching.

---

### Modernization Phase 2: View Virtualization & MCP Domain Normalization [DELIVERED]
**Goal:** Guarantee 60fps scrolling and eliminate DOM bloat for 1,000+ bookmarks, and eliminate schema drift in MCP client.

1. **Viewport Virtualization with `@tanstack/react-virtual`:**
   - Integrated `useVirtualizer` in `src/views/BookmarksPage.tsx` with responsive column calculation (2 on mobile, 3 on tablet, 4 on desktop).
   - Virtualized both List view and Grid view with dynamic measure refs and absolute transform positioning, ensuring only visible elements are mounted.
2. **MCP Domain Normalization:**
   - Normalized `BookmarkRecord` in `packages/mcp/src/client.ts` to canonical camelCase domain properties.
   - Implemented boundary adapter `normalizeBookmark` seamlessly transforming raw server/database snake_case and legacy inputs.

---

### Modernization Phase 3: Monolithic Component Deconstruction (`SettingsPage.tsx`) [DELIVERED]
**Goal:** Eliminate the 3,074-line God Component and establish a clean, modular settings feature architecture.

1. **Card Slicing & Component Extraction:**
   - Sliced `SettingsPage.tsx` down from 3,074 lines to 356 lines (88.4% reduction).
   - Created 8 modular cards in `src/components/settings/`:
     - `AccountProfileCard.tsx` (User profile, password change, account deletion danger zone).
     - `AppearanceCard.tsx` (Color scheme, theme tokens, high-contrast switch).
     - `NavigationPreferencesCard.tsx` (Mobile category scroller, pinned category matrix).
     - `SmartGroupsCard.tsx` (Sandbox heuristics tester, preset library, compound rule builder, JSON editor modal).
     - `ApiTokensCard.tsx` (Token creation modal, listing table, scoped permissions, token revocation).
     - `McpStudioCard.tsx` (1-click AI assistant tabs, token interpolation, copyable snippets, agent tool list).
     - `VaultCollaborationCard.tsx` (Shared vaults selector, collaborator invite modal, member role management).
     - `DataBackupCard.tsx` (JSON/HTML Netscape bookmark export, file import parser with auto-batching, thumbnail cache purge).
     - `LogoutModal.tsx` & `settingsConstants.tsx`.
2. **Settings Component Test Suite:**
   - Added `src/components/settings/SettingsComponents.test.tsx` (10 tests) covering client snippet interpolation, scope mapping, and operator configs.

---

### Modernization Phase 4: Cloudflare Worker Modularization & Backend Unification [DELIVERED]
**Goal:** Decompose the 3,067-line monolithic Worker entrypoint into modular Hono sub-routers and unify local dev on `wrangler dev`.

1. **Modular Sub-Router Architecture:**
   - Shrunk `worker/src/index.ts` from 3,067 lines down to 70 lines (97.7% reduction).
   - Extracted dedicated Hono sub-routers under `worker/src/routes/`:
     - `auth.ts` (Signup, Login, User profile, Password reset/change, API tokens).
     - `sync.ts` (Delta sync mutations push, sequence cursor pull, LWW conflict handling).
     - `media.ts` (Multi-platform metadata scraper, magic-byte MIME sniffing, SVG handling, image proxy).
     - `notifications.ts` (VAPID key delivery, device registration, notification test/dispatch cron).
     - `share.ts` (Web Share Target handlers).
     - `agent.ts` (Agent API v1 & MCP tools).
2. **Unified Local Dev Environment:**
   - Updated `package.json` `"dev:backend"` to `"wrangler dev worker/src/index.ts --port 8787"`.
   - Updated `vite.config.ts` `/api` proxy target to `http://localhost:8787`, standardizing local dev 1:1 with Cloudflare Workers Edge.

---

### Modernization Phases 16–18: Full-Text Search, Link Health Prober & Two-Way Browser Sync [DELIVERED - v2.5.15]
**Goal:** Deliver deep offline knowledge search, proactive 404 dead link detection with Wayback Machine fallbacks, and native two-way browser bookmarks synchronization.

1. **Phase 16: Offline Article Full-Text Search (D1 FTS5 & Dexie v8 Inverted Index):**
   - Cloudflare D1 SQLite virtual table `bookmarks_fts` using `fts5(id UNINDEXED, user_id UNINDEXED, title, description, site_name, article_content, tokenize = 'unicode61 remove_diacritics 2')`.
   - Automatic `AFTER INSERT`, `AFTER DELETE`, and `AFTER UPDATE` synchronization triggers on table `bookmarks`.
   - Upgraded `GET /api/agent/v1/bookmarks` and `/search` to support `search_mode=fulltext` using `MATCH` with BM25 relevance ranking and `snippet()` extraction.
   - Upgraded Dexie database schema to version 8 with dedicated table `articleTokens: 'token, bookmarkId, [token+bookmarkId]'`.
   - Added `searchCatalogFullText` with scope selection (`'all' | 'titles' | 'articles'`) and contextual highlight snippet extraction.
   - Integrated scope selector chips and contextual snippets into `CommandPalette.tsx`.

2. **Phase 17: Background Link Health & 404 Rot Detector:**
   - Extended D1 schema with columns `is_broken`, `http_status`, and `last_checked_at` and index `idx_bookmarks_link_health`.
   - Added Cloudflare Workers scheduled cron trigger (`0 * * * *`) executing non-blocking HEAD and range GET probes on uninspected links with 5s timeouts.
   - Automatic delta emission into `sync_changes` so client devices receive health status updates during regular sync.
   - Added endpoint `POST /api/agent/v1/bookmarks/:id/check-health` for on-demand single bookmark verification.
   - Added "Broken Links" filter in `GroupSidebar.tsx` and `BookmarksPage.tsx` with live uninspected count badges.
   - Enhanced `BookmarkCard.tsx` with warning badges, 1-click Wayback Machine (`https://web.archive.org/web/*/${url}`) and offline Reader Mode recovery actions.

3. **Phase 18: Two-Way Native Browser Bookmarks Sync:**
   - Added `"bookmarks"` permission to Chrome (`manifest.json`) and Firefox (`manifest.firefox.json`) manifests.
   - Engineered `BrowserBookmarkSyncEngine` in `extension/src/bookmarkSync.ts` managing bi-directional synchronization between the browser's "Markbel Vault" folder and the Markbel outbox engine.
   - Enforced loop prevention invariants (`isSyncing = true` and `inFlightNodeIds`) to eliminate mutation echoing.
   - Added options UI controls for two-way sync toggle and one-click "Import All Browser Bookmarks" with duplicate detection.

---

## 4. Verification Seams & Quality Gates

Each milestone must pass the strict Markbel release pipeline:
- **Unit & Integration:** All 532 Vitest tests pass (`npm test`).
- **Static Typing:** 0 TypeScript compilation errors (`npm run typecheck`).
- **Production Bundling:** Vite web build (`npm run build`) and MCP build (`npm run build:mcp`).
- **Extension Packaging:** `npm run build:extension:all` producing fresh `markbel-extension.zip` and `markbel-firefox-extension.zip`.
- **Unpacked Mirror:** Mirrored to `D:\dev\tools\markbel-extension\` and `D:\apps\0-setup\markbel-extension\`.
- **Edge Deployment:** `npx wrangler deploy` to `https://mark.obel.workers.dev`.
- **Git Hygiene:** Conventional Commits and clean tracking ref synchronization.

### Extension CSP Compliance Hotfix (v2.5.15):
- **Inline Event Handler Elimination:** Removed inline `onerror="..."` handlers from `popupSearchView.ts` and `MarkbelSpotlight.ts` template literals to comply with Manifest V3 Content Security Policy (`script-src 'self'`).
- **Standard DOM Event Binding:** Replaced with post-render `querySelectorAll('img').forEach(img => img.addEventListener('error', ...))` event listeners.
- **Packaging & Unpacked Mirror:** Cleaned and mirrored fresh bundles to `D:\dev\tools\markbel-extension\` and `D:\apps\0-setup\markbel-extension\`; refreshed GitHub release assets on `v2.5.15`.

### Architectural Hardening & Release Protocols (v2.5.16):
- **Client-Side Dexie Schema Upgrade (Version 9):** Defined compound primary key `[token+bookmarkId]` for `articleTokens` table with automatic migration hook indexing all existing readable article bodies; updated token extraction and indexing logic.
- **Cloudflare D1 SQLite Schema & Ingestion Guard:** Fixed trigger `bookmarks_au AFTER UPDATE ON bookmarks` to only insert active records (`WHERE new.deleted_at IS NULL`) into `bookmarks_fts`; fortified `/api/sync` push mutation handling with SQLite `ON CONFLICT(id) DO UPDATE SET` upserts for bookmarks and groups to prevent `SQLITE_CONSTRAINT` duplicate key violations.
- **Edge Background Link Health Prober Hardening:** Fortified `probeUrlHealth` with canonical `isSafePublicUrl` SSRF protection, immediately rejecting loopbacks, private CIDRs, and metadata IPs without fetching; scheduled prober now conditionally updates version and emits sync deltas only when health status actually flips.
- **Extension MV3 Service Worker & Native Bookmarks Sync:** Fixed `chrome.runtime.onMessage` to return `true` strictly for asynchronous messages; ensured `sync-alarm` initialization at top-level service worker scope; implemented persistent `browserNodeIdToUrlMap` in `chrome.storage.local` to enable deletion synchronization from native browser bookmark removes.
- **PWA Quota & Mobile Dark Mode Theme:** Removed duplicate manifest link in `index.html`; added `navigator.storage.persist()` storage quota protection; dynamically synchronized native Capacitor `StatusBar` color and style to active dark/light mode state changes.
- **Verification Gate:** 536/536 tests passing (`npm test`), 0 TypeScript errors (`npm run typecheck`), production assets deployed to `https://mark.obel.workers.dev`.

### Cross-Client Media Resilience & Self-Healing Protocol (v2.5.17):
- **Card Presentation Thumbnail Fallback:** Integrated `extractInstantMediaMetadata` in `src/components/BookmarkCard.tsx` (both List and Grid views) to compute `effectiveImage` fallback for zero-network deterministic platform thumbnails (YouTube, GitHub, etc.) when `b.image` is empty.
- **Repository Media Mutation Enrichment:** Integrated heuristic enrichment in `BookmarkRepository.create` in `src/db/SyncRepository.ts` to enrich media metadata (`image`, `title`, `siteName`, `contentType`, `description`) before database and outbox persistence.
- **Extension Native Browser Sync Enrichment:** Integrated instant media metadata extraction into `BrowserBookmarkSyncEngine` (`handleNativeCreated` and `importAllBrowserBookmarks`) in `extension/src/bookmarkSync.ts`.
- **Database Self-Healing Sweep:** Added `repairMissingMediaThumbnails` in `src/db/db.ts` and scheduled automatic execution in an idle callback on launch in `src/main.tsx` to self-heal existing local IndexedDB records.
- **Verification Gate:** 544/544 tests passing across 42 suites (`npm test`), 0 TypeScript errors (`npm run typecheck`), edge worker and web assets deployed to `https://mark.obel.workers.dev`.

