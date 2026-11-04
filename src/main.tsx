import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import './index.css'
import { initializeNotifications } from './notifications/init.js'

// Initialize local background services
initializeNotifications();

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
