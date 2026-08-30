# Obel System Architecture: Offline-First Sync Layer & Workflow

This document details the synchronization mechanics, caching strategies, and notification layers of the Obel productivity suite.

---

## 1. Core Synchronization Architecture

Obel uses an offline-first data synchronization strategy. The local database is the single source of truth for the user interface, while the remote database acts as a durable backing store.

```
+-------------------------------------------------+
|                  User Interface                 |
+-------------------------------------------------+
                        |  (Reactive Read / Write)
                        v
+-------------------------------------------------+
|                  Zustand Stores                 |
+-------------------------------------------------+
       |                                   |
       | (Instant Write)                   | (Enqueue if offline)
       v                                   v
+---------------+                   +-----------------+
|   Dexie.js    |                   |   Sync Outbox   |
| (IndexedDB)   |                   |  (db.syncQueue) |
+---------------+                   +-----------------+
                                           |
                                           | (Sequenced Replay)
                                           v
                                    +-----------------+
                                    |   Next.js API   |
                                    +-----------------+
                                           |
                                           v
                                    +-----------------+
                                    |     MongoDB     |
                                    +-----------------+
```

### Components

1. **Local Single Source of Truth (IndexedDB / Dexie.js)**:
   - Data for notes, tasks, and habits is saved locally in IndexedDB immediately upon modification.
   - Initial application views load from IndexedDB instead of making network calls, preventing layout shift and loading indicators.

2. **State Layer (Zustand)**:
   - Manages memory states for active views.
   - Core data arrays (notes, tasks, habits) are excluded from Zustand local storage serialization (`partialize`) to prevent performance degradation, relying instead on native IndexedDB.

3. **Mutation Outbox Queue (`db.syncQueue`)**:
   - Stores modifying operations (POST, PUT, DELETE) sequentially when the application is offline or if a server request fails.
   - Operations contain the target endpoint path, HTTP method, payload, and timestamp.

4. **Background Sync Engine (`src/lib/syncEngine.ts`)**:
   - Listens to network connectivity events (`online`).
   - Replays outbox items in chronological order.
   - Discards invalid client states (HTTP 400, 404, 409) to prevent queue blockage, and halts replay during server or connection failures.

5. **Incremental Pull Sync (`/api/sync`)**:
   - Following outbox replay, the sync engine queries `/api/sync?since=TIMESTAMP`.
   - The server returns only the records modified since the client's last sync time, reducing payload sizes.
   - The client merges these updates locally and records the new server timestamp.

---

## 2. Conflict Resolution Protocol

Data collisions between different devices are resolved using specific rules based on the collection type:

| Data Type | Strategy | Resolution Mechanism |
| :--- | :--- | :--- |
| **Tasks & Habits** | Last-Write-Wins (LWW) | Compares the client and server `updatedAt` ISO timestamps. The newer timestamp overrides the older one. |
| **Notes** | Safe Merge & Preservation | Resolves conflicts via timestamps. When note metadata lists are loaded, local note contents are preserved if the server stubs do not contain them (preventing empty list structures from clearing local note details). |

---

## 3. Progressive Web App (PWA) & Service Worker Caching

The PWA service worker and the local database layer operate under the same offline-first philosophy:

- **Static Assets & Shell Routing**: Cached by the service worker. Page layouts, styles, and scripts load from cache first and update in the background.
- **Dynamic Application Data**: Handled separately via IndexedDB (Dexie.js) to avoid heavy asset caching collisions.
- **Service Worker Lifecycle**: Standard active listener registers the application shell to make it installable on iOS, Android, and desktop environments.

---

## 4. Notification & Push Subscription Architecture

Push notifications utilize Web Push and service worker events, matching the offline-first philosophy of the application:

1. **Online Web Push Notifications**:
   - Subscribes the device browser to the push service via VAPID keys.
   - Syncs the subscription endpoint, authentication keys, and user timezone to MongoDB.
   - Relies on server-side triggers to dispatch reminders to active endpoints.

2. **Offline Fallback Notifications**:
   - If the user is offline or Web Push is unavailable, the application switches to client-side scheduling.
   - Computes trigger times and registers localized timeouts (`setTimeout`) in memory.
   - Triggers native local browser notification alerts when timers fire.
