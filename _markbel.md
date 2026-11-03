# Markbel Architecture, Multi-Domain Analysis & System Engineering Plan

> **Living Technical Blueprint & Roadmap**  
> **Repository:** `d:\dev\projects\markbel`  
> **Status:** Production / v2.5.8  
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

## 4. Verification Seams & Quality Gates

Each milestone must pass the strict Markbel release pipeline:
- **Unit & Integration:** All 308+ Vitest tests pass (`npm test`).
- **Static Typing:** 0 TypeScript compilation errors (`npm run typecheck`).
- **Production Bundling:** Vite web build (`npm run build`) and MCP build (`npm run build:mcp`).
- **Extension Packaging:** `npm run build:extension:all` producing fresh `markbel-extension.zip` and `markbel-firefox-extension.zip`.
- **Unpacked Mirror:** `robocopy dist-extension D:\apps\0-setup\markbel-extension /E`.
- **Edge Deployment:** `npx wrangler deploy` to `https://mark.obel.workers.dev`.
- **Git Hygiene:** Conventional Commits and clean tracking ref synchronization.
