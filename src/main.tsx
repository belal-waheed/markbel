import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import './index.css'
import { initializeNotifications } from './notifications/init.js'
import { repairMissingMediaThumbnails } from './db/db.js'

// Initialize local background services
initializeNotifications();

// Self-heal media thumbnails for existing bookmarks on application launch
if (typeof window !== 'undefined') {
  const runMediaRepair = () => {
    repairMissingMediaThumbnails().catch(() => {});
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

// Automatically prune legacy bloated Workbox caches with opaque responses
if (typeof caches !== 'undefined') {
  caches.keys().then((names) => {
    for (const name of names) {
      if (
        name === 'general-image-cache' ||
        name === 'external-thumbnail-cache' ||
        name === 'image-proxy-cache'
      ) {
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
