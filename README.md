<div align="center">

# Markbel

**High-speed, offline-first bookmark manager and rich media archiver.**

[![Cloudflare Workers](https://img.shields.io/badge/Edge-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Cloudflare D1](https://img.shields.io/badge/Database-Cloudflare%20D1%20SQLite-F38020?logo=sqlite&logoColor=white)](https://developers.cloudflare.com/d1/)
[![React 19](https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Styles-Tailwind%20CSS%20v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite 6](https://img.shields.io/badge/Bundler-Vite%206-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![IndexedDB](https://img.shields.io/badge/Storage-Dexie.js%20IndexedDB-1F4B99)](https://dexie.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Live Demo](https://mark.obel.workers.dev) • [Architecture Docs](docs/architecture/sync-protocol.md) • [LLM Specification](llms.txt)

</div>

---

## Overview

Markbel is an open-source, offline-first bookmark manager and rich media archiver built with React 19, Cloudflare Workers, Cloudflare D1 SQLite, and Dexie IndexedDB. It enables users to capture, organize, and search bookmarks instantly with zero latency, full offline functionality, multi-device delta sync, and rich metadata extraction for videos and social feeds.

### Key Capabilities

- **Instant Local Vault (Guest Mode)**: Operates immediately out of the box with Dexie.js IndexedDB. No mandatory login is required to organize links locally.
- **Resilient Multi-Device Delta Sync**: Cloudflare D1 SQLite backend logs atomic change operations (`sync_changes`) with Last-Write-Wins (LWW) conflict resolution and deterministic compaction.
- **Multi-Platform Rich Media Scraper**: Edge-optimized metadata extraction for YouTube (Shorts and Videos), TikTok, Twitter/X, and standard OpenGraph targets.
- **Mobile Dual-View UI**: Toggle between a dense 2-column mobile grid and a compact list row view (56px thumbnail layout fitting 6–8 bookmarks per viewport).
- **Native Web Share Target**: Integrated PWA share handler (`/share`) that accepts shared links directly from Android and mobile browser share sheets.
- **Auth Session Resilience**: Token caching and non-destructive refresh lifecycle ensuring sessions survive intermittent network dropouts. Includes 6-digit email password reset flow.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT PWA                                │
│                                                                        │
│   React 19 + Tailwind v4 + Vite 6                                      │
│   ├── Reactive Store: Dexie.js (IndexedDB)                             │
│   ├── View Engine: Dual Grid / Compact List                            │
│   └── Share Target Handler: /share route                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         HTTPS Push / Pull Delta
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    CLOUDFLARE EDGE (V8 ISOLATE)                        │
│                                                                        │
│   Cloudflare Workers + Hono Router                                     │
│   ├── Static Assets: SPA Precache Delivery                             │
│   ├── Auth Engine: WebCrypto PBKDF2 / SHA-256 JWT                      │
│   ├── Scraper: Edge oEmbed (YouTube, TikTok, X) + HTMLRewriter         │
│   └── Database Layer: Cloudflare D1 (Serverless SQLite)                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Specifications

| Layer | Technology | Key Capabilities |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript | Concurrent rendering, Action states, strict typing |
| **Local Storage** | Dexie.js 4 (IndexedDB) | Reactive live queries (`useLiveQuery`), offline persistence |
| **Edge Compute** | Cloudflare Workers + Hono | Sub-50ms global cold starts, zero-dependency router |
| **Database** | Cloudflare D1 (SQLite) | Atomic transactions, delta change log, serverless scaling |
| **Styling & Design** | Tailwind CSS v4 | CSS-first `@theme` variables, OKLCH color tokens |
| **Media Parsing** | oEmbed + OpenGraph | YouTube Shorts/Videos, TikTok, X/Twitter, article fallback |
| **PWA & Offline** | Vite PWA + Workbox | Full asset precaching, installable manifest, share target |
| **Testing** | Vitest | Unit test suites for LWW sync engine, auth, notifications |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Cloudflare Wrangler CLI (`npm install -g wrangler` or via `npx wrangler`)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/belal-waheed/markbel.git
cd markbel
npm install
```

### 2. Local Development

Start the Vite frontend dev server:

```bash
npm run dev:frontend
```

Run Cloudflare Workers with local D1 SQLite:

```bash
npm run worker:dev
```

Run test suite:

```bash
npm test
```

### 3. Production Build & Deployment

Build frontend SPA assets and verify TypeScript types:

```bash
npm run build
```

Apply database migrations to Cloudflare D1 (remote):

```bash
npx wrangler d1 execute markbel-db --remote --file=worker/schema.sql
```

Deploy Worker & static assets to Cloudflare:

```bash
npx wrangler deploy
```

---

## Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `/` | Focus search and filter bar | Global |
| `n` | Open Add Bookmark modal | Global |
| `Escape` | Close active modal / clear search | Global |

---

## Generative Engine Optimization (GEO) & AI Reference

For automated AI research agents, LLMs, and RAG pipelines, refer to the machine-readable specifications:
- [`/llms.txt`](llms.txt): High-level system architecture and data models.
- [`/llms-full.txt`](llms-full.txt): Comprehensive API schema and delta sync protocol specification.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
