# Markbel Test Matrix & Network Resilience Source of Truth

> **Authoritative Specification & Verification Reference**  
> **Status:** Production / v2.5.8  
> **Scope:** Multi-domain client targets, Cloudflare Edge Worker, and MCP server under degraded network topologies.

---

## 1. Executive Summary

Markbel operates as a local-first, offline-first personal knowledge vault across 6 distinct distribution targets. Client state is maintained in IndexedDB (Dexie.js), synced asynchronously with the Cloudflare Workers edge gateway (Hono + D1), and queried headlessly via the `@markbel/mcp` Model Context Protocol server.

Because network conditions on mobile devices (subways, cell tower handoffs), browser extensions (background worker termination), and slow connections (2G, slow 3G) are inherently hostile, the client sync engine and asset renderers must maintain strict failure invariants:
- **Zero Data Loss:** Local mutations must never be silently discarded or permanently orphaned in an un-synced state.
- **Fail-Fast & Rollback:** In-flight network pushes interrupted by timeouts, abort signals, or transport errors must revert in-flight outbox items from `processing` to `failed` so they are immediately eligible for subsequent retry cycles.
- **Stale Processing Self-Healing:** On startup or sync initialization, any changes trapped in `processing` (e.g. following browser crashes or hard process termination) must be automatically recovered to `pending`.
- **Bounded Resource Utilization:** Outbox draining loops must be batched (100 items per request) and bounded (max 10 iterations / 1,000 items per sync run).
- **Graceful Asset Degradation:** Asset thumbnail capture must enforce hard timeout boundaries (6,000 ms), cleanly release in-flight locks, reject 0-byte corrupt blobs, and cascade through a deterministic 4-stage fallback state machine (`DIRECT` -> `PROXY` -> `FAVICON` -> `PLACEHOLDER`).

---

## 2. Execution Domain Matrix

| Domain Target | Execution Runtime | Persistence Engine | Network Transport | Network Resilience Seams |
| :--- | :--- | :--- | :--- | :--- |
| **Web PWA** | Modern Desktop / Mobile Browser | IndexedDB (`markbel-db` via Dexie) | Window `fetch`, Workbox ServiceWorker | Web Lock leader election, BroadcastChannel follower dispatch, HTTP 304 conditional pull, Dexie blob caching |
| **Android APK** | Android WebView (`https://localhost`) | Isolated Android WebView IndexedDB | Native HTTP / Chromium WebView `fetch` | Mixed-content upgrade (`http://` -> `https://`), offline airplane mode queuing, background wake sync |
| **Chromium Extension** | Chrome / Edge MV3 (Chromium 114+) | Isolated Extension IndexedDB | Extension Background Service Worker | MV3 service worker ephemeral lifecycle survival, outbox recovery across worker terminations |
| **Firefox Extension** | Gecko MV3 (Firefox 115+ ESR) | Isolated Extension IndexedDB | Firefox Background Script `fetch` | Gecko cross-origin fetch permissions, background script reconnection recovery |
| **Cloudflare Edge** | Cloudflare Workers (V8 Isolate) | Cloudflare D1 (SQLite) + KV | HTTPS Edge Gateway (`/api/sync`) | Idempotent mutation processing (`applied` / `duplicate` / `conflict`), cursor pagination, rate limiting |
| **Agent / MCP** | Node.js stdio / SSE (`@markbel/mcp`) | Stateless Agent Proxy | HTTP Bearer Token to Edge Gateway | Headless batch mutations, deterministic error codes on network drop |

---

## 3. Network Quality Profiles & Emulation Standard

All network resilience tests validate the system against 5 canonical network conditions:

| Profile | Downlink / Uplink | RTT (Latency) | Packet Loss Rate | Simulated Failure Mode |
| :--- | :--- | :--- | :--- | :--- |
| **Profile 1: Fast Fiber / WiFi** | 100 Mbps / 50 Mbps | 10 ms - 30 ms | 0% | Baseline fast path; instantaneous batch execution |
| **Profile 2: Slow 3G** | 400 Kbps / 100 Kbps | 1,000 ms - 2,000 ms | 1% - 3% | High latency handshake; long-running HTTP payloads; cross-tab lock contention |
| **Profile 3: 2G / Flaky Packet Loss**| 100 Kbps / 50 Kbps | 2,000 ms - 5,000 ms | 15% - 30% | Mid-stream transport drops; socket disconnections; gateway timeouts (HTTP 504) |
| **Profile 4: Offline / Airplane Mode**| 0 Kbps / 0 Kbps | Infinite | 100% | Complete network absence; immediate offline state transition; zero HTTP dispatch |
| **Profile 5: Flapping / Flaky Handshake**| Intermittent (5s up / 5s down) | Variable (200ms - 2,000ms)| Burst drops | Repeated reconnection events; concurrent pull/push requests; abort signal interruptions |

---

## 4. Resilience Invariants & Failure Mode Specifications

### 4.1 Trapped Outbox State Machine & In-Flight Abort Rollback
- **Problem:** When `SyncManager.sync()` initiates a push, items in `pushBatch` are transitioned from `status: 'pending'` to `status: 'processing'`. If the request is aborted (via `AbortController`, page unload, or timeout) or fails with a transport error, items left in `processing` are invisible to standard `getPendingChanges()` queries (which filter only for `pending` or `failed`).
- **Invariant:** If the in-flight push HTTP request throws, aborts, or drops, all items in `inFlightPushBatch` MUST be updated immediately in IndexedDB to `status: 'failed'` with `lastError: err.message || 'Push aborted or failed'`.
- **Self-Healing:** Before every sync run and during leader initialization, `recoverStaleProcessingChanges()` executes, querying all items with `status: 'processing'` and resetting them to `status: 'pending'`.

### 4.2 Push Queue Draining Loop
- **Problem:** Pushing only a single batch of 100 items leaves remaining queued mutations waiting until subsequent scheduled sync cycles (30 seconds to 5 minutes).
- **Invariant:** `SyncManager.sync()` executes a draining loop while `pushBatch.length === 100`, bounded by `maxPushIterations = 10` (max 1,000 items per sync run) to guarantee complete outbox flushing under slow networks while preventing infinite execution loops.

### 4.3 Idempotent Cursor Pull & Connection Drops
- **Problem:** If a pull request successfully retrieves remote changes and applies them locally, but the connection drops before `saveCursor(pullData.nextCursor)` is committed, the next sync cycle replays changes from the previous cursor.
- **Invariant:** `applyRemoteChanges()` in `SyncRepository` and `WebSyncStorage` executes idempotent upserts (`db.bookmarks.put`). Replaying already applied changes must not create duplicate entities or corrupt version numbers.

### 4.4 Web Lock Contention & Follower Tab IPC
- **Problem:** In multi-tab browser sessions, only the elected leader holds the `markbel-sync-leader` Web Lock. Under Slow 3G where a sync cycle takes several seconds, follower tabs requesting sync must not deadlock or freeze.
- **Invariant:** Follower tabs emit a `SYNC_REQUESTED` event over `BroadcastChannel('markbel-sync-channel')`. The leader tab receives the message, executes or queues the sync request, and notifies followers upon completion via `SYNC_COMPLETED`.

### 4.5 Thumbnail Fetch Timeout & Resource Management
- **Problem:** Unresponsive remote image hosts cause hanging HTTP requests, tying up memory and permanently blocking `inFlightCaptures` entries.
- **Invariant:** `captureAndCacheThumbnail` applies a strict `6,000 ms` timeout via `createTimeoutSignal(6000)` on both direct CORS and edge proxy fetches. The `finally` block guarantees `inFlightCaptures.delete(url)` execution. 0-byte or corrupted blobs are rejected without persisting to Dexie.

---

## 5. Test Suites Directory & Coverage Mapping

| Test File | Test Suite Name | Target System | Coverage Scope |
| :--- | :--- | :--- | :--- |
| `src/sync/NetworkDegradation.test.ts` | Network Degradation & Resilience Suite | `SyncManager` | High RTT latency (500-2000ms), push abort rollback, outbox draining (>150 items), HTTP 504 / 429 backoff, pull idempotency, concurrent mutations during push |
| `src/components/BookmarkImageSlowNetwork.test.tsx` | BookmarkImage Slow-Network Suite | `BookmarkImage` | Stalled remote host (6s timeout), rapid mount/unmount memory cleanup, 0-byte corrupt blob rejection, concurrent deduplicated thumbnail requests |
| `src/sync/WebLockResilience.test.ts` | Web Lock Resilience Suite | `SyncManager` | Web Lock contention during slow sync, follower tab `BroadcastChannel` queuing, lock acquisition timeout prevention |
| `src/sync/CachedThumbnail.test.ts` | Dexie Thumbnail Blob Cache Suite | `CachedThumbnail` | Blob storage, cache hit/miss, LRU eviction, quota management |
| `src/components/BookmarkImage.test.tsx` | BookmarkImage FSM Suite | `BookmarkImage` | 4-stage fallback state machine (`DIRECT` -> `PROXY` -> `FAVICON` -> `PLACEHOLDER`), social CDN expiration |
| `src/sync/Sync304Conditional.test.ts` | Conditional HTTP 304 Suite | `SyncManager` | `If-None-Match: W/"cursor-<cursor>"` headers, 304 Not Modified zero-payload skips |
| `src/sync/SyncBatchValidation.test.ts` | Outbox Compaction & Batching | `SyncManager` | Outbox compaction (create/update/delete collapsing), 7-day poison pill pruning |
| `src/sync/SyncLWW.test.ts` | Conflict Resolution Suite | `SyncRepository` | Last-Write-Wins (LWW) conflict handling, server precedence on version mismatch |

---

## 6. Execution & Verification Commands

All resilience tests are fully integrated into the Vitest test runner:

```powershell
# Run the complete test suite (all domains & resilience tests)
npm test

# Run only the network degradation and slow-network suites
npx vitest run src/sync/NetworkDegradation.test.ts src/components/BookmarkImageSlowNetwork.test.tsx src/sync/WebLockResilience.test.ts

# Run type check validation
npm run typecheck
```
