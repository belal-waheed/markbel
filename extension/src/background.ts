/**
 * Markbel Extension - Background Service Worker (Manifest V3)
 * Handles context menus, keyboard shortcuts, and badge notifications.
 */

import { saveBookmark, getSession } from './api';
import { resolveSmartGroup, getCustomSmartGroupRules } from '@/lib/smartGroups';
import { extractInstantMediaMetadata } from '@/lib/mediaHeuristics';
import type { ExtractedPageMetadata } from './content';
import { syncManager } from '@/db/SyncManager';
import { db } from '@/db/db';

function broadcastCatalogUpdated(): void {
  chrome.tabs.query({}).then((tabs) => {
    for (const t of tabs) {
      if (t.id) {
        chrome.tabs.sendMessage(t.id, { type: 'MARKBEL_CATALOG_UPDATED' }).catch(() => {});
      }
    }
  }).catch(() => {});
}

// Initialize sync engine for background syncing
syncManager.sync(true).then(() => {
  broadcastCatalogUpdated();
}).catch(() => {});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SYNC_OUTBOX') {
    syncManager.sync(true).then(() => {
      broadcastCatalogUpdated();
    }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'MARKBEL_GET_SEARCH_CATALOG') {
    db.bookmarks
      .filter((b) => !b.deletedAt)
      .toArray()
      .then((bookmarks) => {
        const catalog = bookmarks.map((b) => ({
          id: b.id,
          title: b.title || b.url,
          url: b.url,
          description: b.description || '',
          group: b.group || 'Unsorted',
          favicon: b.favicon || '',
          image: b.image || '',
          isPinned: !!b.isPinned,
          createdAt: b.createdAt || '',
        }));
        sendResponse({ success: true, catalog });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err?.message || 'Database error' });
      });
    return true;
  }

  if (message.type === 'MARKBEL_OPEN_TAB') {
    chrome.tabs.create({ url: message.url, active: message.active ?? true }).then(() => {
      sendResponse({ success: true });
    }).catch((err) => {
      sendResponse({ success: false, error: err?.message });
    });
    return true;
  }

  if (message.type === 'MARKBEL_NAVIGATE_TAB') {
    const targetTabId = (sender.tab && sender.tab.id) || undefined;
    if (targetTabId) {
      chrome.tabs.update(targetTabId, { url: message.url }).then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        sendResponse({ success: false, error: err?.message });
      });
    } else {
      chrome.tabs.update({ url: message.url }).then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        sendResponse({ success: false, error: err?.message });
      });
    }
    return true;
  }

  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync-alarm') {
    syncManager.sync(true).then(() => {
      broadcastCatalogUpdated();
    }).catch(() => {});
  }
});

// Setup context menus on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('sync-alarm', { periodInMinutes: 5 });
  
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

    let contentType: string | undefined = undefined;

    if (info.menuItemId !== 'markbel-save-link' && tab && tab.id && (!description || !image)) {
      const liveMeta = await getTabMetadata(tab.id);
      if (liveMeta) {
        if (info.menuItemId !== 'markbel-save-link') {
          url = liveMeta.url || url;
          title = liveMeta.title || title;
        }
        description = description || liveMeta.description || '';
        image = liveMeta.image || '';
        favicon = liveMeta.favicon || favicon;
        contentType = liveMeta.contentType || contentType;
      }
    }

    // Apply instant media heuristics fallback when image is missing or when saving a link
    if (url && (!image || !title || title === url || !contentType)) {
      const instant = extractInstantMediaMetadata(url);
      if (instant.image && !image) image = instant.image;
      if (instant.title && (!title || title === url)) title = instant.title;
      if (instant.description && !description) description = instant.description;
      if (instant.contentType && !contentType) contentType = instant.contentType;
    }

    const customRules = await getCustomSmartGroupRules();
    const group = resolveSmartGroup(url, [], customRules);

    await saveBookmark({
      url,
      title: title || url,
      description,
      image,
      favicon,
      group,
      contentType
    });

    broadcastCatalogUpdated();
    showBadge('SAVED', '#00ff88');
  } catch (err) {
    console.error('[Markbel Background] Context menu save error:', err);
    showBadge('ERR', '#ff0055');
  }
});

/**
 * Handle global keyboard shortcut commands (Alt+Shift+S, Alt+O)
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-spotlight') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (
      !tab ||
      !tab.id ||
      !tab.url ||
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:') ||
      tab.url.startsWith('moz-extension://')
    ) {
      if (chrome.action && chrome.action.openPopup) {
        chrome.action.openPopup().catch(() => {});
      }
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'MARKBEL_TOGGLE_SPOTLIGHT' }).catch(async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          files: ['content.js']
        });
        chrome.tabs.sendMessage(tab.id!, { type: 'MARKBEL_TOGGLE_SPOTLIGHT' });
      } catch {
        if (chrome.action && chrome.action.openPopup) {
          chrome.action.openPopup().catch(() => {});
        }
      }
    });
    return;
  }

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
      let contentType: string | undefined = undefined;

      if (tab.id) {
        const liveMeta = await getTabMetadata(tab.id);
        if (liveMeta) {
          url = liveMeta.url || url;
          title = liveMeta.title || title;
          description = liveMeta.description || '';
          image = liveMeta.image || '';
          favicon = liveMeta.favicon || favicon;
          contentType = liveMeta.contentType || contentType;
        }
      }

      // Apply instant media heuristics fallback when image is missing or title is bare URL
      if (url && (!image || !title || title === url || !contentType)) {
        const instant = extractInstantMediaMetadata(url);
        if (instant.image && !image) image = instant.image;
        if (instant.title && (!title || title === url)) title = instant.title;
        if (instant.description && !description) description = instant.description;
        if (instant.contentType && !contentType) contentType = instant.contentType;
      }

      const customRules = await getCustomSmartGroupRules();
      const group = resolveSmartGroup(url, [], customRules);

      await saveBookmark({
        url,
        title: title || url,
        description,
        image,
        favicon,
        group,
        contentType
      });

      broadcastCatalogUpdated();
      showBadge('SAVED', '#00ff88');

      if (chrome.notifications && chrome.notifications.create) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'Saved to Markbel',
          message: `${title || url} (${group})`,
          priority: 1,
        });
      }
    } catch (err) {
      console.error('[Markbel Background] Shortcut save error:', err);
      showBadge('ERR', '#ff0055');
    }
  }
});

