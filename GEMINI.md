# Markbel — Project Architecture, CRUD Runbook & System Rules

**Target Audience:** AI Coding Assistants (Antigravity, Gemini, Claude, Cursor) & Staff Engineers  
**Project Workspace:** `D:\dev\projects\markbel`  
**Application Scope:** High-speed, offline-first personal bookmark vault and rich media archiver spanning Web (PWA), Chromium & Firefox Extensions, Android (Capacitor), and Model Context Protocol (`@markbel/mcp`).  
**Status:** Canonical & Mandatory Workspace Rule (Auto-loaded in every session)

---

## 1. System Architecture & Tech Stack

Markbel operates on a **Local-First, Distributed Synchronization** model:
- **Frontend SPA / PWA:** React 19, TypeScript, Tailwind CSS v4, Vite 6, TanStack Virtual (infinite scrolling), Workbox (offline service worker).
- **Client Storage Engine:** Dexie.js 4 (IndexedDB) with WebLocks (`SyncManager`) ensuring single-tab sync leadership and an offline `syncQueue` outbox.
- **Edge Backend:** Cloudflare Workers running the Hono framework (sub-50ms global cold starts).
- **Remote Database:** Cloudflare D1 Serverless SQLite with an append-only monotonic delta change log (`sync_changes`) and full-text search (`bookmarks_fts` FTS5).
- **Browser Extensions:** Chromium & Firefox Manifest V3 with an isolated Shadow DOM command palette (Alt+O Spotlight).
- **Mobile Native Shell:** Capacitor 8 Android with native haptics, keyboard auto-dismiss, and Web Share Target.
- **AI Agent Interface:** Model Context Protocol (`@markbel/mcp`) running via stdio transport.

---

## 2. Directory Layout & File Map

```
markbel/
├── src/                               # Frontend Web SPA & PWA Source
│   ├── components/                    # UI Components
│   │   ├── BookmarkCard.tsx           # Leaf Card Component (List, Grid, Typography, Action Sheet)
│   │   ├── BookmarkImage.tsx          # Resilient Lazy Image & Blob Caching
│   │   ├── NavigationHeader.tsx       # Search Input, View Toggles, Sync Status
│   │   ├── Sidebar.tsx                # Category Pillars & Smart Groups Drawer
│   │   ├── modals/                    # Fullscreen & Dialog Overlays
│   │   │   ├── EditBookmarkModal.tsx  # Edit Title, Description, Group, URL
│   │   │   ├── ReaderModal.tsx        # Distraction-Free Offline Article Reader
│   │   │   ├── CommandPalette.tsx     # Alt+K Quick Navigation Palette
│   │   │   └── ReleaseNotesModal.tsx  # Version Changelog Dialog
│   │   └── settings/                  # Settings Cards & Preference Panels
│   │       ├── NavigationPreferencesCard.tsx # "All Bookmarks" Filter Matrix
│   │       └── SmartGroupsConfigCard.tsx     # Auto-Grouping Rule Editor
│   ├── db/                            # Client-Side Storage & Repository Layer
│   │   ├── db.ts                      # Dexie.js Schema, Indexes & Version Upgrades
│   │   ├── BookmarkRepository.ts      # Unidirectional Bookmark CRUD & Outbox Queue
│   │   ├── GroupRepository.ts         # Category Group Persistence
│   │   └── adapters/WebSyncStorage.ts # Sync Adapter between Dexie & Worker
│   ├── lib/                           # Domain Services & Utilities
│   │   ├── nativeBridge.ts            # Capacitor Haptics, Native Share & Keyboard Bridge
│   │   ├── useSwipeGesture.ts         # Edge-Swipe Boundary Drawer State Machine (<= 36px)
│   │   ├── useModalBackNavigation.ts  # Hardware Back Button Overlay Trap
│   │   ├── navigationPreferences.ts   # Feed Filtering & Exclusion State
│   │   ├── smartGroups.ts             # Rule-Based Auto-Grouping Heuristics
│   │   └── seriesProgression.ts       # Serialized Media Progression (+1 Episode)
│   ├── sync/                          # Synchronization Engine
│   │   ├── SyncManager.ts             # WebLock Leader Election, Push & Pull Engine
│   │   └── LWWResolver.ts             # Deterministic Last-Write-Wins Conflict Resolution
│   └── views/                         # Primary Routed Views
│       ├── BookmarksPage.tsx          # Core App View, TanStack Virtual Feed & Modals
│       ├── LandingPage.tsx            # Marketing Landing, Download Links, Demos
│       └── SettingsPage.tsx           # Account, Sync, Vault, Navigation Preferences
│
├── worker/                            # Cloudflare Workers Edge Backend
│   ├── src/
│   │   ├── index.ts                   # Hono Web Framework Entrypoint
│   │   ├── routes/                    # Edge API Routes (sync, auth, scraper, bookmarks)
│   │   └── normalize.ts               # D1 SQL Row Normalization & Field Mapping
│   ├── schema.sql                     # Cloudflare D1 SQLite Schema & FTS5 Triggers
│   └── wrangler.toml                  # Cloudflare Worker & D1 Binding Configuration
│
├── extension/                         # Browser Extensions (Chromium & Firefox MV3)
│   ├── manifest.json                  # Chromium Extension Manifest (V3)
│   ├── manifest.firefox.json          # Firefox Extension Manifest (V3)
│   └── src/
│       ├── background.ts              # Service Worker, Alarms, Storage Sync
│       ├── MarkbelSpotlight.ts        # Alt+O Global In-Page Spotlight (Shadow DOM)
│       └── popup.ts                   # Extension Action Popup View
│
├── android/                           # Capacitor Android Native Shell
│   ├── app/build.gradle               # Android App Package Configuration & Version Codes
│   └── capacitor.config.ts            # Capacitor Bridge Settings & Plugins
│
├── packages/mcp/                      # Model Context Protocol Server (@markbel/mcp)
│   └── src/index.ts                   # Stdio Transport & Agent Tools for AI Pair Programmers
│
└── docs/                              # Deep Documentation & System Guides
    ├── ARCHITECTURE.md                # System Topology, Layered Architecture & Mermaid Diagrams
    └── DEVELOPER_GUIDE.md             # CRUD Runbook, Testing, Invariants & Release Sequence
```

---

## 3. Bookmark CRUD Engineering Runbook

All bookmark interactions must adhere strictly to the unidirectional data flow: **UI -> BookmarkRepository -> Dexie.js (IndexedDB) -> SyncQueue Outbox -> Cloudflare Worker (D1 SQLite)**.

### A. Creating a Bookmark
- **Primary Method:** `bookmarkRepository.create(bookmark)`
- **Behavior:**
  1. Generates a unique UUID v4 string (`id: crypto.randomUUID()`).
  2. Sets initial revision `version: 1`, `createdAt: new Date().toISOString()`, `updatedAt: new Date().toISOString()`, `deletedAt: null`.
  3. Inserts bookmark immediately into Dexie IndexedDB table `bookmarks`.
  4. Appends mutation to Dexie table `syncQueue` (`operation: 'insert'`).
  5. Triggers background sync via `syncManager.sync(true)`.

### B. Editing a Bookmark
- **Primary Method:** `bookmarkRepository.update(id, updates)`
- **Behavior:**
  1. Loads existing bookmark, merges updates.
  2. Increments `version: existing.version + 1`.
  3. Updates `updatedAt: new Date().toISOString()`.
  4. Enqueues mutation to `syncQueue` (`operation: 'update'`).
  5. UI updates reactively via `useLiveQuery`.

### C. Adding a New Property to Bookmarks (5-Layer Protocol)
When adding a new attribute (e.g. `readingProgress`):
1. **TypeScript Definitions:** Update `LocalBookmark` in `src/db/db.ts` and `BookmarkRow` in `worker/src/types.ts`.
2. **Dexie Schema Migration:** Append `this.version(N + 1).stores({ bookmarks: '...' })` in `src/db/db.ts`.
3. **Repository Layer:** Update mapping in `src/db/BookmarkRepository.ts`.
4. **Cloudflare D1 SQL Schema & Migration:** Add column to `worker/schema.sql` and author `worker/migrations/000X_name.sql`.
5. **Sync Adapters:** Update `worker/src/routes/sync.ts`, `worker/src/normalize.ts`, and `src/db/adapters/WebSyncStorage.ts`.

### D. Deleting a Bookmark (Soft Delete Invariant)
- **Primary Method:** `bookmarkRepository.update(id, { deletedAt: new Date().toISOString() })`
- **Rule:** Never execute raw `DELETE FROM bookmarks` for standard user deletions. Soft deletion creates a tombstone record that synchronizes across devices, updating Cloudflare D1 and removing the entry from the FTS5 virtual search index. Hard purge (`bookmarkRepository.delete(id)`) is strictly reserved for clearing local guest vaults.

### E. Toggling Read, Pin, Series Progression & Reminders
- **Pin / Unpin:** `bookmarkRepository.update(b.id, { isPinned: !b.isPinned })`
- **Read / Unread:** `bookmarkRepository.update(b.id, { isRead: !b.isRead, readAt: isRead ? new Date().toISOString() : "" })` (Triggers TickTick completion sync if `b.ticktickTaskId` is present).
- **Advance Series (+1 Episode):** Call `parseSeriesProgression(b.url, b.title)` to resolve the next episode URL, increment `seriesEpisode`, append to `seriesHistory`, and commit via `bookmarkRepository.update`.

---

## 4. The 7 Iron Architectural Invariants (Never Break These)

1. **Hardware Back Button & Modal Trap Invariant:**
   - `useModalBackNavigation` must **NEVER** be mounted inside leaf components (such as `BookmarkCard.tsx`).
   - Hardware back button trapping is strictly reserved for page-level modals (`BookmarksPage.tsx` overlay state, `CommandPalette.tsx`, `ReaderModal.tsx`).
   - Leaf menus (3-dots action sheet / popover) manage dismiss state purely via local React state and backdrop clicks. Calling `useModalBackNavigation` on a card triggers `history.back()` on menu dismiss, creating a `popstate` event that immediately unmounts newly opened page modals!

2. **React Portal Event Bubbling Invariant:**
   - Any popover, sheet, or overlay rendered via `createPortal(..., document.body)` must attach explicit `stopPropagation` listeners on `onPointerDown`, `onClick`, `onTouchStart`, and `onTouchEnd`.
   - In React, synthetic events bubble through the virtual component tree even if the DOM node is rendered in `document.body`. Failing to stop propagation causes synthetic touch events to bubble up to the parent card, triggering card navigation or arming the 500ms long-press selection timer.

3. **Synchronous Action Callback Invocation:**
   - Button handlers in card action sheets must invoke their target domain callbacks (`onEdit`, `onDelete`, `onClick`, `onToggleRead`, etc.) **synchronously before or alongside** `closeMenu()`.
   - Never call `closeMenu()` before the callback; unmounting the button destroys transient browser user activation needed for `window.open` and Web Share.

4. **Edge-Swipe Mobile Drawer Detection Invariant:**
   - The mobile sidebar navigation swipe gesture must strictly enforce edge-boundary detection (`edgeOnly: true`, `maxEdgeStartX: 36px`).
   - Gestures starting beyond 36px from the left physical bezel must pass through to horizontal scrolling components, tab carousels, and card grids without interception.

5. **TanStack Virtual Layout Invariant:**
   - Always ensure virtualizer uses responsive estimates: `columnCount === 1 ? 64 : 72` for list view, and `columnCount === 1 ? 200 : 280` for grid view.
   - Maintain `scrollMargin: 160` and `overscan: 4` on the parent scroll element (`parentRef.current`).

6. **Cloudflare D1 SQL Query Chunking Invariant:**
   - Cloudflare D1 enforces a maximum parameter limit per query. Any SQL query utilizing `WHERE id IN (...)` must chunk arrays into chunks of `<= 60` items (via `chunkArray()`).

7. **Dexie Schema Versioning Invariant:**
   - Never modify historical `this.version(N).stores({...})` definitions. Always append `this.version(N + 1).stores({...})` with an explicit `.upgrade(...)` handler.

---

## 5. Mandatory Release Lifecycle Protocol (Definition of Done)

Whenever any feature, UI overhaul, bugfix, or enhancement is completed in Markbel:

1. **Never Stop at Code Implementation or Edge Worker Deployment:**
   - A task is NEVER complete until the full release pipeline is executed.
   - The user must NEVER have to ask "what about the release" or "did you update the version".

2. **Permanent Latest Download URLs (Never Hardcode Version Tags):**
   - Android APK: `https://github.com/belal-waheed/markbel/releases/latest/download/Markbel.apk`
   - Firefox Extension: `https://github.com/belal-waheed/markbel/releases/latest/download/markbel-firefox-extension.zip`
   - Chromium Extension: `https://github.com/belal-waheed/markbel/releases/latest/download/markbel-extension.zip`

3. **Mandatory Automated Release Sequence on Task Completion:**
   - **Step 1: Version Alignment (10 Files):** Increment the semantic version in:
     1. `package.json` (`"version": "X.Y.Z"`)
     2. `packages/mcp/package.json` (`"version": "X.Y.Z"`)
     3. `packages/mcp/src/index.ts` (`version: 'X.Y.Z'`)
     4. `extension/manifest.json` (`"version": "X.Y.Z"`)
     5. `extension/manifest.firefox.json` (`"version": "X.Y.Z"`)
     6. `index.html` (`"softwareVersion": "X.Y.Z"`)
     7. `public/llms.txt`
     8. `public/llms-full.txt`
     9. `src/components/landing/landingConstants.ts` (`CURRENT_VERSION = 'X.Y.Z'`)
     10. `android/app/build.gradle` (`versionCode N`, `versionName "X.Y.Z"`)
   - **Step 2: Release Notes & Banner Sync:** Update `src/components/modals/ReleaseNotesModal.tsx` with release notes and update top announcement banner in `src/components/landing/LandingTopBanner.tsx`.
   - **Step 3: Extension Packaging:** Run `npm run build:extension:all` to produce fresh `markbel-extension.zip` and `markbel-firefox-extension.zip`.
   - **Step 4: Unpacked Sync:** Copy `dist-extension/*` to `D:\apps\0-setup\markbel-extension\` so local browser testing is instant.
   - **Step 5: Quality Gate:** Run `npm test` (all 697+ unit tests must pass) and `npm run typecheck` (0 errors).
   - **Step 6: Edge Deployment:** Run `npx wrangler deploy` to update `https://mark.obel.workers.dev`.
   - **Step 7: Vault Synchronization:** Update `projects/markbel/_log.md` and `projects/markbel/_markbel.md`.
   - **Step 8: Git Commit & Tag:** Stage files, commit with Conventional Commit message, tag with `v<version>`, and push both `main` and the tag to GitHub `origin`.

---

## 6. General Standards & Guardrails
- **Zero Emojis:** Never use emojis in code, comments, terminal logs, or git commit messages.
- **PowerShell Standard:** When invoking PowerShell commands via `pwsh`, ALWAYS use `-NoProfile` (`pwsh -NoProfile -Command "..."`).
