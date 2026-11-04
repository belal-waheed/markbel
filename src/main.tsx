import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import './index.css'
import { initializeNotifications } from './notifications/init.js'
import { repairMissingMediaThumbnails, repairAndEnrichBookmarkThumbnails } from './db/db.js'

// Initialize local background services
initializeNotifications();

// Self-heal media thumbnails for existing bookmarks on application launch
if (typeof window !== 'undefined') {
  const runMediaRepair = () => {
    repairMissingMediaThumbnails().catch(() => {});
    repairAndEnrichBookmarkThumbnails().catch(() => {});
  };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(runMediaRepair);
  } else {
    setTimeout(runMediaRepair, 1000);
  }
}

// Request persistent storage quota to prevent browser evicting IndexedDB under storage pressure
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

// Automatically prune obsolete or bloated caches with opaque response padding
if (typeof caches !== 'undefined') {
  const WHITELIST = new Set([
    'pages-cache',
    'external-thumb-v2',
    'image-proxy-v2',
    'general-image-v2',
  ]);

  caches.keys().then((names) => {
    for (const name of names) {
      const isPrecache = name.startsWith('workbox-precache');
      const isWhitelisted = WHITELIST.has(name) || isPrecache;
      const isLegacyRuntime = name === 'workbox-runtime' || name.startsWith('workbox-runtime-');

      if (!isWhitelisted || isLegacyRuntime) {
        caches.delete(name).catch(() => {});
      }
    }
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
