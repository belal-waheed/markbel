/**
 * Markbel Extension - Popup HUD Orchestrator
 * High-performance dual-mode HUD (Save Tab & Quick Open).
 */

import {
  showView,
  setupHostPermissionHandler,
  checkAndRenderHostPermissionBanner,
  resolveInitialMode,
  checkIfUrlInVault,
  type PopupMode,
} from './popupUtils';
import { verifyAndSyncSession, initAuthView } from './popupAuth';
import { initSaveView, loadActiveTabData, loadSharedVaults } from './popupSaveView';
import { initSearchView, activateSearchView } from './popupSearchView';
import { getApiBase } from '../api';
import { db } from '@/db/db';
import { sanitizeAndCleanUrl } from '@/lib/urlSafety';

let currentMode: PopupMode = 'save';

export async function switchMode(mode: PopupMode): Promise<void> {
  currentMode = mode;
  showView(mode);
  if (mode === 'search') {
    await activateSearchView();
  }
}

async function onSessionReady(): Promise<void> {
  await loadActiveTabData();
  await loadSharedVaults();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  let isAlreadyInVault = false;
  if (tab?.url) {
    isAlreadyInVault = await checkIfUrlInVault(db.bookmarks, tab.url);
  }

  const { mode } = resolveInitialMode({
    isAuthenticated: true,
    isAlreadyInVault,
    url: tab?.url,
  });
  await switchMode(mode);
}

export async function init(): Promise<void> {
  setupHostPermissionHandler(onSessionReady);
  initAuthView({ onAuthenticated: onSessionReady });
  initSaveView({});
  initSearchView();

  document.getElementById('btn-mode-save')?.addEventListener('click', () => switchMode('save'));
  document.getElementById('btn-mode-search')?.addEventListener('click', () => switchMode('search'));

  document.getElementById('btn-open-vault')?.addEventListener('click', async () => {
    const base = await getApiBase();
    chrome.tabs.create({ url: `${base.replace(/\/api$/, '')}/app` });
  });

  document.getElementById('btn-options')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey && target?.id !== 'input-desc') {
      e.preventDefault();
      switchMode(currentMode === 'save' ? 'search' : 'save');
    }
  });

  await checkAndRenderHostPermissionBanner();
  const isAuthenticated = await verifyAndSyncSession();
  if (isAuthenticated) {
    await onSessionReady();
  } else {
    showView('auth');
  }
}

// Auto-boot in browser context
if (typeof document !== 'undefined') {
  init();
}
