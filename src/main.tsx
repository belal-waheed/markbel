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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
