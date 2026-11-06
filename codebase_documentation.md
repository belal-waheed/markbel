# Markbel — Complete Codebase Architecture & System Reference

**Domain:** High-Speed, Offline-First Bookmark Vault & Rich Media Archiver  
**Stack:** React 19, TypeScript, Tailwind CSS v4, Dexie.js (IndexedDB), Cloudflare Workers (Hono), Cloudflare D1 (SQLite FTS5), Capacitor 8, Chromium/Firefox Extensions, Model Context Protocol (`@markbel/mcp`)  
**Status:** Authoritative Codebase Reference  
**Version:** 2.9.4+ (November 2026)

---

## 1. Directory Structure & System Map

```
markbel/
├── src/                               # Frontend Single-Page App & PWA
│   ├── components/                    # Modular UI Components
│   │   ├── BookmarkCard.tsx           # Leaf Card View (List, Grid, Typography, Action Sheet)
│   │   ├── BookmarkImage.tsx          # Resilient Lazy Image & Blob Caching
│   │   ├── NavigationHeader.tsx       # Search Input, View Toggles, Sync Status
│   │   ├── Sidebar.tsx                # Category Pillars & Smart Groups Drawer
│   │   ├── modals/                    # Fullscreen & Dialog Overlays
│   │   │   ├── EditBookmarkModal.tsx  # Edit Title, Description, Group, URL
│   │   │   ├── ReaderModal.tsx        # Distraction-Free Offline Article Reader
│   │   │   ├── CommandPalette.tsx     # Alt+K Quick Navigation & Action Palette
│   │   │   └── ReleaseNotesModal.tsx  # Version Changelog Dialog
│   │   └── settings/                  # Settings Views & Matrix Cards
│   │       ├── NavigationPreferencesCard.tsx # "All Bookmarks" Filter Matrix
│   │       └── SmartGroupsConfigCard.tsx     # Auto-Grouping Rule Editor
│   ├── db/                            # Client-Side Storage & Repository Layer
│   │   ├── db.ts                      # Dexie.js Schema, Indexes & Version Upgrades
│   │   ├── BookmarkRepository.ts      # Unidirectional Bookmark CRUD & Outbox Queue
│   │   ├── GroupRepository.ts         # Category Group Persistence
│   │   └── adapters/WebSyncStorage.ts # Sync Adapter between Dexie & Worker
│   ├── lib/                           # Domain Services & Utilities
│   │   ├── nativeBridge.ts            # Capacitor Haptics, Native Share & Keyboard Bridge
│   │   ├── useSwipeGesture.ts         # Edge-Swipe Boundary Drawer State Machine
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
│   │   ├── routes/                    # Edge API Routes
│   │   │   ├── sync.ts                # Delta Push & Pull Endpoints with D1 Transactions
│   │   │   ├── auth.ts                # WebCrypto PBKDF2 Password Hashing & JWT
│   │   │   ├── scraper.ts             # Edge Metadata Scraper & oEmbed Resolvers
│   │   │   └── bookmarks.ts           # REST CRUD Fallbacks & FTS5 Search
│   │   └── normalize.ts               # D1 SQL Row Normalization & Field Mapping
│   ├── schema.sql                     # Authoritative Cloudflare D1 SQLite Schema & Triggers
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

## 2. Core Architectural Standards

For in-depth architectural contracts, storage lifecycles, and engineering runbooks, refer to the canonical project documents:

1. **System Architecture & Data Flows:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
2. **Developer Guide & CRUD Runbook:** [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md)
3. **Ubiquitous Language & Domain Terms:** [`CONTEXT.md`](CONTEXT.md)
4. **Mandatory AI & Developer Instructions:** [`GEMINI.md`](GEMINI.md)
5. **Living Technical Changelog:** [`_log.md`](_log.md)
