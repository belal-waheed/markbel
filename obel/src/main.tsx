import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { polyfill } from 'mobile-drag-drop'
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour'
import 'mobile-drag-drop/default.css'

// Initialize mobile drag and drop polyfill
polyfill({
  dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride
})

import App from './App'
import { scrubLocalStorage } from './lib/storage'

// Clean any legacy localStorage keys on startup
scrubLocalStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
