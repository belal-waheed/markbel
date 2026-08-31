# Contributing to Markbel

Thank you for your interest in contributing to Markbel. We welcome contributions that maintain high technical craft, robust offline-first reliability, and clean architecture.

---

## 1. Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/belal-waheed/markbel.git
   cd markbel
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start local development servers:**
   - Frontend SPA: `npm run dev:frontend`
   - Cloudflare Worker & D1 emulation: `npm run worker:dev`

---

## 2. Code & Architecture Conventions

- **Layered Clean Architecture**: Keep separation of concerns between UI components (`src/views`, `src/components`), reactive local storage (`src/db`), and synchronization/conflict resolution (`src/sync`).
- **Offline-First Guarantee**: Any new feature or user interaction must work with zero network latency against Dexie.js IndexedDB first, enqueuing changes into `syncQueue` for eventual consistency.
- **Edge Performance**: Cloudflare Worker endpoints should minimize external dependencies and utilize lightweight streaming / V8 isolate capabilities.
- **Zero Emojis**: Do not use emojis in UI components, terminal output, or markdown documentation. Use SVG icons (e.g. `lucide-react`).

---

## 3. Pull Request Guidelines

1. Create a feature branch with a descriptive name:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-fix-name
   ```

2. Verify all tests pass and the production build compiles cleanly:
   ```bash
   npm test
   npm run build
   ```

3. Submit a Pull Request targeting the `main` branch with a clear summary of changes.
