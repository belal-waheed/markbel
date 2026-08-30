# ☕ Obel — Offline-First Productivity PWA

> **Obel** is a production-grade, installable Progressive Web Application for unified productivity management. It combines task boards, habit tracking, markdown note-taking, caffeine monitoring, and a Pomodoro focus timer into a single offline-first workspace.

**Current Release**: `v2.1.0`

---

## 🌟 Features

### Task Management Board
- Drag-and-drop Kanban board powered by `@hello-pangea/dnd` with portal-based rendering
- Customizable task lists (IMP, Fast, Later — or create your own)
- Subtask checklists with progress tracking
- Bidirectional linking between tasks and markdown notes
- Smart task ordering with auto-calculated indexes
- Scheduled reminders with local and push notification support

### Markdown Notes Vault
- Rich markdown editor with live preview (CodeMirror)
- GFM support: tables, strikethrough, task lists, footnotes
- LaTeX math rendering (KaTeX)
- Code syntax highlighting
- Audio voice recorder with inline attachment
- Image lightbox preview
- Folder organization with color-coded notes

### Habit Loop Tracker
- Daily, weekly, and custom frequency habits
- Auto-calculated streaks (current + longest)
- Step-based goal tracking (e.g., 8 glasses of water)
- Completion calendar heatmap
- Smart reminders that skip already-completed habits

### Caffeine & Coffee Monitor
- Quick-log cup sizes and beverage types (Espresso, Latte, Drip, etc.)
- Real-time daily caffeine intake tracking
- 30-day caffeine history charts
- Lifetime statistics dashboard

### Pomodoro Focus Timer
- Multi-mode: Focus, Short Break, Long Break, Coffee Break
- Audio chimes and visual feedback for session transitions
- OLED Energy Saver Mode (pitch-black fullscreen)
- Screen Wake Lock to prevent display sleep
- Session history and productivity analytics
- Local fallback notification scheduling

### Additional Features
- 🌗 Dark / Light theme with system preference detection
- ⌨️ Command Palette (⌘K / Ctrl+K) for quick navigation
- 🎮 XP and leveling gamification system
- 📱 Fully installable PWA on iOS, Android, and desktop
- 🔔 Web Push Notifications via VAPID
- 📊 Weekly review dashboard with productivity analytics
- 📅 Calendar view aggregating tasks, habits, and sessions
- 🔄 Real-time offline-first sync with conflict resolution
- 💾 Data backup and restore (JSON export/import)

---

## 🏗️ Architecture Overview

Obel is built on a **local-first database model**. The local IndexedDB storage serves as the single source of truth for the UI, while background processes replicate modifications to a cloud MongoDB cluster.

```
┌──────────────────────────────────────────────┐
│              React UI Components              │
│         (Views + Components + Hooks)          │
└──────────────────────┬───────────────────────┘
                       │ (Reactive Read / Write)
                       ▼
┌──────────────────────────────────────────────┐
│            Zustand Stores (Memory)            │
│  authStore │ taskStore │ noteStore │ etc.     │
└──────────┬──────────────────────┬────────────┘
           │                      │
    (Instant Write)         (Queue if Offline)
           │                      │
           ▼                      ▼
┌─────────────────────┐  ┌───────────────────────┐
│   Dexie.js Tables   │  │    Sync Outbox Queue   │
│   (IndexedDB)       │  │   (db.syncQueue table) │
└─────────────────────┘  └───────────┬───────────┘
                                     │ (Replay when Online)
                                     ▼
                         ┌───────────────────────┐
                         │  Next.js API Routes    │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │  MongoDB (Mongoose)    │
                         └───────────────────────┘
```

### Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Webpack mode) |
| **UI** | React 19 + react-router-dom (client SPA) |
| **Styling** | Tailwind CSS v4 + class-variance-authority |
| **State** | Zustand v5 with IndexedDB persistence |
| **Local DB** | Dexie.js v4 (IndexedDB) |
| **Remote DB** | MongoDB Atlas via Mongoose v9 |
| **PWA** | `@ducanh2912/next-pwa` + custom service worker |
| **Push** | Web Push API + VAPID authentication |
| **Animations** | Framer Motion v12 |
| **DnD** | `@hello-pangea/dnd` (task board) |
| **Dates** | Day.js |
| **Editor** | CodeMirror (react-codemirror) |
| **Charts** | Recharts |
| **Icons** | lucide-react |

---

## 📁 Project Structure

```
obel-next/
├── public/                      # Static assets
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Generated service worker
│   ├── obel.png                 # App icon
│   ├── icons/                   # Notification badge SVGs
│   └── finish-session.mp3       # Timer completion audio
│
├── worker/
│   └── index.ts                 # Custom service worker (push + notifications)
│
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Root HTML shell
│   │   ├── globals.css          # Tailwind directives + design tokens
│   │   ├── [[...route]]/        # Catch-all → client SPA
│   │   └── api/                 # Server-side REST endpoints
│   │       ├── tasks/           #   Task CRUD
│   │       ├── notes/           #   Note CRUD
│   │       ├── habits/          #   Habit CRUD
│   │       ├── coffee/          #   Caffeine logging
│   │       ├── users/           #   Auth & user profile
│   │       ├── sync/            #   Incremental pull sync
│   │       ├── notifications/   #   Push subscription management
│   │       ├── pomodoro/        #   Session logging
│   │       └── cron/            #   Scheduled reminder dispatch
│   │
│   ├── views/                   # Page-level view components
│   ├── components/              # Feature-grouped UI components
│   │   ├── ui/                  #   Base primitives (button, card, dialog...)
│   │   ├── layout/              #   App shell, navigation, auth guard
│   │   ├── tasks/               #   Task board components
│   │   ├── dashboard/           #   Dashboard widgets
│   │   ├── pomodoro/            #   Timer components
│   │   ├── pwa/                 #   PWA install banner, reload prompt
│   │   ├── calendar/            #   Calendar grid
│   │   └── profile/             #   Profile & settings
│   │
│   ├── stores/                  # Zustand state stores
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utility modules (api, db, sync, notifications...)
│   ├── models/                  # Mongoose schemas (server-only)
│   └── types/                   # Shared TypeScript interfaces
│
├── docs/                        # Architecture documentation
├── next.config.ts               # Next.js + PWA config
├── AGENTS.md                    # AI Agent Operating Manual
└── package.json
```

---

## ⚙️ Environment Configuration

### Required Variables

Create a `.env.local` file from the template:
```bash
cp .env.example .env.local
```

| Variable | Scope | Description |
|---|---|---|
| `MONGODB_URI` | Server | MongoDB Atlas connection string |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client + Server | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | Server only | VAPID private key (keep secret) |
| `CRON_SECRET_KEY` | Server | Auth token for cron reminder endpoint |

### Generating VAPID Keys
```bash
npx web-push generate-vapid-keys
```

### Example `.env.local`
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/obel?retryWrites=true&w=majority

NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxR...your_public_key
VAPID_PRIVATE_KEY=your_private_key_here

CRON_SECRET_KEY=a_random_secret_for_cron_auth
```

---

## 🚀 Local Development

### Prerequisites
- Node.js 20+
- npm 10+
- MongoDB Atlas cluster (or local MongoDB instance)

### Setup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your MongoDB URI and VAPID keys

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### PWA Testing
The PWA service worker is **disabled in development** mode. To test PWA features (install prompt, offline mode, push notifications):

```bash
# Build and run production
npm run build
npm run start
```

---

## 📋 CLI Reference

| Command | Description |
|---|---|
| `npm run dev` | Development server with Webpack |
| `npm run build` | Production build with type checking |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint analysis |
| `npx tsc --noEmit` | TypeScript type validation |
| `npx web-push generate-vapid-keys` | Generate VAPID key pair |

---

## 🔄 Offline-First Sync System

### How It Works
1. **All writes go to IndexedDB first** — The UI never waits for network responses.
2. **Optimistic state updates** — Zustand state reflects changes immediately.
3. **Failed API calls are queued** — Mutations are stored in the `syncQueue` table with timestamps.
4. **Replay on reconnect** — When the app detects an `online` event, it replays the queue sequentially.
5. **Incremental pull** — After replay, the engine pulls only records modified since the last sync.
6. **Conflict resolution** — Last-Write-Wins (LWW) using `updatedAt` timestamps.

### Key Files
| File | Purpose |
|---|---|
| `src/lib/db.ts` | Dexie IndexedDB schema, sync queue helper |
| `src/lib/syncEngine.ts` | Outbox replay + incremental pull logic |
| `src/lib/storage.ts` | IndexedDB storage adapter for Zustand |
| `src/lib/api.ts` | Fetch wrapper with circuit breaker |

See [docs/sync_architecture.md](docs/sync_architecture.md) for the full technical deep-dive.

---

## 🔔 Push Notification System

### Architecture
```
Client → Subscribe → Push Service (FCM/Mozilla)
Client → Upload subscription → Next.js API → MongoDB
Cron Job → Query due items → web-push → Push Service → Service Worker → System Notification
```

### Components
| Component | File |
|---|---|
| Client Notification System | `src/lib/notifications.ts` |
| Service Worker Handlers | `worker/index.ts` |
| Local Fallback Scheduler | `src/hooks/useNotificationScheduler.ts` |
| Subscription Model | `src/models/PushSubscription.ts` |
| Subscribe Endpoint | `src/app/api/notifications/subscribe/route.ts` |
| Cron Reminder Trigger | `src/app/api/cron/reminders/route.ts` |

### Setting Up Cron
Register a cron job (e.g., via [cron-job.org](https://cron-job.org)) to hit:
```
GET https://your-domain.com/api/cron/reminders?cron_key=YOUR_CRON_SECRET_KEY
```
Recommended frequency: **every 1 minute** for time-precise task/habit reminders.

See [docs/push-notifications-setup.md](docs/push-notifications-setup.md) for the full implementation guide.

---

## 🐻 State Management (Zustand)

### Store Inventory
| Store | Domain | Key Responsibilities |
|---|---|---|
| `authStore` | Authentication | Login/logout, user session, XP, token refresh |
| `taskStore` | Tasks | CRUD, board lists, drag ordering, subtasks, task↔note linking |
| `noteStore` | Notes | CRUD, folders, markdown content, audio attachments |
| `habitStore` | Habits | CRUD, streak calculation, completion tracking, goal progress |
| `timerStore` | Pomodoro | Timer state, session modes, OLED mode, session logging |
| `coffeeStore` | Caffeine | Cup logging, daily/lifetime stats |
| `userInfoStore` | User Stats | Aggregated XP, daily counters, 30-day rolling history |
| `themeStore` | Theme | Dark/light mode toggle |
| `toastStore` | Notifications | In-app toast + undo system |
| `shortcutStore` | Shortcuts | Keyboard shortcut registry |

### Data Persistence Strategy
- **Heavy data** (tasks, notes, habits) → Dexie tables (native IndexedDB)
- **Lightweight config** (theme, lists, settings) → Zustand `persist` with `indexedDBStorage`
- **Never `localStorage`** for application data

---

## 🎨 Design System

### Fonts
- **Primary**: Geist Sans (variable)
- **Monospace**: Geist Mono (variable)

### Theme Colors
| Token | Value |
|---|---|
| Background (dark) | `#140b1a` / `#1b1220` |
| Theme Color | `#100d12` |
| Primary | Purple/violet gradient spectrum |

### Component Library
Custom UI primitives in `src/components/ui/` built with:
- `class-variance-authority` (CVA) for variants
- `tailwind-merge` for class deduplication
- `clsx` for conditional classes

Available primitives: `Button`, `Card`, `Dialog`, `Input`, `Select`, `Tabs`, `Tooltip`, `Badge`, `Checkbox`, `Progress`, `ProgressRing`, `ScrollArea`, `Separator`, `Skeleton`, `DropdownMenu`

---

## 📱 PWA Configuration

### Manifest
Located at `public/manifest.json`:
- Display mode: `standalone`
- Orientation: `portrait`
- Shortcuts: New Task, Focus Timer
- Icons: 192x192 and 512x512 (both `any` and `maskable`)

### Service Worker
- **Generated by**: `@ducanh2912/next-pwa` (Workbox under the hood)
- **Custom handlers**: `worker/index.ts` (push events + notification clicks)
- **Registration**: Automatic on production builds
- **Update flow**: `ReloadPrompt` component detects new SW versions and prompts user

### Install Prompt
- Captured via `beforeinstallprompt` event in `usePWAInstall` hook
- Presented via `InstallBanner` component

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/tasks` | List / create tasks |
| PUT/DELETE | `/api/tasks/[id]` | Update / delete task |
| GET/POST | `/api/notes` | List / create notes |
| PUT/DELETE | `/api/notes/[id]` | Update / delete note |
| GET/POST | `/api/habits` | List / create habits |
| PUT/DELETE | `/api/habits/[id]` | Update / delete habit |
| GET/POST | `/api/coffee` | List / log caffeine entries |
| GET/POST | `/api/users` | User authentication |
| PUT | `/api/users/[id]` | Update user profile |
| GET | `/api/sync` | Incremental pull (since timestamp) |
| POST | `/api/notifications/subscribe` | Register push subscription |
| GET | `/api/cron/reminders` | Trigger scheduled reminders |
| POST | `/api/pomodoro` | Log completed focus session |

---

## 📚 Documentation Index

| Document | Description |
|---|---|
| [README.md](README.md) | This file — project overview and setup |
| [AGENTS.md](AGENTS.md) | AI Agent operating manual and coding rules |
| [docs/sync_architecture.md](docs/sync_architecture.md) | Offline-first sync layer technical design |
| [docs/push-notifications-setup.md](docs/push-notifications-setup.md) | Web Push notification implementation guide |
| [.env.example](.env.example) | Environment variables template |

---

## 🛠️ What Changed in Release 2

Release 2 resolved critical data integrity issues from v1:

- **Offline-First Store Overhaul**: Migrated state persistence from Zustand localStorage to Dexie.js (native IndexedDB). Zero-latency rendering, no blank pages.
- **Safe Metadata Merging**: Note sync isolates markdown content from folder metadata stubs, preventing local content overwrites.
- **Client-Authoritative UUIDs**: IDs generated client-side via `crypto.randomUUID()`, eliminating race conditions during offline sync.
- **Reliable Push Notifications**: Atomic database upserts prevent duplicate endpoint crashes.
- **Framer Motion Fixes**: Resolved undefined SVG animatable value warnings.

---

## 📄 License

Private project. All rights reserved.
