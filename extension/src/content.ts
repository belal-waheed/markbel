/**
 * Markbel Extension - In-DOM Metadata Extractor & Spotlight Command Palette (Content Script)
 * Entrypoint registering Alt+O keyboard shortcut and background message dispatchers.
 */

import { extractPageMetadata, type ExtractedPageMetadata } from './metadata/extractPageMetadata';
import { MarkbelSpotlight } from './spotlight/MarkbelSpotlight';
import { filterAndRankBookmarks, type SearchBookmarkItem } from '@/lib/searchCatalog';

export { extractPageMetadata, type ExtractedPageMetadata };
export { MarkbelSpotlight };
export { filterAndRankBookmarks, type SearchBookmarkItem };

// Initialize Spotlight instance
const spotlight = new MarkbelSpotlight();

// Global Alt+O shortcut for Spotlight launcher
window.addEventListener(
  'keydown',
  (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'o' || e.key === 'O' || e.code === 'KeyO')) {
      e.preventDefault();
      e.stopPropagation();
      spotlight.toggle();
    }
  },
  true
);

// Chrome runtime message listeners
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return;

  if (message.type === 'GET_PAGE_METADATA' || message.type === 'MARKBEL_EXTRACT_METADATA') {
    try {
      const data = extractPageMetadata();
      sendResponse({ success: true, data });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Extraction failed' });
    }
    return true;
  }

  if (message.type === 'OPEN_SPOTLIGHT') {
    spotlight.show();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'TOGGLE_SPOTLIGHT' || message.type === 'MARKBEL_TOGGLE_SPOTLIGHT') {
    spotlight.toggle();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'UPDATE_SEARCH_CATALOG' || message.type === 'MARKBEL_CATALOG_UPDATED') {
    spotlight.refreshCatalog();
    sendResponse({ success: true });
    return true;
  }

  return true;
});
