# Markbel Browser Extension (Manifest V3)

A high-speed, type-safe browser companion for **Markbel** that enables 1-click bookmark capturing, live in-DOM metadata extraction, smart domain categorization, and direct synchronization with the Cloudflare Workers edge backend.

---

## Capabilities

- **Instant 1-Click Save**: Popup HUD pre-populates the current tab title, URL, description, and high-res media thumbnail.
- **In-DOM Metadata Extractor**: Extracts OpenGraph tags (`og:title`, `og:image`, `og:description`), JSON-LD, and user text selection directly from the live DOM without waiting for external server scraping.
- **Smart Domain Categorization**: Reuses Markbel's authoritative domain matcher (`src/lib/smartGroups.ts`) to automatically categorize URLs into smart groups (`YT`, `Insta`, `X`, and `Unsorted`) with custom overrides.
- **Context Menu Integration**: Right-click any page, link, or text selection $\rightarrow$ **Save to Markbel**.
- **Global Keyboard Shortcuts**:
  - `Alt + Shift + M`: Open Markbel HUD popup.
  - `Alt + Shift + S`: Instantly save current tab in the background (confirmed via extension badge).
- **Direct Edge Delta Ingestion**: Pushes mutations directly to Markbel's authoritative Cloudflare Workers edge endpoint (`POST /api/sync/push`) with JWT Bearer authentication.
- **Multi-Backend Support**: Connects to the production Cloudflare Workers edge (`https://mark.obel.workers.dev/api`) by default, with custom URL support in Settings (e.g. `http://localhost:3001/api`).

---

## Building the Extension

```bash
# Build the production-ready extension package into dist-extension/
npm run build:extension

# Build and create a distribution ZIP archive (markbel-extension.zip)
npm run extension:zip
```

---

## Installation Guide (Developer / Unpacked Mode)

### Chrome / Brave / Edge / Opera

1. Run `npm run build:extension` (generates the `dist-extension/` directory).
2. Open your browser's extension manager:
   - **Google Chrome / Brave**: Navigate to `chrome://extensions/`
   - **Microsoft Edge**: Navigate to `edge://extensions/`
3. Enable **Developer mode** (toggle switch in the top-right corner on Chrome, or bottom-left on Edge).
4. Click the **Load unpacked** button.
5. Select the `dist-extension` folder inside this repository:
   ```
   d:\dev\projects\markbel\dist-extension
   ```
6. Pin the **Markbel** icon to your browser toolbar for quick access.

---

## Architecture Overview

Built using TypeScript and Vite with zero experimental plugins and direct code sharing with root `src/`:

```
markbel/
├── extension/
│   ├── manifest.json              # Manifest V3 specification
│   ├── icons/                     # 16, 48, 128 PNG assets
│   └── src/
│       ├── background.ts          # Stateless MV3 background worker
│       ├── content.ts             # In-DOM metadata scraper
│       ├── api.ts                 # Typed edge API client & session manager
│       ├── popup/
│       │   ├── index.html         # HUD markup
│       │   ├── popup.ts           # Type-safe HUD controller (imports @/lib/smartGroups)
│       │   └── popup.css          # Cyberpunk styling matching Markbel design tokens
│       └── options/
│           ├── index.html         # Settings markup
│           ├── options.ts         # Settings controller
│           └── options.css        # Settings styling
├── vite.config.extension.ts       # Vite multi-entry Rollup configuration
└── dist-extension/                # Final compiled unpacked extension output
```
