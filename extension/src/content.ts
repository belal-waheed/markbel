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
export { spotlight };

/**
 * In-Page Toast Notification Subsystem
 * Lightweight, CSP-compliant, zero-dependency feedback on shortcut save.
 */
export function showMarkbelToast(title: string, message: string, group?: string) {
  if (typeof document === 'undefined') return;

  const doc = document;
  let container = doc.getElementById('markbel-toast-container');
  if (!container) {
    container = doc.createElement('div');
    container.id = 'markbel-toast-container';
    container.style.cssText = [
      'position: fixed',
      'top: 20px',
      'right: 20px',
      'z-index: 2147483647',
      'display: flex',
      'flex-direction: column',
      'gap: 8px',
      'pointer-events: none',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    ].join('; ');
    (doc.body || doc.documentElement).appendChild(container);
  }

  const toast = doc.createElement('div');
  toast.className = 'markbel-shortcut-toast';
  toast.style.cssText = [
    'pointer-events: auto',
    'display: flex',
    'align-items: center',
    'gap: 10px',
    'background: #0d1117',
    'color: #f0f6fc',
    'border: 1px solid rgba(255, 255, 255, 0.15)',
    'border-radius: 10px',
    'padding: 10px 14px',
    'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6)',
    'max-width: 360px',
    'min-width: 240px',
    'box-sizing: border-box',
    'cursor: pointer',
    'opacity: 0',
    'transform: translateY(-8px) scale(0.96)',
    'transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
  ].join('; ');

  // Icon: cyan circle with SVG checkmark
  const iconWrapper = doc.createElement('div');
  iconWrapper.style.cssText = [
    'width: 24px',
    'height: 24px',
    'border-radius: 50%',
    'background: rgba(0, 229, 255, 0.15)',
    'border: 1px solid rgba(0, 229, 255, 0.4)',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'flex-shrink: 0',
  ].join('; ');
  iconWrapper.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;

  // Content wrapper
  const contentWrapper = doc.createElement('div');
  contentWrapper.style.cssText = [
    'display: flex',
    'flex-direction: column',
    'min-width: 0',
    'flex: 1',
  ].join('; ');

  // Header row (title + group badge)
  const headerRow = doc.createElement('div');
  headerRow.style.cssText = [
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    'gap: 8px',
    'margin-bottom: 2px',
  ].join('; ');

  const titleEl = doc.createElement('span');
  titleEl.style.cssText = [
    'font-size: 13px',
    'font-weight: 700',
    'color: #ffffff',
    'line-height: 1.2',
  ].join('; ');
  titleEl.textContent = title || 'Saved to Markbel';
  headerRow.appendChild(titleEl);

  if (group) {
    const badgeEl = doc.createElement('span');
    badgeEl.style.cssText = [
      'font-size: 10px',
      'font-weight: 600',
      'color: #00e5ff',
      'background: rgba(0, 229, 255, 0.12)',
      'border: 1px solid rgba(0, 229, 255, 0.25)',
      'border-radius: 4px',
      'padding: 1px 6px',
      'white-space: nowrap',
    ].join('; ');
    badgeEl.textContent = group;
    headerRow.appendChild(badgeEl);
  }

  const msgEl = doc.createElement('span');
  msgEl.style.cssText = [
    'font-size: 12px',
    'color: #8b949e',
    'line-height: 1.3',
    'overflow: hidden',
    'text-overflow: ellipsis',
    'white-space: nowrap',
  ].join('; ');
  msgEl.textContent = message || '';

  contentWrapper.appendChild(headerRow);
  contentWrapper.appendChild(msgEl);

  toast.appendChild(iconWrapper);
  toast.appendChild(contentWrapper);
  container.appendChild(toast);

  // Trigger smooth enter transition
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0) scale(1)';
    });
  } else {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  }

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px) scale(0.96)';
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
      if (container && container.childNodes.length === 0 && container.parentElement) {
        container.parentElement.removeChild(container);
      }
    }, 200);
  };

  toast.addEventListener('click', dismiss);
  setTimeout(dismiss, 2200);

  return toast;
}

// Initialize Spotlight instance
let spotlight: MarkbelSpotlight | null = null;
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  spotlight = new MarkbelSpotlight();

  // Host page keyboard capture isolation: intercept and stop host page capturing
  // listeners from hijacking keystrokes originating inside Markbel Spotlight
  window.addEventListener(
    'keydown',
    (e) => {
      if (spotlight && spotlight.isOpen()) {
        const path = e.composedPath ? e.composedPath() : [];
        const isInside = path.some(
          (el) => el instanceof HTMLElement && el.tagName?.toLowerCase() === 'markbel-spotlight-host'
        );
        if (isInside) {
          e.stopImmediatePropagation();
          spotlight.handleKeyDown(e);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          spotlight.hide();
        }
      }
    },
    true // capture phase
  );
  window.addEventListener(
    'keyup',
    (e) => {
      if (spotlight && spotlight.isOpen()) {
        const path = e.composedPath ? e.composedPath() : [];
        const isInside = path.some(
          (el) => el instanceof HTMLElement && el.tagName?.toLowerCase() === 'markbel-spotlight-host'
        );
        if (isInside) {
          e.stopImmediatePropagation();
        }
      }
    },
    true // capture phase
  );

  // Global Alt+O shortcut for Spotlight launcher
  let lastAltOTime = 0;
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'o' || e.key === 'O' || e.code === 'KeyO')) {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastAltOTime < 250) return;
        lastAltOTime = now;
        spotlight?.toggle();
      }
    },
    true
  );
}

// Chrome runtime message listeners
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
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
      spotlight?.show();
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'TOGGLE_SPOTLIGHT' || message.type === 'MARKBEL_TOGGLE_SPOTLIGHT') {
      spotlight?.toggle();
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'UPDATE_SEARCH_CATALOG' || message.type === 'MARKBEL_CATALOG_UPDATED') {
      spotlight?.refreshCatalog();
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'MARKBEL_SHOW_TOAST') {
      showMarkbelToast(message.title, message.message, message.group);
      sendResponse({ success: true });
      return true;
    }

    return true;
  });
}
