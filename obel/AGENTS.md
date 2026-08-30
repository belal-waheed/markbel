<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 🛡️ Obel — AI Agent Operating Manual

> **Read this entire document before writing, modifying, or deleting any file.**
> Violating these rules will break the PWA, corrupt user data, or cause sync failures.

---

## 🧭 1. Project Identity & Stack

| Layer | Technology | Version Lock |
|---|---|---|
| **Framework** | Next.js (App Router) with `--webpack` flag | `16.x` |
| **UI Rendering** | React 19 + react-router-dom (client SPA routing) | `19.x` |
| **Styling** | Tailwind CSS v4 + `@tailwindcss/postcss` | `4.x` |
| **State Management** | Zustand v5 (with `persist` + IndexedDB storage) | `5.x` |
| **Local Database** | Dexie.js v4 (IndexedDB wrapper) | `4.x` |
| **Remote Database** | MongoDB Atlas via Mongoose v9 | `9.x` |
| **PWA Engine** | `@ducanh2912/next-pwa` + custom service worker | `10.x` |
| **Push Notifications** | Web Push API + `web-push` npm (VAPID) | `3.x` |
| **Animations** | Framer Motion v12 | `12.x` |
| **Drag & Drop** | `@hello-pangea/dnd` | `18.x` |
| **Date Handling** | Day.js (NOT Moment.js, NOT date-fns) | `1.x` |
| **Forms** | react-hook-form | `7.x` |
| **Icons** | lucide-react | Latest |
| **Component Library** | Custom UI primitives (shadcn-style) in `src/components/ui/` | — |

### Critical Stack Rules
- **NEVER** install `moment`, `date-fns`, `axios`, `redux`, `@reduxjs/toolkit`, or `swr`. Obel uses Day.js, native fetch, and Zustand.
- **NEVER** replace `@hello-pangea/dnd` with `@dnd-kit` for the task board. Both coexist in package.json for different use cases.
- **NEVER** downgrade or remove `@ducanh2912/next-pwa`. It powers the entire PWA lifecycle.
- **NEVER** use `localStorage` for persisting application data. Use `indexedDBStorage` from `src/lib/storage.ts` or Dexie tables directly.

---

## 📐 2. File Size & Component Decomposition Rules

> **The #1 rule: No single file should exceed 300 lines.**
> If a file is approaching 300 lines, it MUST be split into smaller, focused modules.

### Line Count Targets

| File Category | Target Lines | Hard Maximum | Action if Exceeded |
|---|---|---|---|
| **View / Page** (`src/views/`) | 80–150 | 200 | Extract sections into child components in `src/components/<feature>/` |
| **Component** (`src/components/`) | 50–150 | 250 | Extract sub-components, hooks, or utility functions |
| **Zustand Store** (`src/stores/`) | 100–200 | 300 | Split into slices or extract helper functions into `src/lib/` |
| **Utility / Library** (`src/lib/`) | 50–150 | 250 | Split by responsibility |
| **Custom Hook** (`src/hooks/`) | 30–80 | 150 | Extract logic into library utils |
| **Type Definitions** (`src/types/`) | 50–100 | 200 | Split by domain (tasks, notes, habits, etc.) |
| **API Route** (`src/app/api/`) | 30–80 | 150 | Extract handler logic into `src/lib/` helpers |
| **Mongoose Model** (`src/models/`) | 20–60 | 100 | Keep schema and model in one file, no logic |

### Known Violations to Fix (Technical Debt)
The following files currently exceed limits and should be decomposed in future work:
- `src/views/NotesPage.tsx` (~87KB) → Extract `NoteEditor`, `NoteList`, `FolderSidebar`, `NoteToolbar` into `src/components/notes/`
- `src/views/HabitsPage.tsx` (~50KB) → Extract `HabitCard`, `HabitForm`, `HabitStats`, `StreakCalendar` into `src/components/habits/`
- `src/views/PomodoroPage.tsx` (~35KB) → Extract `TimerDisplay`, `TimerControls`, `SessionHistory`, `OLEDMode` into `src/components/pomodoro/`
- `src/views/ProfilePage.tsx` (~33KB) → Extract `ProfileHeader`, `StatsDashboard`, `SettingsPanel`, `DataExport` into `src/components/profile/`
- `src/components/tasks/TaskListCard.tsx` (~33KB) → Extract `TaskCard`, `TaskCardActions`, `DragHandle` sub-components
- `src/stores/taskStore.ts` (~25KB) → Extract merge logic and notification scheduling into `src/lib/taskHelpers.ts`
- `src/components/layout/AppLayout.tsx` (~26KB) → Extract `Sidebar`, `MobileNav`, `TopBar`, `NavigationItems`

### Decomposition Strategy

When a file grows beyond its limit:

1. **Identify logical boundaries** — Separate UI sections, data logic, and side effects.
2. **Create a feature subdirectory** under `src/components/<feature>/`:
   ```
   src/components/notes/
   ├── NoteEditor.tsx          # Rich text editing area
   ├── NoteList.tsx            # Sidebar list of notes
   ├── FolderSidebar.tsx       # Folder navigation tree
   ├── NoteToolbar.tsx         # Action toolbar (delete, pin, color)
   └── index.ts               # Re-exports for clean imports
   ```
3. **Extract hooks** for stateful logic: `src/hooks/useNoteEditor.ts`
4. **Extract pure functions** into: `src/lib/noteHelpers.ts`
5. **Keep view files thin** — Views in `src/views/` should be composition shells that import and arrange components.

---

## 📁 3. Project Directory Map

```
obel-next/
├── public/                        # Static assets (icons, manifest, sw.js)
│   ├── manifest.json              # PWA manifest — DO NOT remove fields
│   ├── sw.js                      # Generated service worker — DO NOT edit manually
│   ├── obel.png                   # App icon (192x192 / 512x512)
│   └── icons/                     # Notification badge SVGs
│
├── worker/
│   └── index.ts                   # Custom service worker source (push + notification handlers)
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root HTML shell (meta, fonts, theme script)
│   │   ├── globals.css            # Tailwind directives + design tokens
│   │   ├── [[...route]]/          # Catch-all route → renders client SPA
│   │   └── api/                   # Server-side API route handlers
│   │       ├── tasks/             # CRUD for tasks
│   │       ├── notes/             # CRUD for notes
│   │       ├── habits/            # CRUD for habits
│   │       ├── coffee/            # Caffeine logging
│   │       ├── users/             # Auth & user profile
│   │       ├── sync/              # Incremental pull endpoint
│   │       ├── notifications/     # Push subscription management
│   │       ├── pomodoro/          # Session logging
│   │       └── cron/              # Scheduled reminder dispatch
│   │
│   ├── views/                     # Page-level view components (thin composition shells)
│   │   ├── DashboardPage.tsx
│   │   ├── TasksPage.tsx
│   │   ├── PomodoroPage.tsx
│   │   ├── HabitsPage.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── NotesPage.tsx
│   │   ├── ProfilePage.tsx
│   │   ├── ReviewPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── NotFoundPage.tsx
│   │
│   ├── components/                # Reusable UI components (organized by feature)
│   │   ├── ui/                    # Base primitives (button, card, dialog, input, tabs, etc.)
│   │   ├── layout/                # AppLayout, AuthGuard, PWAUpdater
│   │   ├── tasks/                 # Task board components
│   │   ├── dashboard/             # Dashboard widgets and cards
│   │   ├── pomodoro/              # Timer-related components
│   │   ├── pwa/                   # InstallBanner, ReloadPrompt
│   │   ├── calendar/              # Calendar grid
│   │   ├── profile/               # Profile/settings components
│   │   └── CommandPalette.tsx     # Global ⌘K search
│   │
│   ├── stores/                    # Zustand state stores (one per domain)
│   │   ├── authStore.ts           # Authentication state + user session
│   │   ├── taskStore.ts           # Task CRUD + offline sync + board lists
│   │   ├── noteStore.ts           # Notes CRUD + folder management
│   │   ├── habitStore.ts          # Habits CRUD + streak calculation
│   │   ├── timerStore.ts          # Pomodoro timer state + session tracking
│   │   ├── coffeeStore.ts         # Caffeine logging
│   │   ├── userInfoStore.ts       # Aggregated user stats (XP, daily, cumulative)
│   │   ├── themeStore.ts          # Dark/light mode toggle
│   │   ├── toastStore.ts          # Global toast/undo notifications
│   │   └── shortcutStore.ts       # Keyboard shortcut registry
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── usePWAInstall.ts       # PWA install prompt interception
│   │   ├── useNotificationScheduler.ts  # Local notification timer fallback
│   │   └── useKeyboardShortcuts.ts      # Global ⌘K + hotkeys
│   │
│   ├── lib/                       # Non-React utility modules
│   │   ├── api.ts                 # Fetch wrapper with circuit breaker
│   │   ├── db.ts                  # Dexie IndexedDB schema + migration logic
│   │   ├── mongodb.ts             # Mongoose connection pool (server-only)
│   │   ├── storage.ts             # IndexedDB storage adapter for Zustand persist
│   │   ├── syncEngine.ts          # Offline outbox replay + incremental pull
│   │   ├── notifications.ts       # Browser + Web Push notification system
│   │   ├── sounds.ts              # Audio feedback engine
│   │   ├── haptics.ts             # Vibration API wrapper
│   │   ├── wakeLock.ts            # Screen Wake Lock for timer
│   │   ├── backup.ts              # Data export/import
│   │   ├── rollover.ts            # Daily date rollover logic
│   │   └── utils.ts               # General utility functions
│   │
│   ├── models/                    # Mongoose schemas (server-only)
│   │   ├── User.ts
│   │   ├── Task.ts
│   │   ├── Note.ts
│   │   ├── Habit.ts
│   │   ├── Coffee.ts
│   │   ├── UserInfo.ts
│   │   └── PushSubscription.ts
│   │
│   └── types/
│       └── index.ts               # Shared TypeScript interfaces (ITask, INote, IHabit, etc.)
│
├── docs/                          # Architecture documentation
│   ├── sync_architecture.md       # Offline-first sync design
│   └── push-notifications-setup.md # Web Push implementation guide
│
├── next.config.ts                 # Next.js + PWA plugin config
├── package.json                   # Dependencies (DO NOT add conflicting packages)
└── tsconfig.json                  # TypeScript configuration
```

---

## 🏗️ 4. Architecture: Offline-First Data Flow

```
┌──────────────────────────────────────────────┐
│              React UI Components              │
│         (Views + Components + Hooks)          │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│             Zustand Stores (Memory)           │
│  authStore │ taskStore │ noteStore │ etc.     │
└──────────┬──────────────────────┬────────────┘
           │                      │
    (Instant Write)        (Queue if Offline)
           │                      │
           ▼                      ▼
┌─────────────────────┐  ┌───────────────────────┐
│   Dexie.js Tables   │  │  Sync Outbox Queue    │
│  (IndexedDB)        │  │  (db.syncQueue table) │
│  tasks, notes,      │  │  Sequential mutations  │
│  habits, userInfo   │  │  with timestamps       │
└─────────────────────┘  └───────────┬───────────┘
                                     │
                              (Replay Online)
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │  Next.js API Routes   │
                         │  /api/tasks, /api/notes│
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │  MongoDB (Mongoose)    │
                         │  Cloud persistence     │
                         └───────────────────────┘
```

### Rules for Data Flow

1. **ALWAYS write to Dexie first, then sync to server.** Never skip the local write.
2. **ALWAYS update Zustand state optimistically** before the API call returns.
3. **ALWAYS queue failed API calls** to `db.syncQueue` via `db.queueSync()`.
4. **NEVER call MongoDB directly from client-side code.** MongoDB access is server-only, through API routes.
5. **NEVER use `localStorage`** for app data. Only `localStorage` usage allowed:
   - `obel-theme-store` (theme preference for FOUC prevention)
   - `obel-last-sync-{userId}` (last sync timestamp)
6. **ALWAYS generate IDs client-side** using `crypto.randomUUID()`. Never rely on server-assigned `_id`.

---

## 🔋 5. PWA — Progressive Web App Rules

The app is a fully installable PWA. These rules are **non-negotiable**.

### PWA Configuration
- **Plugin**: `@ducanh2912/next-pwa` in `next.config.ts`
- **Manifest**: `public/manifest.json` — Always keep `display: "standalone"`, all icon entries, and shortcuts
- **Service Worker Source**: `worker/index.ts` — Custom push and notification click handlers
- **Generated SW**: `public/sw.js` — Auto-generated. **DO NOT edit this file manually.**
- **Install Hook**: `src/hooks/usePWAInstall.ts` — Intercepts `beforeinstallprompt`
- **Install Banner**: `src/components/pwa/InstallBanner.tsx`
- **Reload Prompt**: `src/components/pwa/ReloadPrompt.tsx` — Handles SW update flow
- **PWA Updater**: `src/components/layout/PWAUpdater.tsx` — Lifecycle management

### PWA Do's and Don'ts

| ✅ DO | ❌ DON'T |
|---|---|
| Keep `manifest.json` valid with all required icon sizes | Remove or rename `manifest.json` or `manifest.webmanifest` |
| Test installability after any layout.tsx changes | Add `start_url` that doesn't match catch-all route |
| Keep `register: true` in next.config.ts PWA options | Set `disable: true` in production builds |
| Handle `beforeinstallprompt` in usePWAInstall hook | Skip PWA testing on mobile devices |
| Maintain service worker push/notification handlers | Remove or break `worker/index.ts` event listeners |
| Verify `<meta name="theme-color">` stays `#100d12` | Change theme-color without updating manifest.json too |

### Manifest Checklist (Verify After Edits)
- [ ] `name` and `short_name` are set
- [ ] `display` is `"standalone"`
- [ ] `theme_color` matches viewport themeColor in `layout.tsx`
- [ ] `icons` array has both `any` and `maskable` purpose entries
- [ ] `start_url` is `/` or matches the catch-all route

---

## 🗄️ 6. Dexie.js — Local Database Rules

### Schema Location
`src/lib/db.ts` — All table definitions live here.

### Current Tables
```typescript
tasks:    'id, userId, status, listId, order, updatedAt'
habits:   'id, userId, updatedAt'
notes:    'id, userId, folderId, updatedAt'
userInfo: 'id, userId, updatedAt'
syncQueue: '++id, timestamp'   // Auto-increment primary key
```

### Dexie Rules

1. **Adding a New Table**: Add it to the EXISTING version, OR increment the version number. **NEVER** create a second `this.version(1)` call.
2. **Adding Indexes**: If you add a new indexed field to an existing table, you MUST bump the version:
   ```typescript
   this.version(2).stores({
     tasks: 'id, userId, status, listId, order, updatedAt, newField',
     // ... repeat all tables
   })
   ```
3. **Reading Data**: Always filter by `userId` when querying tables. Never load all records.
4. **Writing Data**: Always use `.put()` (upsert) instead of `.add()` to prevent duplicate key errors during sync.
5. **Sync Queue**: Use `db.queueSync(path, method, payload)` to enqueue offline mutations.
6. **Migration**: The `migrateLegacyZustandData()` method handles one-time migration from old idb-keyval storage. Do not remove it.
7. **Never import `db.ts` in server-side code** (API routes, middleware). IndexedDB only exists in the browser.

---

## 🐻 7. Zustand Store Conventions

### Store File Pattern
Every store follows this exact structure:

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '@/lib/storage'
import { db } from '@/lib/db'
import { useAuthStore } from './authStore'

interface MyState {
  items: Item[]
  isLoading: boolean
  error: string | null
  fetchItems: () => Promise<void>
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

export const useMyStore = create<MyState>()(
  persist(
    (set, get) => ({
      // State + Actions
    }),
    {
      name: 'obel-my-store',               // Storage key prefix
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({            // ⚠️ ONLY persist lightweight config
        // DO NOT persist data arrays (items, tasks, notes, habits)
        // Those go through Dexie tables for performance
      }),
    }
  )
)
```

### Store Rules

1. **`partialize` is mandatory** — Never persist entire data arrays in Zustand storage. Large arrays (tasks, notes, habits) must live in Dexie tables and be loaded on demand.
2. **Fetch pattern**: Always load from Dexie first (instant), then fetch from API (background merge):
   ```typescript
   fetchItems: async () => {
     // 1. Hydrate from Dexie (instant, offline-safe)
     const local = await db.myTable.where({ userId }).toArray()
     set({ items: local })

     // 2. Skip API if offline
     if (!navigator.onLine) return

     // 3. Fetch from API + merge
     const remote = await apiGet('/my-endpoint')
     // ... merge logic
   }
   ```
3. **Optimistic updates**: Always update Zustand state first, write to Dexie, then call API.
4. **Error handling**: On API failure, queue to `db.syncQueue`. Never throw to the UI.
5. **Cross-store access**: Use `useAuthStore.getState()` (not hook form) when accessing other stores inside actions.
6. **ID generation**: Always use `crypto.randomUUID()` on the client side. Never wait for server IDs.
7. **Timestamps**: Always include `updatedAt: new Date().toISOString()` on every mutation.
8. **Naming**: Stores are named `use<Domain>Store` (e.g., `useTaskStore`, `useNoteStore`).

---

## 🍃 8. MongoDB & Mongoose Rules

### Connection
`src/lib/mongodb.ts` — Singleton connection pool with HMR protection.

```typescript
import { connectToDatabase } from '@/lib/mongodb'

export async function GET(req: Request) {
  await connectToDatabase()
  // ... use Mongoose models
}
```

### Model Location
All Mongoose models live in `src/models/`. Each file exports one model.

### Model Rules

1. **Always call `connectToDatabase()`** at the top of every API route handler.
2. **Always use `mongoose.models.ModelName ||`** guard to prevent re-compilation in dev:
   ```typescript
   export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema)
   ```
3. **Never import `mongoose` or models in client-side code.** These are server-only.
4. **Upsert pattern for subscriptions**: Use `findOneAndUpdate` with `{ upsert: true }` to prevent duplicate endpoint crashes.
5. **Schema validation**: Use Zod for request body validation in API routes, Mongoose schema types for database-level.
6. **Index strategy**: Add compound indexes for frequently queried combinations (e.g., `userId + updatedAt`).

### API Route Pattern
```typescript
// src/app/api/<resource>/route.ts
import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { MyModel } from '@/models/MyModel'

export async function GET(req: Request) {
  await connectToDatabase()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const items = await MyModel.find({ userId }).lean()
  return NextResponse.json(items)
}
```

---

## 🔔 9. Web Push Notification Rules

### Architecture
```
Client Browser ──subscribe──→ Push Service (FCM/Mozilla)
       │                              │
       │ (upload subscription)        │ (push message)
       ▼                              │
  Next.js API ──save──→ MongoDB       │
       │                              │
       │ (cron triggers)              │
       ▼                              ▼
  web-push ──encrypt+send──→ Service Worker ──show──→ System Notification
```

### Key Files
| File | Purpose |
|---|---|
| `src/lib/notifications.ts` | Client-side NotificationSystem class (permission, send, schedule, push registration) |
| `worker/index.ts` | Service worker push + notificationclick event handlers |
| `src/hooks/useNotificationScheduler.ts` | Local fallback scheduler when Web Push is unavailable |
| `src/models/PushSubscription.ts` | MongoDB schema for stored push subscriptions |
| `src/app/api/notifications/subscribe/route.ts` | Subscription registration endpoint |
| `src/app/api/cron/reminders/route.ts` | Cron-triggered reminder dispatch |

### Push Notification Rules

1. **ALWAYS upsert subscriptions** by `subscription.endpoint` — never insert duplicates.
2. **ALWAYS prune dead endpoints** — Delete subscriptions on HTTP `410` or `404` from the push service.
3. **ALWAYS include timezone** in the subscription payload — Cron needs client timezone for local-time matching.
4. **ALWAYS provide a local fallback** — If Web Push is unavailable, schedule with `setTimeout` via `NotificationSystem.schedule()`.
5. **NEVER block the UI** waiting for push registration. Run it in the background after login.
6. **Service worker audio**: Do NOT try to play audio from the service worker. Audio playback happens client-side only.
7. **Badge icons**: Use monochrome white SVGs in `public/icons/` for notification badges.

### VAPID Environment Variables
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # Client-side (public)
VAPID_PRIVATE_KEY=...              # Server-side only (secret)
```
**NEVER expose `VAPID_PRIVATE_KEY` to the client.** It lacks the `NEXT_PUBLIC_` prefix intentionally.

---

## 🎨 10. Styling & UI Conventions

### Tailwind CSS v4
- Config is in `postcss.config.mjs` using `@tailwindcss/postcss`
- Design tokens defined in `src/app/globals.css` (also symlinked as `src/index.css`)
- Use `tailwind-merge` (`cn()` helper) for conditional class merging
- Use `class-variance-authority` (CVA) for component variants

### UI Component Rules
1. **All base primitives** live in `src/components/ui/` (button, card, dialog, input, select, tabs, etc.)
2. **Never create new UI primitive files** without checking if one already exists.
3. **Use the existing `cn()` utility** for conditional classnames:
   ```typescript
   import { cn } from '@/lib/utils'
   ```
4. **Dark mode**: Always use `dark:` variant classes. Theme is toggled via `document.documentElement.classList`.
5. **Animations**: Use Framer Motion for complex animations. Use Tailwind `animate-*` for simple transitions.
6. **No raw hex colors in components** — Use CSS variables or Tailwind theme tokens.
7. **Mobile-first**: Always design for mobile viewport first, then add `md:` / `lg:` breakpoints.

---

## 🔄 11. Sync Engine Rules

### Key File
`src/lib/syncEngine.ts`

### Sync Flow
1. App goes online → `replayOfflineQueue()` fires
2. Read all `db.syncQueue` entries ordered by timestamp
3. Replay each mutation sequentially to the API
4. On success: delete from queue. On `400/404/409`: discard (stale). On `5xx`: halt and retry later.
5. After successful replay: `pullServerUpdates()` fetches incremental changes since last sync
6. Merge server data into local Dexie + Zustand state

### Sync Rules

1. **NEVER modify `syncEngine.ts` ordering logic** — Mutations must replay in chronological order.
2. **NEVER skip the queue** — All write operations must be queued if the API call fails.
3. **Conflict resolution**: Last-Write-Wins using `updatedAt` timestamps.
4. **Pull sync endpoint**: `GET /api/sync?userId=X&since=TIMESTAMP` — Returns only records modified after the timestamp.
5. **Hydration after sync**: After replaying, refresh all supplementary stores (auth, userInfo, timer, coffee).

---

## 🧪 12. Development & Build Commands

| Command | Description |
|---|---|
| `npm run dev` | Dev server with Webpack (`next dev --webpack`) |
| `npm run build` | Production build (`next build --webpack`) |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint check |
| `npx tsc --noEmit` | TypeScript type checking |
| `npx web-push generate-vapid-keys` | Generate VAPID key pair |

### Build Rules
- **Always run `npx tsc --noEmit`** after significant changes to catch type errors.
- **The `--webpack` flag is required** — Turbopack is NOT compatible with the PWA plugin.
- **PWA is disabled in development** (`disable: process.env.NODE_ENV === "development"` in `next.config.ts`). Test PWA features with `npm run build && npm run start`.

---

## 🚫 13. Forbidden Patterns (Will Break Things)

| ❌ Pattern | Why It Breaks |
|---|---|
| `import mongoose from 'mongoose'` in client code | Mongoose requires Node.js. Will crash the browser. |
| `localStorage.setItem('obel-tasks', ...)` | Bypasses Dexie/IndexedDB. Data will be lost on migration. |
| `await fetch('/api/...')` without try/catch + queue | Offline users lose data permanently. |
| Removing `crypto.randomUUID()` and waiting for server ID | Race conditions, duplicate entries during offline sync. |
| Editing `public/sw.js` directly | It's auto-generated by `next-pwa`. Changes will be overwritten. |
| Using `useEffect` to fetch data without cleanup | Memory leaks and stale state on navigation. |
| Adding `"use server"` directives to store files | Stores are client-only. Server directives will break hydration. |
| Importing from `src/stores/` inside `src/app/api/` | Stores are client-only. API routes are server-only. |
| Using `window.` without `typeof window !== 'undefined'` guard | Server-side rendering will crash. |
| Removing `partialize` from Zustand persist config | Will serialize massive arrays to IndexedDB on every state change. |
| Using `useAuthStore()` (hook form) inside store actions | Use `useAuthStore.getState()` instead. Hooks only in components. |

---

## 📝 14. Creating New Features — Checklist

When adding a new feature (e.g., "Journal"), follow this checklist:

### Backend (Server-Side)
- [ ] Create Mongoose model: `src/models/Journal.ts`
- [ ] Create API routes: `src/app/api/journal/route.ts` (GET, POST)
- [ ] Create API route with ID: `src/app/api/journal/[id]/route.ts` (PUT, DELETE)
- [ ] Add `connectToDatabase()` call at the top of every handler
- [ ] Validate request body with Zod

### Types
- [ ] Add `IJournal` interface to `src/types/index.ts`

### Local Database
- [ ] Add Dexie table in `src/lib/db.ts` (bump version number)
- [ ] Add table type declaration on the `ObelDatabase` class

### State Management
- [ ] Create Zustand store: `src/stores/journalStore.ts`
- [ ] Implement fetch → Dexie first → API merge pattern
- [ ] Implement optimistic update → Dexie write → API call → queue on fail
- [ ] Use `partialize` to exclude data arrays from Zustand serialization

### UI Components
- [ ] Create view: `src/views/JournalPage.tsx` (thin shell, <150 lines)
- [ ] Create components: `src/components/journal/JournalEntry.tsx`, `JournalList.tsx`, etc.
- [ ] Each component: <250 lines
- [ ] Add route to `src/App.tsx` (lazy load with `lazyWithRetry`)

### Navigation
- [ ] Add nav item to `src/components/layout/AppLayout.tsx`
- [ ] Add icon from `lucide-react`

### PWA
- [ ] Add shortcut to `public/manifest.json` if appropriate
- [ ] Verify app still installs after changes

---

## 🔗 15. Cross-Reference: Key Documentation

| Document | Location |
|---|---|
| Sync Architecture Deep Dive | `docs/sync_architecture.md` |
| Push Notification Setup Guide | `docs/push-notifications-setup.md` |
| This Agent Manual | `AGENTS.md` (this file) |
| Project README | `README.md` |
| Environment Variables Template | `.env.example` |

---

## ⚡ 16. Quick Reference — Import Paths

```typescript
// State
import { useTaskStore } from '@/stores/taskStore'
import { useAuthStore } from '@/stores/authStore'

// Database
import { db } from '@/lib/db'                    // Dexie (client-only)
import { connectToDatabase } from '@/lib/mongodb' // Mongoose (server-only)

// API
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'

// Notifications
import { notificationSystem } from '@/lib/notifications'

// Storage
import { indexedDBStorage } from '@/lib/storage'

// UI
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Types
import { ITask, INote, IHabit, IUserInfo } from '@/types'

// Sounds & Haptics
import { soundSystem } from '@/lib/sounds'
import { triggerHaptic } from '@/lib/haptics'
```
