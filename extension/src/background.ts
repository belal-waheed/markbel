/**
 * Markbel Extension - Background Service Worker (Manifest V3)
 * Handles context menus, keyboard shortcuts, and badge notifications.
 */

import { saveBookmark, getSession } from './api';
import { resolveSmartGroup } from '@/lib/smartGroups';
import type { ExtractedPageMetadata } from './content';

// Setup context menus on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'markbel-save-page',
    title: 'Save Page to Markbel',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'markbel-save-link',
    title: 'Save Link to Markbel',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'markbel-save-selection',
    title: 'Save Quote / Selection to Markbel',
    contexts: ['selection']
  });
});

/**
 * Visual badge notification on extension toolbar icon
 */
function showBadge(text: string, color = '#00f0ff'): void {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });

  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 2500);
}

/**
 * Extract active tab metadata using content script with dynamic injection fallback
 */
async function getTabMetadata(tabId: number): Promise<ExtractedPageMetadata | null> {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'MARKBEL_EXTRACT_METADATA' });
    if (res && res.success && res.data) {
      return res.data;
    }
  } catch {
    // If content script was not injected on that tab, try executing it dynamically
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      const retryRes = await chrome.tabs.sendMessage(tabId, { type: 'MARKBEL_EXTRACT_METADATA' });
      if (retryRes && retryRes.success && retryRes.data) {
        return retryRes.data;
      }
    } catch (err) {
      console.warn('[Markbel Background] Script injection fallback failed:', err);
    }
  }
  return null;
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const session = await getSession();
  if (!session.isAuthenticated) {
    showBadge('AUTH', '#ff0055');
    chrome.runtime.openOptionsPage();
    return;
  }

  try {
    let url = tab ? tab.url || '' : '';
    let title = tab ? tab.title || '' : '';
    let description = '';
    let image = '';
    let favicon = tab ? tab.favIconUrl || '' : '';

    if (info.menuItemId === 'markbel-save-link' && info.linkUrl) {
      url = info.linkUrl;
      title = url;
    } else if (info.menuItemId === 'markbel-save-selection' && info.selectionText) {
      description = info.selectionText;
    }

    if (tab && tab.id && (!description || !image)) {
      const liveMeta = await getTabMetadata(tab.id);
      if (liveMeta) {
        if (info.menuItemId !== 'markbel-save-link') {
          url = liveMeta.url || url;
          title = liveMeta.title || title;
        }
        description = description || liveMeta.description || '';
        image = liveMeta.image || '';
        favicon = liveMeta.favicon || favicon;
      }
    }

    const group = resolveSmartGroup(url);

    await saveBookmark({
      url,
      title: title || url,
      description,
      image,
      favicon,
      group
    });

    showBadge('SAVED', '#00ff88');
  } catch (err) {
    console.error('[Markbel Background] Context menu save error:', err);
    showBadge('ERR', '#ff0055');
  }
});

/**
 * Handle global keyboard shortcut commands (Alt+Shift+S)
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-current-tab') {
    const session = await getSession();
    if (!session.isAuthenticated) {
      showBadge('AUTH', '#ff0055');
      chrome.runtime.openOptionsPage();
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      showBadge('SKIP', '#888888');
      return;
    }

    try {
      let url = tab.url;
      let title = tab.title || '';
      let description = '';
      let image = '';
      let favicon = tab.favIconUrl || '';

      if (tab.id) {
        const liveMeta = await getTabMetadata(tab.id);
        if (liveMeta) {
          url = liveMeta.url || url;
          title = liveMeta.title || title;
          description = liveMeta.description || '';
          image = liveMeta.image || '';
          favicon = liveMeta.favicon || favicon;
        }
      }

      const group = resolveSmartGroup(url);

      await saveBookmark({
        url,
        title: title || url,
        description,
        image,
        favicon,
        group
      });

      showBadge('SAVED', '#00ff88');
    } catch (err) {
      console.error('[Markbel Background] Shortcut save error:', err);
      showBadge('ERR', '#ff0055');
    }
  }
});
