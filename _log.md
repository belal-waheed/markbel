---
type: project-log
project: markbel
tags:
  - log
  - changelog
  - markbel
---

# Markbel — Technical Execution Log & Changelog

> [!NAV] Navigation
> [[_markbel|Markbel Project Hub]] | **Technical Log**

---

## Technical Log

### Phase 26: Alt+O Spotlight Token Theming, Dual-Mode Visual Cards & Missing Image Healing (v2.7.2 - 2026-11-05)
- **Slice 1 (Alt+O Spotlight & Popup Design Token Synchronization):**
  - Overhauled Shadow DOM CSS variables in `MarkbelSpotlight.ts` to bind directly to Markbel's design tokens (Swiss Editorial light mode and Deep Onyx dark mode).
  - Implemented automatic theme state synchronization reading `markbel_theme_mode` from `chrome.storage.local` with system `prefers-color-scheme` fallback.
  - Added header theme toggle button (Sun/Moon SVG) with instant switching and cross-context broadcast.
  - Updated `popup.css` color variables to inherit Markbel's palette with support for both media queries and explicit `[data-theme]` / `.theme-*` attributes.
- **Slice 2 (Dual-Mode Visual Cards & Compact List Viewing):**
  - Architected dual-mode view system in `MarkbelSpotlight.ts` and `popupSearchView.ts` (`view-visual` vs `view-compact`) toggleable via header button and persistent in `chrome.storage.local`.
  - Visual Mode: 56x38px thumbnail image container with automatic fallback cascade (high-res cover -> domain favicon -> initial letter with group accent background); 2-line title clamping; rich metadata strip (group pill with design token colors, series episode badge, domain favicon, and content type badge); and quick action buttons (Copy URL, Open in New Tab).
  - Compact Mode: 1-line dense list optimized for keyboard velocity navigation.
- **Slice 3 (Instagram In-DOM Extraction & Platform Fallback Card):**
  - Added active DOM query heuristics in `extractPageMetadata.ts` targeting `article video[poster], video[poster], article img[srcset], div[role="dialog"] video[poster], div[role="dialog"] img[srcset], main img[src*="cdninstagram"]` when saving from Instagram SPAs.
  - Created `INSTAGRAM_FALLBACK_POSTER` vector gradient card data URI in `mediaHeuristics.ts` to ensure zero empty or broken placeholder states.
- **Slice 4 (Cloudflare D1 Remote Database Image Healing):**
  - Identified 42 video stream endpoints (`video.vid3rb.com/video/<uuid>`) and suppressed favicon entries in remote D1 `markbel-db`.
  - Executed batch update resolving all video endpoints to static JPEG poster thumbnails (`thumbnails.vid3rb.com/.../thumbnail.001.jpeg`) and high-resolution anime series covers (`sousou-no-frieren`, `shangri-la-frontier`, `tensei-shitara-slime`, `black-clover`).
  - Verified remote D1 database has 0 `video.vid3rb.com` URLs remaining in `image` column.
- **Slice 5 (Mandatory Release Governance Protocol v2.7.2):**
  - Bumped version to `2.7.2` across `package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html` (`softwareVersion: "2.7.2"`), `public/llms.txt`, `public/llms-full.txt`, and `src/components/landing/landingConstants.ts` (`v2.7.2`).
  - Updated `src/components/modals/ReleaseNotesModal.tsx` and `src/components/landing/LandingTopBanner.tsx`.
  - Built fresh extension zips (`npm run build:extension:all`) and mirrored unpacked bundle to `D:\apps\0-setup\markbel-extension\`.
  - Deployed Cloudflare Worker and PWA assets to edge: `https://mark.obel.workers.dev`.
  - Quality gates: 639 unit & integration tests passing across 47 test suites (`npm test`), 0 TypeScript compilation errors (`npm run typecheck`).

### Phase 25: Smart Auto-Grouping Engine, 8-Pillar Taxonomy Presets & Remote Vault Reorganization (v2.7.1 - 2026-11-05)
- **Slice 1 (Constraint Operator Expansion & MatchMode Any):**
  - Extended `ConstraintOperator` type in `src/lib/smartGroups.ts` with `'title_contains'` and `'content_type_equals'`.
  - Updated `evaluateConstraint`, `evaluateCompoundRule`, `inspectSmartGroupMatch`, and `resolveSmartGroup` to accept and evaluate `title` and `contentType`.
  - Added support for `matchMode?: 'all' | 'any'` on `CompoundSmartGroupRule`, enabling flexible multi-alternative condition matching (OR) alongside strict compound constraints (AND).
  - Updated `calculateRuleSpecificity` with granular weighting for title (+12) and content type (+10).
  - Enhanced LRU cache keys to incorporate normalized `title` and `contentType`.
- **Slice 2 (8-Pillar Taxonomy Presets & Settings UI Craftsmanship):**
  - Updated `PRESET_SMART_RULES` to include 6 curated presets across the 8-pillar taxonomy:
    - Anime (`preset-anime`, indigo): `anime3rb.com`, `egydead`, `Sousou no Frieren`, `Shangri-La Frontier`.
    - Dev (`preset-dev`, emerald): `github.com`, `velosfocus.pages.dev`, `system design`, `docker`, `kubernetes`, `ai workflow`.
    - Deen (`preset-deen`, teal): `رحلة اليقين`, `منهاج القاصدين`, `آفات اللسان`, `لحظة تفكر`.
    - Music (`preset-music`, amber): `list=RD`, `playlist`, `slowed`, `acoustic`, `lyric video`.
    - Tools (`preset-tools`, cyan): `file-converter.io`, `chromewebstore`.
    - Design (`preset-design`, rose): `wallpapercave.com`, `wallpaper`.
  - Extended `settingsConstants.ts` with `title_contains` and `content_type_equals` in `OPERATOR_CONFIG`, mapped Lucide vector icons (`Film`, `Compass`, `Music`, `Wrench`, `Palette`), and added `teal` and `rose` color tokens.
  - Enhanced live sandbox in `SmartGroupsCard.tsx` with dedicated title input and rule condition connection badges displaying `OR` for `any` matchMode.
- **Slice 3 (Client Auto-Organization & Integration Seams):**
  - Connected `resolveSmartGroup` in `db.ts` (`autoOrganizeUnsortedBookmarks`), `WebSyncStorage.ts`, `ShareTargetPage.tsx`, and `AddBookmarkModal.tsx` to pass title and content type for intelligent retroactive and creation-time categorization.
- **Slice 4 (Cloudflare D1 Remote Database Vault Migration):**
  - Restored deleted `Anime` group in D1 remote with color `indigo`.
  - Provisioned missing 8-pillar groups (`Deen` teal, `Music` amber, `Tools` cyan, `Design` rose, `System` slate) in remote D1 with version increments.
  - Executed 7 batch SQL updates on remote `markbel-db` reorganizing active bookmarks across Anime, Dev, Deen, Music, Tools, Design, and System.
  - Verified remote distribution: Insta (15), Dev (10), Anime (10), Music (8), YT (7), System (3), Deen (3), Tools (2), Design (1), Unsorted (1).
- **Slice 5 (Mandatory Release Governance Protocol v2.7.1):**
  - Bumped version to `2.7.1` across `package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html` (`softwareVersion: "2.7.1"`), `public/llms.txt`, `public/llms-full.txt`, and `src/components/landing/landingConstants.ts` (`v2.7.1`).
  - Updated `src/components/modals/ReleaseNotesModal.tsx` and `src/components/landing/LandingTopBanner.tsx`.
  - Built fresh extension zips (`npm run build:extension:all`) and mirrored unpacked bundle to `D:\apps\0-setup\markbel-extension\`.
  - Deployed Cloudflare Worker and PWA assets to edge: `https://mark.obel.workers.dev`.
  - Quality gates: 620 unit & integration tests passing (`npm test`), 0 TypeScript compilation errors (`npm run typecheck`).

### Phase 24: Series Progression Engine, Two-Way TickTick Sync, Alt+O Resilience & Master-Detail Settings Suite (v2.7.0 - 2026-11-05)
- **Slice 1 (Episodic Series Progression Engine & Succession):**
  - Architected `src/lib/seriesProgression.ts` with extensible strategy architecture covering EgyDead, Anime3rb, YouTube Playlists, Crunchyroll, Manga/Comics, and Generic Streaming patterns.
  - Added Dexie v11 migration with indexed `seriesKey` and added `seriesKey`, `seriesEpisode`, `seriesSeason`, and `seriesHistory` to `LocalBookmark`.
  - Added `advanceSeriesBookmark(existingId, incomingUrl, mode)` supporting in-place progression with rollback history, separate bookmark creation, or delete succession.
  - Upgraded `BookmarkCard.tsx` with episodic badge pill (`EP 5`), inline `+1 Next Ep` quick action, and rollback drawer action.
- **Slice 2 (Alt+O Keyboard Shortcut Resilience):**
  - Hardened extension service worker in `extension/src/background.ts`: explicitly targets `tab.windowId` when executing `chrome.action.openPopup()`.
  - Added automatic fallback to web vault spotlight (`/app?search=1`) when triggered on `about:blank`, restricted browser schema (`chrome://`, `edge://`, `moz-extension://`), or when popup fails.
  - Updated `extension/src/popup/popupUtils.ts`: forces search view on blank or restricted tabs.
- **Slice 3 (Two-Way TickTick Synchronization):**
  - Created `src/lib/ticktickSync.ts` supporting full authenticated CRUD over TickTick Open API v1 (`getTickTickProjects`, `createTickTickTask`, `completeTickTickTask`, `updateTickTickTask`).
  - Created `TickTickIntegrationCard.tsx` in settings suite with token input, live project selector, connection testing, and status indicator.
  - Integrated automatic two-way completion sync between read bookmarks and TickTick tasks in `SyncManager.ts`.
- **Slice 4 (Responsive Master-Detail Settings Suite):**
  - Redesigned `src/views/SettingsPage.tsx` with a multi-breakpoint Master-Detail architecture: 280px sticky sidebar rail on desktop (avatar, sync status, search omnibox, vertical tabs) and swipeable segmented pill rail on mobile.
  - Embedded `TickTickIntegrationCard` and dedicated `SeriesProgressionCard`.
- **Slice 5 (Mobile UX & Theme Polish):**
  - Styled `<option>` tags inside `<select>` dropdowns with surface background and contrast text, eliminating the white box in dark mode.
  - Unified mobile filter header (< 640px) into a single compact swipeable strip so status pills and category pills do not double-stack and waste 180px.
  - Enforced `calc(1rem + env(safe-area-inset-top))` and `calc(1rem + env(safe-area-inset-bottom))` across mobile headers, viewport, and action bars.
- **Slice 6 (Edge Worker & Console Error Eradication):**
  - Added clean security headers in `worker/src/index.ts` (`Permissions-Policy: camera=(), microphone=(), geolocation=()`).
  - Configured `getPublicFaviconUrl` to return `/favicon.ico` directly for `mark.obel.workers.dev`, `localhost`, and `window.location.hostname`, preventing Google S2 404 network errors.
  - Added `effectiveImage` and `isLowQualityImage` checks in `src/views/ArchivePage.tsx`.
- **Slice 7 (Mandatory Release Governance Protocol v2.7.0):**
  - Bumped version to `2.7.0` across `package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html` (`softwareVersion: "2.7.0"`), `public/llms.txt`, `public/llms-full.txt`, and `src/components/landing/landingConstants.ts` (`v2.7.0`).
  - Updated `src/components/modals/ReleaseNotesModal.tsx` and `src/components/landing/LandingTopBanner.tsx`.
  - Built fresh extension zips (`npm run build:extension:all`) and mirrored unpacked bundle to `D:\apps\0-setup\markbel-extension\`.
  - Deployed Cloudflare Worker and PWA assets to edge: `https://mark.obel.workers.dev`.
  - Quality gates: 610 unit & integration tests passing (`npm test`), 0 TypeScript compilation errors (`npm run typecheck`).

### Phase 23: Image Pipeline Hardening, Video Stream Purge, Private IP Favicon Sanitizer & Edge Media Proxy Resilience (v2.6.1 - 2026-11-05)
- **Slice 1 (Deterministic Media Heuristics & Video Stream Detection):**
  - Expanded `isFaviconUrl()` into canonical `isLowQualityImage(url?: string | null): boolean` in `src/lib/mediaHeuristics.ts` while retaining `isFaviconUrl` as a drop-in alias.
  - Implemented `isVideoStreamUrl(url?: string | null): boolean` detecting HLS manifests (`.m3u8`), MPEG-DASH manifests (`.mpd`), transport stream chunks (`.ts`), and video streaming endpoints on known hosts (`video.vid3rb.com/video/`, `videodelivery.net`).
  - Added low-quality image detection for Google S2 favicon service, generic favicon URLs, `.ico`/`.svg` assets, Meta shell static assets (`static.cdninstagram.com/rsrc.php`), small dimension query hints (`sz=32`, `s=64`, `w=32`, `h=32` where dim <= 64), and brand badge/logo/avatar URL paths. Preserved educational Wikimedia Commons illustrations.
- **Slice 2 (Backend Scraper Hardening & 302 Video Poster Resolution):**
  - Fortified `worker/src/lib/metadataScraper.ts` in OpenGraph parsing, Cheerio fallbacks, and Microlink steps to validate candidate images with `isLowQualityImage` and `isVideoStreamUrl`.
  - Implemented `resolveVideoThumbnail()`: resolves 302 redirects from `video.vid3rb.com/video/<uuid>` to extract static JPEG posters (`https://thumbnails.vid3rb.com/.../thumbnail.001.jpeg`).
  - Hardened edge image proxy (`worker/src/routes/media.ts`) in `/api/proxy/image`: immediately rejects video stream manifests with 415, checks redirect hops, and validates binary streams using magic-byte sniffing (`sniffImageMimeType`), rejecting unrecognized binary payloads with 415 rather than defaulting to corrupt JPEG.
- **Slice 3 (Bookmark Components & Favicon SSRF Sanitizer):**
  - Implemented `isSafeFaviconUrl()` in `src/lib/urlSafety.ts`: validates that custom bookmark favicons use safe public URLs and that any Google S2 proxy URL does not target private RFC 1918 IPv4 or IPv6 loopback addresses.
  - Updated `src/components/BookmarkCard.tsx` (Grid, List, and Masonry layouts) to sanitize `b.favicon` before rendering, falling back to `getPublicFaviconUrl(b.url)` or placeholder icons.
  - Upgraded `src/components/BookmarkImage.tsx` to reject video stream and low quality URLs in `getInitialStage()`, `captureAndCacheThumbnail()`, and error fallbacks.
- **Slice 4 (Self-Healing Dexie Database Sweep):**
  - Upgraded `repairAndEnrichBookmarkThumbnails()` in `src/db/db.ts` to scan non-deleted IndexedDB bookmarks on launch, scrub video stream URLs and low-quality logos from `image`, clear private IP favicons from `favicon`, and re-enrich media art using `extractInstantMediaMetadata()`.
- **Slice 5 (Mandatory Release Governance Protocol v2.6.1):**
  - Bumped version to `2.6.1` across `package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html` (`softwareVersion: "2.6.1"`), `public/llms.txt`, `public/llms-full.txt`, and `src/components/landing/landingConstants.ts` (`v2.6.1`).
  - Updated `src/components/modals/ReleaseNotesModal.tsx` and `src/components/landing/LandingTopBanner.tsx`.
  - Built fresh extension zips (`npm run build:extension:all`) and mirrored unpacked bundle to `D:\apps\0-setup\markbel-extension\`.
  - Deployed Cloudflare Worker and PWA assets to edge: `https://mark.obel.workers.dev`.
  - Quality gates: 586 unit & integration tests passing (`npm test`), 0 TypeScript errors (`npm run typecheck`).

### Phase 22: Full Design System Overhaul, Dual-Mode Editorial Cards, Collapsible Rail & Tabbed Settings Suite (v2.6.0 - 2026-11-05)
- **Slice 1 (CSS-First Tailwind v4 Design Tokens & Dark Mode):**
  - Architected high-contrast, WCAG AA compliant design tokens in `src/index.css` for Light Mode (Warm Paper & Crisp Slate) and true Deep Onyx Dark Mode (`.dark`).
  - Implemented crisp token variables: `--color-bg-canvas`, `--color-bg-surface`, `--color-bg-muted`, `--color-bg-subtle`, `--color-border-subtle`, `--color-border-strong`, `--color-border-focus`, and refined brand/tag colors.
  - Updated core utilities (`studio-card`, `studio-card-hover`, `studio-input`, `btn-primary`, `btn-secondary`, `btn-danger`) to consume tokens natively with smooth micro-interactions.
  - Added zero-flash inline theme loader in `index.html` and synced status bar background colors in `src/App.tsx`.
- **Slice 2 (BookmarkCard Dual-Mode Editorial Redesign):**
  - Completely eliminated the "empty grey box" dilemma in `src/components/BookmarkCard.tsx` via dynamic layout detection (`hasHeroImage = Boolean(effectiveImage && !isFaviconUrl(effectiveImage))`).
  - Hero Media Layout: 16:9 cover image with smooth hover zoom, glassmorphic content-type overlay pills, and top-right read/pin status indicators.
  - Editorial Typography Layout: Clean meta header (favicon, domain chip, reading time), prominent 3-line headline, contextual excerpt, and bottom metadata strip.
  - Compact List View: High-density row with micro-thumbnail/favicon tile, bold truncated title, domain pill, category badge, date, and progressive hover actions.
- **Slice 3 (Collapsible Desktop Sidebar Rail & Media Streams):**
  - Upgraded `src/components/GroupSidebar.tsx` with a persistent desktop collapsible rail mode (56px/60px width) stored in `localStorage` (`markbel_sidebar_collapsed`).
  - Added dedicated Instant Media Streams section (Videos, Articles, Code, Social) with real-time vault counts and active filtering in `src/views/BookmarksPage.tsx`.
  - Retained slide-over mobile drawer with backdrop blur.
- **Slice 4 (Command Search Bar, Sort Matrix & Animated Batch HUD):**
  - Overhauled `src/components/BookmarkFilterBar.tsx` with full-width omnibox search, keyboard shortcut badges (`⌘K` / `/`), sort dropdown (Newest First, Oldest First, Title A-Z, Reading Time), and quick media filter chips.
  - Refined `src/components/BookmarkBatchBar.tsx` with high-contrast token borders and smooth animated drawer transitions.
- **Slice 5 (Tabbed Settings Suite & Storage Quota Meter):**
  - Replaced monolithic 8-card vertical scroll in `src/views/SettingsPage.tsx` with a focused 5-tab suite (`General & Appearance`, `Smart Groups & Rules`, `Sync & Collaboration`, `Storage & Data`, `API & Integrations`).
  - Supported URL hash deep linking (`#general`, `#appearance`, `#groups`, `#navigation`, `#sync`, `#storage`, `#api`).
  - Added live storage quota visualization (`navigator.storage.estimate`) in `src/components/settings/DataBackupCard.tsx`.
- **Slice 6 (Readwise-Grade Reader Mode Overhaul):**
  - Enhanced `src/components/modals/ReaderModal.tsx` with typography controls (Sans, Serif, Mono), font size steppers (SM, BASE, LG, XL), and column width options (Narrow, Normal, Wide).
  - Added scroll depth progress indicator and Wayback Machine snapshot fallback.
- **Slice 7 (Mandatory Release Governance Protocol v2.6.0):**
  - Synchronized version `2.6.0` across `package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html` (`softwareVersion: "2.6.0"`), `public/llms.txt`, `public/llms-full.txt`, `packages/mcp/package.json`, `packages/mcp/src/index.ts`, `worker/src/lib/linkHealth.ts` (`MarkbelBot/2.6.0`), `android/app/build.gradle` (`versionCode 21`, `versionName "2.6.0"`), `twa-manifest.json`, and `src/components/landing/landingConstants.ts` (`v2.6.0`).
  - Updated `src/components/modals/ReleaseNotesModal.tsx` and `src/components/landing/LandingTopBanner.tsx`.
  - Built fresh extension zips (`npm run build:extension:all`) and mirrored unpacked bundle to `D:\apps\0-setup\markbel-extension\`.
  - Deployed Cloudflare Worker and PWA assets to edge: `https://mark.obel.workers.dev` (Version ID: `8576e5bd-b592-45a5-af2a-19d75f605657`).
  - Quality gates: 569 unit tests passing (`npm test`), 0 TypeScript errors (`npm run typecheck`).

### Phase 21: In-Page Toast Shortcut Save, Unified JSON/HTML Importer & Permission Minimization (v2.5.20 - 2026-11-05)
- **Slice 1 (In-Page Shortcut Toast Notification):**
  - Replaced OS-level Windows Action Center notification (`chrome.notifications.create`) in `extension/src/background.ts` with direct tab messaging (`MARKBEL_SHOW_TOAST`).
  - Implemented `showMarkbelToast` in `extension/src/content.ts`: glassmorphic top-right floating toast (`#0d1117`, cyan accent, SVG checkmark, title, message, group badge) with smooth transform/opacity entry, 2.2s auto-dismiss, click dismissal, and strict MV3 CSP compliance.
  - Added unit test suite in `src/sync/ExtensionToast.test.ts` (5 tests passing).
- **Slice 2 (Unified JSON & Netscape HTML Import Engine):**
  - Architected `src/lib/bookmarkImport.ts` providing unified parsing and deduplication for both Markbel JSON backups and Netscape HTML browser bookmarks.
  - Updated `src/components/settings/DataBackupCard.tsx` with unified file picker (`.html,.htm,.json`), informative user copy, and multi-format batch transaction sync.
  - Extracted `<A ICON="...">` favicons from Netscape HTML and integrated `extractInstantMediaMetadata` for 0ms instant YouTube video thumbnails and GitHub OpenGraph posters.
  - Added comprehensive test suites in `src/lib/bookmarkImport.test.ts` and `src/sync/CrossClientMediaResilience.test.tsx` (all passing).
- **Slice 3 (Manifest Permission Minimization):**
  - Removed unused `"notifications"` permission from `extension/manifest.json` and `extension/manifest.firefox.json`.
- **Slice 4 (Mandatory Release Governance v2.5.20):**
  - Synchronized version `2.5.20` across `package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html` (`softwareVersion`), `public/llms.txt`, `public/llms-full.txt`, `packages/mcp/package.json`, `packages/mcp/src/index.ts`, `worker/src/lib/linkHealth.ts` (`MarkbelHealthCheck/2.5.20`), `android/app/build.gradle` (versionCode 20, versionName "2.5.20"), and `twa-manifest.json`.
  - Updated `ReleaseNotesModal.tsx` and `LandingTopBanner.tsx`.
  - Built extension packages (`npm run build:extension:all`) and cleanly mirrored to `D:\apps\0-setup\markbel-extension\`.
  - Passed quality gates: 569 tests passing across 44 suites (`npm test`), 0 TypeScript errors (`npm run typecheck`).
  - Deployed Cloudflare Worker and PWA assets to `https://mark.obel.workers.dev`.

### Phase 20: Safe Private Favicons, Cross-Origin Media Streamlining, Edge Redirect Resilience & Push Feedback (v2.5.18 - 2026-11-04)
- **Slice 1 (Safe Private IP Favicon Guard):**
  - Added and exported `getPublicFaviconUrl(url)` in `src/lib/urlSafety.ts`, guarding public Google S2 favicon service queries against SSRF and private CIDR ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, localhost, loopback).
  - Updated `src/components/BookmarkCard.tsx` (List and Grid viewports) to use `fallbackSrc={b.favicon || getPublicFaviconUrl(b.url)}`, eliminating client console 404 spam when loading local/LAN bookmarks.
  - Added unit test coverage in `src/lib/urlSafety.test.ts`.
- **Slice 2 (Cross-Origin Direct Proxy & Negative-Cache Retry Guard):**
  - Enhanced `captureAndCacheThumbnail` in `src/components/BookmarkImage.tsx` to detect same-origin vs cross-origin URLs.
  - Bypassed browser CORS direct fetch on third-party URLs to prevent red console CORS check failures, routing cross-origin captures directly to the edge media proxy.
  - Implemented `failedCaptures = new Set<string>()` negative cache to short-circuit retry storms and console log pollution on permanently broken or inaccessible thumbnails.
  - Added unit tests in `src/components/BookmarkImage.test.tsx` and updated `CachedThumbnail.test.ts` and `BookmarkImageSlowNetwork.test.tsx`.
- **Slice 3 (Edge Proxy Manual Redirect Hops & Referer Preservation):**
  - Updated `/api/proxy/image` in `worker/src/routes/media.ts` to use `redirect: "manual"` for upstream fetches, preventing Cloudflare/runtime from dropping the `Referer` header across domain boundaries.
  - Added support for up to 3 redirect hops (301, 302, 307, 308) with strict `isSafePublicUrl` SSRF validation and referer preservation (`https://anime3rb.com/` for `vid3rb.com` and `thumbnails.vid3rb.com`).
- **Slice 4 (Web Push Cloud Configuration Guidance):**
  - Updated `/api/notifications/vapid-key` in `worker/src/routes/notifications.ts` to return explicit `{ supported: false, publicKey: "", message: "VAPID key not configured on server" }` when VAPID keys are unset.
  - Updated `src/components/settings/AccountProfileCard.tsx` to display clear feedback (`onNotice`) indicating that server cloud VAPID push is unconfigured while local browser reminders remain active.
  - Adjusted `src/lib/push.ts` to use `console.debug` when VAPID public key is absent.
- **Slice 5 (Dead Code Pruning):**
  - Removed obsolete files `src/sync/refactor.js` and `scripts/neon-schema.sql`.
- **Slice 6 (Mandatory Release Governance v2.5.18):**
  - Synchronized version `2.5.18` across `package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html`, `public/llms.txt`, `public/llms-full.txt`, `packages/mcp/package.json`, `packages/mcp/src/index.ts`, `worker/src/lib/linkHealth.ts`, `android/app/build.gradle` (versionCode 18, versionName 2.5.18), and `twa-manifest.json`.
  - Updated `ReleaseNotesModal.tsx` and `LandingTopBanner.tsx`.
  - Built production extension zip bundles (`npm run build:extension:all`) and mirrored unpacked files to `D:\apps\0-setup\markbel-extension\`.
  - Verified quality gate: 549 tests passing across 42 suites (`npm test`), 0 TypeScript errors (`npm run typecheck`).
  - Deployed edge worker and static web assets to `https://mark.obel.workers.dev` via Cloudflare Wrangler.

### Phase 19: Cross-Client Media Resilience, Repository Media Enrichment & Database Self-Healing (v2.5.17 - 2026-11-04)
- **Slice 1 (Card Presentation Thumbnail Fallback):**
  - Integrated `extractInstantMediaMetadata` in `src/components/BookmarkCard.tsx` across both List View and Card Grid View.
  - Computes `const effectiveImage = b.image || instant.image || ''` to reliably render deterministic instant thumbnails (YouTube, GitHub OpenGraph, etc.) when `b.image` is empty.
- **Slice 2 (Repository Mutation Media Enrichment):**
  - Enhanced `BookmarkRepository.create` in `src/db/SyncRepository.ts` to enrich incoming bookmarks with instant media metadata (`image`, `title`, `siteName`, `contentType`, `description`) prior to Dexie database and outbox persistence.
- **Slice 3 (Extension Native Browser Sync Heuristics):**
  - Integrated `extractInstantMediaMetadata` into `extension/src/bookmarkSync.ts` in both `handleNativeCreated` and `importAllBrowserBookmarks` to capture instant thumbnails and titles during two-way browser sync and bulk bookmark imports.
- **Slice 4 (Self-Healing IndexedDB Repair Sweep):**
  - Implemented `repairMissingMediaThumbnails` in `src/db/db.ts` to scan active bookmarks lacking images and backfill platform thumbnails without network requests.
  - Scheduled non-blocking launch execution via `requestIdleCallback` in `src/main.tsx`.
- **Slice 5 (Release Lifecycle Protocol v2.5.17):**
  - Bumped version to `2.5.17` across all project manifests (`package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html`, `public/llms.txt`, `public/llms-full.txt`, `@markbel/mcp`).
  - Added dedicated v2.5.17 release notes in `ReleaseNotesModal.tsx` and refreshed announcement banner in `LandingTopBanner.tsx`.
  - Built and packaged extensions (`npm run build:extension:all`) and mirrored unpacked bundle to `D:\apps\0-setup\markbel-extension\`.
  - Verified quality gate: 544 tests passing across 42 suites (`npm test`), 0 TypeScript errors (`npm run typecheck`).
  - Deployed Edge Worker and fresh client assets to `https://mark.obel.workers.dev`.

### Phase 15: Offline Reader Mode, Edge Article Extraction, Universal Command Palette & Batch Move-to-Group (v2.5.14 - 2026-11-04)
- **Slice 1 (Edge Article Extraction Endpoint GET /api/article):**
  - Added `GET /api/article` in `worker/src/routes/media.ts` with SSRF URL safety validation (`isSafePublicUrl`), Cloudflare Worker L1 edge cache match, and Upstash Redis REST caching (`markbel:article:${hash}`).
  - Leverages Cheerio for serverless DOM parsing and junk element stripping (`script, style, noscript, nav, footer, header, aside, iframe, form, button, .ad, .ads, .sidebar, .cookie-banner`).
  - Extracts clean semantic HTML paragraphs and headings, detects author and publication timestamps, computes body word count and reading time (`Math.max(1, Math.ceil(words / 200))`), returning sanitized JSON payload with 7-day TTL caching.
  - Added client `api.extractArticle(url, forceRefresh)` in `src/lib/api.ts`.
- **Slice 2 (Distraction-Free Offline Reader View ReaderModal.tsx):**
  - Created `src/components/modals/ReaderModal.tsx` featuring dynamic typography controls (Sans-serif vs. Serif, font size toggles sm/base/lg/xl persisted in localStorage), real-time scroll depth progress tracking, metadata badges, on-demand edge article extraction, and action controls.
  - Integrated `useModalBackNavigation([{ isOpen, close: onClose }])` for hardware and browser back button trap.
  - Added `onOpenReader` callback and "Read Offline" action buttons (`BookOpen` icon) with estimated reading time badges across list and grid layouts in `src/components/BookmarkCard.tsx`.
- **Slice 3 (Universal Web Command Palette CommandPalette.tsx & Cmd+K):**
  - Added Cmd+K and Ctrl+K universal keyboard shortcut interceptor to `src/hooks/useBookmarkKeyboardShortcuts.ts` with modifier isolation and active input handling.
  - Created `src/components/modals/CommandPalette.tsx` featuring backdrop blur, auto-focused search bar, Quick Commands section (Add Bookmark, Trigger Sync, View Unread/Pinned/Archive, Settings, Jump to Group), and sub-millisecond bookmark ranking via `filterAndRankBookmarks`.
  - Full keyboard accessibility with ArrowUp, ArrowDown, Enter execution, and Escape closing.
- **Slice 4 (Batch Move-to-Group Operations):**
  - Extracted standalone `handleBulkMoveGroup(selectedIds, targetGroup, onSuccess)` and hook callback in `src/hooks/useBookmarkBatchOperations.ts`.
  - Updated `src/components/BookmarkBatchBar.tsx` with `FolderInput` popover dropdown menu listing available vault groups with outside-click dismiss.
  - Integrated into `src/views/BookmarksPage.tsx` with toast confirmation and background sync.
- **Slice 5 (Release Lifecycle Protocol v2.5.14):**
  - Bumped version to `2.5.14` across `package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html`, `public/llms.txt`, and `public/llms-full.txt`.
  - Updated `src/components/modals/ReleaseNotesModal.tsx` and `src/components/landing/LandingTopBanner.tsx`.
  - 517/517 unit tests passed across 39 suites, 0 TypeScript errors.
  - Hotfix (092a524): Eliminated hardcoded version fallback in `LandingFooter.tsx` by establishing `CURRENT_RELEASE_VERSION` in `src/components/landing/landingConstants.ts` as the single source of truth across `LandingTopBanner`, `LandingFooter`, and `LandingPage`. Edge assets re-deployed to Cloudflare (`e745523e...`).
  - Built extensions (`npm run build:extension:all`) and synced unpacked extension to `D:\apps\0-setup\markbel-extension\`.
  - Edge worker deployed to live runtime (`https://mark.obel.workers.dev`).

### Phase 14: Dexie URL Indexing, Hot-Path DDL Removal, Ingest Tracking Sanitization & Delta Compaction (v2.5.13 - 2026-11-04)
- **Slice 1 (Dexie Schema Migration v7 & Extension Duplicate Detection):**
  - Upgraded Dexie database schema to `version(7)` with indexed `url` column (`bookmarks: 'id, userId, url, group, isArchived, isRead, contentType, deletedAt'`).
  - Added `checkIfUrlInVault` to `extension/src/popup/popupUtils.ts` and integrated into `onSessionReady` in `extension/src/popup/popup.ts`. Sanitizes `tab.url` before querying `db.bookmarks.where('url')` with fallback to raw URL, setting `isAlreadyInVault = true` and activating quick open search mode.
  - Added unit test coverage in `src/sync/ExtensionPopup.test.ts` asserting `isAlreadyInVault` detection, sanitized matching, raw fallback, and soft-delete filtering.
- **Slice 2 (Hot-Path DDL Elimination):**
  - Deleted dynamic `CREATE INDEX IF NOT EXISTS` execution on lines 57-60 of `worker/src/routes/sync.ts`.
  - Confirmed static persistence of `idx_sync_changes_client_id`, `idx_sync_changes_user_seq`, and `idx_sync_changes_pull` in `worker/schema.sql`.
- **Slice 3 (Universal Ingest Sanitization & Tracking Parameter Cleansing):**
  - Updated `src/lib/urlSafety.ts` to automatically strip modern tracking parameters (`si`, `igsh`, `fbclid`, `gbraid`, `wbraid`, and any `utm_*` prefixes).
  - Wired URL cleansing across web modal input (`src/components/modals/AddBookmarkModal.tsx`), extension save payload builder (`extension/src/popup/popupSaveView.ts`), agent creation endpoint (`worker/src/routes/agent/bookmarks.ts`), and edge sync push handler (`worker/src/routes/sync.ts`).
  - Verified with comprehensive AAA tests in `src/lib/urlSafety.test.ts` and `src/sync/SyncBatchValidation.test.ts`.
- **Slice 4 (Unified Web Vault Search with searchCatalog.ts):**
  - Updated `filterAndRankBookmarks` in `src/lib/searchCatalog.ts` to support generic item types (`<T extends SearchBookmarkItem = SearchBookmarkItem>`) and unlimited slicing when `limit <= 0`.
  - Replaced primitive substring matching in `src/views/BookmarksPage.tsx` with `filterAndRankBookmarks(result, debouncedSearchQuery, undefined, 0)`.
  - Added tests in `src/lib/searchCatalog.test.ts` asserting `limit = 0` behavior and non-contiguous multi-word matching across fields.
- **Slice 5 (Edge Sync Delta Compaction Endpoint):**
  - Added `POST /api/sync/compact` with `authMiddleware` in `worker/src/routes/sync.ts` executing atomic deletion of superseded sequence rows: `DELETE FROM sync_changes WHERE user_id = ? AND sequence NOT IN (SELECT MAX(sequence) FROM sync_changes WHERE user_id = ? GROUP BY entity_type, entity_id)`.
- **Slice 6 (Release Lifecycle Protocol v2.5.13):**
  - Bumped version to `2.5.13` across `package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html`, `public/llms.txt`, and `public/llms-full.txt`.
  - Updated `src/components/modals/ReleaseNotesModal.tsx` and top announcement banner in `src/components/landing/LandingTopBanner.tsx`.
  - 504/504 unit tests passed (37 test suites), 0 TypeScript errors.
  - Built extensions (`npm run build:extension:all`) and synced unpacked extension to `D:\apps\0-setup\markbel-extension\`.
  - Deployed to Cloudflare Edge (`https://mark.obel.workers.dev`).

### Phase 13: Edge Agent Sub-Router Modularization & Architecture Modernization (v2.5.12 - 2026-11-04)
- Deconstructed monolithic `worker/src/routes/agent.ts` (943 lines) into modular domain sub-routers under `worker/src/routes/agent/`:
  - `worker/src/routes/agent/common.ts`: Centralized database row interfaces (`BookmarkDbRow`, `GroupDbRow`, `CountDbRow`, `UserSettingsDbRow`, `MaxSeqDbRow`) and shared utilities (`getErrorMessage`, `generateSearchSnippet`).
  - `worker/src/routes/agent/bookmarks.ts`: Modular Hono router for search (`GET /bookmarks/search`), lookup (`GET /bookmarks/:id`), creation (`POST /bookmarks`), update (`PATCH /bookmarks/:id`), deletion (`DELETE /bookmarks/:id`), and batch operations (`POST /bookmarks/batch`).
  - `worker/src/routes/agent/groups.ts`: Modular Hono router for group metrics (`GET /groups`) and smart categorization rules (`GET /rules`, `PUT /rules`).
  - `worker/src/routes/agent/settings.ts`: Modular Hono router for user preferences and workflow settings (`GET /settings`, `PATCH /settings`) with credential sandboxing.
  - `worker/src/routes/agent/stats.ts`: Modular Hono router for vault counters and sync telemetry (`GET /stats`).
  - `worker/src/routes/agent.ts`: Clean top-level orchestrator mounting public `/openapi.json`, auth middleware guard, and sub-routers.
- Enhanced test coverage in `src/sync/AgentApi.test.ts` for modular architecture and shared helpers. 494/494 unit tests passing across 37 test suites. Zero TypeScript errors.
- Version increment to `2.5.12` across manifests, schemas, docs, landing banner, and release notes modal. Cloudflare Edge deployed to live edge (`https://mark.obel.workers.dev`).

### Phase 12: Modular Bookmark Page Domain Hooks & Batch Action Bar (v2.5.11 - 2026-11-04)
- Deconstructed monolithic selection state and action bars from `src/views/BookmarksPage.tsx` into decoupled domain hooks and isolated UI components.
- Extracted `src/hooks/useBookmarkBatchOperations.ts`:
  - Encapsulates multiselect state (`selectedIds`, `isSelectionMode`, `selectedCount`).
  - Implemented transactional bulk operations (`handleBulkDelete`, `handleBulkArchive`, `handleBulkToggleRead`) leveraging `bookmarkRepository` and `syncManager.sync(true)`.
  - Added pure selection helpers (`toggleSelection`, `selectAll`, `computeBulkToggleReadState`) with zero UI coupling.
- Created `src/components/BookmarkBatchBar.tsx`:
  - Floating selection action bar replacing inline batch bar with WCAG contrast, clean SVG Lucide icons, and accessible toolbar semantics.
- Created `src/hooks/useBookmarkKeyboardShortcuts.ts`:
  - Power-user shortcut manager for `/` (search focus), `n` (add modal), `Escape` (clear selection or blur), `x` (toggle select item), and `d` (archive focused or selected).
  - Robust defensive guards against input/textarea/select/contentEditable active elements, modifier keys, and active modal overlays.
- Authored 23 unit tests in `src/views/BookmarksPageHooks.test.ts`. 491/491 tests passing across 37 suites. Zero TypeScript errors.
- Version increment to `2.5.11` across manifests, schemas, docs, and landing page banner. Edge worker deployed to Cloudflare (`https://mark.obel.workers.dev`).

### Phase 4: Full Vault Collaboration & Actor Attribution (2026-11-03)
- Created `vault_collaborators` table in D1 schema (`id`, `owner_id`, `collaborator_user_id`, `collaborator_email`, `role`, `status`, `invite_token`, `created_at`, `accepted_at`) and migrated remote database.
- Added `actor_type` (`'user' | 'agent' | 'collaborator'`) and `actor_name` columns to `bookmarks` and `sync_changes` for complete audit attribution.
- Implemented collaboration REST endpoints under `/api/agent/v1/collaborators`:
  - `GET /collaborators`: list active and pending vault collaborators.
  - `POST /collaborators`: invite collaborator with role (`viewer` vs `editor`) and CSPRNG invite token (`mb_inv_...`).
  - `DELETE /collaborators/:id`: revoke/remove collaborator access.
  - `POST /collaborators/accept`: link user account to pending invite.
  - `GET /collaborators/shared-vaults`: list peer vaults shared with authenticated user.
- Enforced role-based access control with `requireVaultRole`: viewers can search/inspect; editors can mutate/categorize; owner preserves settings and permission controls.
- Extended `@markbel/mcp` package to 14 official tools with `markbel_list_collaborators` and `markbel_invite_collaborator`.
- Built "Vault Collaboration & Shared Access" studio card and modal workflows in `src/views/SettingsPage.tsx`.
- Updated client SDK in `src/lib/api.ts` with typed collaboration interfaces.
- Authored 8 unit tests in `src/sync/Collaborators.test.ts`. 308/308 tests passing across 25 test suites. Zero TypeScript errors. Deployed to Cloudflare Edge (`605573e3-6ac6-4abb-b69b-3e1e991bde8b`).

### Phase 3: Official In-Tree Markbel MCP Server Package (@markbel/mcp) (2026-11-03)
- Implemented official `@markbel/mcp` package under `packages/mcp/` supporting both standard I/O (`stdio`, default for Claude Desktop, Cursor, Antigravity) and Server-Sent Events (`--sse` / `PORT`) transports.
- Built typed edge client in `packages/mcp/src/client.ts` consuming `/api/agent/v1/*` with Personal Access Token (`mb_pat_...`) authentication and structured error handling.
- Registered 12 MCP tools across 4 functional domains:
  - Search & Inspection: `markbel_search`, `markbel_get_bookmark`, `markbel_get_stats`
  - Mutations & Organization: `markbel_create_bookmark`, `markbel_update_bookmark`, `markbel_delete_bookmark`, `markbel_batch_mutate`
  - Smart Categorization & Taxonomy: `markbel_list_groups`, `markbel_get_rules`, `markbel_set_rule`
  - Preferences & Sandbox: `markbel_get_settings`, `markbel_update_settings`
- Added comprehensive developer documentation and client setup guides (Claude Desktop, Cursor, Antigravity) in `packages/mcp/README.md`.
- Added `"build:mcp"` build pipeline script to root `package.json`.
- Authored 9 unit/mock tests in `packages/mcp/test/tools.test.ts` and 14 schema and integration tests in `src/sync/McpPackage.test.ts`.
- Verified quality gate: 298/298 tests passing across 24 test suites. Zero TypeScript errors.

### Phase 2: Edge Agent REST API & Sync Audit Logging (2026-11-03)
- Implemented `/api/agent/v1/*` Hono router on Cloudflare Workers protected by `authMiddleware` and scoped RBAC.
- Built hybrid bookmark search (`GET /api/agent/v1/bookmarks/search`) with multi-attribute relevance ranking, pagination, and token-efficient `include_content: false` payload trimming.
- Added full bookmark CRUD with edge media extraction, smart auto-grouping, and atomic D1 batch logging to `sync_changes` (`client_change_id: 'agent_<uuid>'`).
- Implemented atomic batch mutations endpoint (`POST /api/agent/v1/bookmarks/batch`).
- Added smart categorization rule endpoints (`GET`/`PUT /api/agent/v1/rules`) and workflow settings (`GET`/`PATCH /api/agent/v1/settings`) with strict master credential sandboxing.
- Created `user_settings` table in D1 schema and migrated live remote database.
- Implemented complete OpenAPI 3.1.0 specification at `GET /api/agent/v1/openapi.json`.
- Added TypeScript client types and methods in `src/lib/api.ts`.
- Authored 22 unit tests in `src/sync/AgentApi.test.ts`. 275/275 tests passing across 22 test suites. Zero TypeScript errors.

### Phase 1: Security & Personal Access Tokens (PATs) for Agentic Access (2026-11-03)
- Implemented `api_tokens` D1 schema table with indexes for SHA-256 token hashes and user lookups.
- Upgraded Cloudflare Worker `authMiddleware` to seamlessly handle both human user JWTs and `mb_pat_...` Personal Access Tokens with Web Crypto SHA-256 verification and `last_used_at` tracking.
- Added `requireScope` middleware enforcing granular RBAC scopes (`bookmarks:read`, `bookmarks:write`, `groups:manage`, `shares:manage`, `settings:manage`).
- Implemented REST token management endpoints (`POST /api/tokens`, `GET /api/tokens`, `DELETE /api/tokens/:id`).
- Created "API & Agent Access Tokens" management interface in `SettingsPage.tsx` with modal dialogs for token creation, scope selection, one-time reveal, and immediate revocation.
- Authored 17 unit tests in `src/sync/ApiTokens.test.ts`. 253/253 tests passing across 21 test suites. Zero TypeScript errors.

### Initial State & Archiver Architecture
- Engineered universal media archiver and scraper resilience engine.
- Implemented Neon Postgres DDL schema migrations with zero-CLS image loading.
- Verified test suite and standalone responsive HTML slides.

### Phase 9: CI Workflows & Monorepo Package Resolution (2026-11-03)
- Configured npm workspaces (`"workspaces": ["packages/*"]`) in root `package.json` and hoisted `@modelcontextprotocol/sdk` to root dependencies.
- Corrected Zod v4 signature requirement in `packages/mcp/src/tools/settings.ts` (`z.record(z.string(), z.unknown())`).
- Unified Zod dependency across root and `packages/mcp` to `^4.6.5`.
- Scoped `packages/mcp/tsconfig.json` to `"types": ["node"]` preventing monorepo `@types` recursive crawling and heap exhaustion during CI compilation.
- Added `npm run build:mcp` step to `.github/workflows/ci.yml` and `.github/workflows/build-android.yml`.
- Verified 100% passing tests (35 test suites, 418 unit tests) and 0 TypeScript errors locally.
- Verified successful completion of GitHub Actions runs: CI (Run 41698692120) and Android APK Build & Release (Run 41698692059).
- Deployed updated frontend and edge worker triggers to Cloudflare Edge (`https://mark.obel.workers.dev`, Version `44c3658d-c466-449a-91ad-a0c9ef481bb9`).

### Phase 10: Unified Web & App Routing Architecture (2026-11-04)
- Implemented bi-directional URL query state reflection (`?group=...`, `?tab=...`, `?q=...`) in `src/views/BookmarksPage.tsx` using `useSearchParams`. Group and tab selections push history entries; search query typing uses debounced history replacement to prevent history pollution while supporting native browser Back/Forward navigation.
- Nested application subroutes under `/app` (`/app/archive`, `/app/settings`, `/app/sync-debug`, `/app/*`) in `src/App.tsx`.
- Retained backwards-compatible legacy redirect aliases (`/archive` -> `/app/archive`, `/settings` -> `/app/settings`, `/sync-debug` -> `/app/sync-debug`) ensuring existing browser bookmarks, external links, and extension shortcuts resolve seamlessly.
- Updated `src/components/GroupSidebar.tsx` navigation actions to route directly to nested `/app/*` endpoints.
- Added returning user contextual awareness across `LandingPage.tsx`, `HeroSection.tsx`, and `LandingNavbar.tsx`, displaying dynamic "Resume Vault" actions for returning visitors.
- Expanded `src/views/RouteArchitecture.test.ts` to 35 comprehensive tests covering query state serialization/deserialization, nested subroute resolution, legacy aliases, and returning user contracts. All 434 tests passed.
- Packaged fresh Chromium (`markbel-extension.zip`) and Firefox (`markbel-firefox-extension.zip`) extensions, synced unpacked build to `D:\apps\0-setup\markbel-extension\`.
- Deployed live frontend and edge worker to Cloudflare Edge (`https://mark.obel.workers.dev`, Version ID `fe41c6a0-f54d-49b2-8b0b-0baa7cb0e4dc`).

### Phase 11: Modular Extension Popup HUD Controller & Subsystem Tests (2026-11-04)
- Deconstructed monolithic 823-line procedural controller (`extension/src/popup/popup.ts`) into clean, single-responsibility modules under `extension/src/popup/`:
  - `popupUtils.ts`: HTML escaping (`escapeHtml`), view switching (`showView('auth' | 'save' | 'search' | 'success')`), Firefox MV3 host permission checks and warning banner management, status feedback, and restricted browser URL validation (`isRestrictedBrowserUrl`).
  - `popupAuth.ts`: Session verification (`verifyAndSyncSession`), credential validation (`validateLoginCredentials`), login form submission handling, and active web vault tab session synchronization (`syncSessionFromActiveVaultTab`).
  - `popupSaveView.ts`: Active tab metadata inspection, media heuristics integration, target shared vault selector (`listSharedVaults`), reminder date ISO formatting (`formatReminderDate`), and bookmark save mutation execution.
  - `popupSearchView.ts`: 0ms local Dexie search, dynamic group filter chip rendering, results list rendering with domain sanitization (`formatDomain`), and keyboard navigation with boundary and wrapping checks (`getNextSearchIndex`, `getPrevSearchIndex`).
  - `popup.ts`: Slim, top-level orchestrator (76 lines) wiring DOM event listeners, global `Tab` mode switching (`Save Tab` vs `Quick Open`), and bootstrapping modules.
- Authored 34 unit tests in `src/sync/ExtensionPopup.test.ts` covering mode switching state transitions, restricted internal URL detection (`chrome://`, `edge://`, `about:`, `moz-extension://`), search filtering and ranking, keyboard navigation index wrapping/clamping boundaries, and bookmark payload generation with smart grouping fallbacks.
- Verified quality gates: 36 test suites, 468 unit tests passing (100% green). Zero TypeScript errors (`npm run typecheck`).
- Version bumped across the system to `2.5.10` (`package.json`, manifests, `index.html`, `llms.txt`, `llms-full.txt`, and release notes).
- Packaged fresh Chromium (`markbel-extension.zip`) and Firefox (`markbel-firefox-extension.zip`) bundles, synced unpacked extension to `D:\apps\0-setup\markbel-extension\`.
- Deployed frontend and edge worker triggers to Cloudflare Edge (`https://mark.obel.workers.dev`, Version ID `e6f61152-292c-4c5d-9f7d-d28f46c37d34`).



### Phase 27: 60 FPS Scroll Virtualization, In-HUD Alt+O 'n' Key Creation & Universal Media Fix (2026-11-05)
- Fixed virtualizer `scrollMargin: 160` on both grid and list virtualizers in `src/views/BookmarksPage.tsx` to offset `BookmarkFilterBar` height and prevent row clipping/jumping.
- Removed `ref={gridVirtualizer.measureElement}` from grid rows and pinned `estimateSize: () => 320` (grid) and `() => 72` (list) with `overscan: 4`, completely eliminating the `ResizeObserver` thrashing loop during asynchronous thumbnail loading.
- Implemented in-memory hot cache (`memoryBlobCache = new Map<string, string>()`) in `src/components/BookmarkImage.tsx` returning cached blob URLs synchronously without IndexedDB round-trips during fast scrolling.
- Throttled thumbnail background capture through bounded `requestIdleCallback` (fallback 250ms delay) with max 2 concurrent downloads (`MAX_CONCURRENT_CAPTURES = 2`).
- Added CSS `contain: content;` to `.studio-card` in `src/index.css` to enable GPU layer composition.
- Memoized bookmark card properties in `src/components/BookmarkCard.tsx` (`useMemo`).
- Added global window keyboard listener for `'n'` / `'N'` to trigger new bookmark creation directly from the main vault view.
- Overhauled `extension/src/spotlight/MarkbelSpotlight.ts` with a state machine (`currentView: 'search' | 'new-bookmark'`).
  - Added `'n'` / `'N'` hotkey in search view to transition to bookmark creation when search query is empty.
  - Added `[+ New (n)]` button in header bar.
  - Added `[+ Save Current Page as New Bookmark]` quick action at index 0 when typing query.
  - Embedded New Bookmark card HUD with Title, URL, Group chips (all 8 pillars: `Anime`, `Dev`, `Music`, `Deen`, `Insta`, `Tools`, `Design`, `System`, `Unsorted`) with smart auto-detection, Notes textarea, Pin toggle, Save (`Enter`), and Cancel (`Esc`).
  - Added `MARKBEL_SAVE_BOOKMARK` message listener in `extension/src/background.ts`.
  - Added header Sort Selector (`Newest First`, `Oldest First`, `Title A-Z`, `Episodic Order`) persisted in `chrome.storage.local`.
- Implemented `safeParseTimestamp(createdAt)` and 5-tier deterministic sorting in `src/lib/searchCatalog.ts`.
- Removed `video.vid3rb.com/video/` false positive from `isVideoStreamUrl()` in `src/lib/mediaHeuristics.ts`.
- Added Anime3rb JSON-LD `partOfSeries.image` and DOM poster extraction in `extension/src/metadata/extractPageMetadata.ts` and `worker/src/lib/metadataScraper.ts`.
- Bumped version to `2.8.0` across all manifests, HTML, release notes, and documentation.
- Generated fresh Chromium and Firefox extension packages and synced unpacked mirror to `D:\apps\0-setup\markbel-extension\`.
- Deployed frontend and edge worker triggers to Cloudflare Edge (`https://mark.obel.workers.dev`, Version ID `dcb44fe8-6daa-4ec0-b72e-65c39a461b36`).
- Verified 100% test coverage: 47 test suites, 649 unit tests passed; 0 TypeScript compilation errors.

### Phase 28: Keyboard Event Isolation & Host Page Keystroke Containment (2026-11-05)
- Implemented airtight keyboard event containment in `extension/src/spotlight/MarkbelSpotlight.ts`:
  - Added public `isOpen(): boolean { return this.isVisible; }` method.
  - Added unconditional `event.stopPropagation()` at the very top of `this.shadow.addEventListener('keydown', ...)` ensuring keystrokes typed inside Spotlight ('m', 'k', 'f', 'j', 'l', 'c', space, digits) never bubble into the host DOM.
  - Added `keyup` and `keypress` listeners on `this.shadow` invoking `event.stopPropagation()`.
  - Added `keydown`, `keyup`, and `keypress` containment listeners on `this.host` (`<markbel-spotlight-host>`).
- Implemented window capture-phase keyboard interception in `extension/src/content.ts`:
  - Added `window.addEventListener('keydown', ..., true)` and `window.addEventListener('keyup', ..., true)` capture listeners.
  - Intercepted events where `spotlight.isOpen()` is true and `e.composedPath()` contains `markbel-spotlight-host`, invoking `e.stopImmediatePropagation()` to defeat aggressive host SPA keydown capturing handlers (e.g. YouTube video shortcuts).
- Authored 5 new unit tests in `src/sync/ExtensionSpotlight.test.ts` verifying visibility state, stopPropagation invocation, host element containment, zero leakage to window/document, and capture-phase stopImmediatePropagation execution.
- Bumped version to `2.8.1` across `package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html`, `public/llms.txt`, `public/llms-full.txt`, and `src/components/landing/landingConstants.ts`.
- Updated `src/components/modals/ReleaseNotesModal.tsx` and `src/components/landing/LandingTopBanner.tsx`.
- Packaged fresh Chromium (`markbel-extension.zip`) and Firefox (`markbel-firefox-extension.zip`) extensions, and mirrored unpacked build to `D:\apps\0-setup\markbel-extension\`.
- Deployed frontend and Cloudflare Edge worker (`https://mark.obel.workers.dev`, Version ID `c4e375af-03d4-4dd2-b9cf-8de2543860e0`).
- Quality gate passed: 47 test suites, 654 unit tests passing, 0 TypeScript errors.
