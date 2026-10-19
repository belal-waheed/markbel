/**
 * Markbel Extension - Popup HUD Controller (TypeScript)
 * Type-safe active tab extraction, smart grouping, dual-mode switcher (Save Tab / Quick Open),
 * and 0ms local Dexie search.
 */

import {
  login,
  getSession,
  verifySession,
  saveBookmark,
  getApiBase,
  syncSessionFromActiveVaultTab,
  checkHostPermission,
  requestHostPermission
} from '../api';
import { db } from '@/db/db';
import { resolveSmartGroup, getCustomSmartGroupRules } from '@/lib/smartGroups';
import { extractInstantMediaMetadata } from '@/lib/mediaHeuristics';
import { filterAndRankBookmarks, SearchBookmarkItem } from '@/lib/searchCatalog';
import type { ExtractedPageMetadata } from '../content';

// DOM Elements - Shell & Navigation
const bannerPermissionWarning = document.getElementById('banner-permission-warning') as HTMLElement | null;
const btnGrantPermission = document.getElementById('btn-grant-permission') as HTMLButtonElement | null;
const btnOpenVault = document.getElementById('btn-open-vault') as HTMLButtonElement;
const btnOptions = document.getElementById('btn-options') as HTMLButtonElement;

// Mode Switcher Elements
const btnModeSave = document.getElementById('btn-mode-save') as HTMLButtonElement;
const btnModeSearch = document.getElementById('btn-mode-search') as HTMLButtonElement;

// Views
const viewAuth = document.getElementById('view-auth') as HTMLElement;
const viewSave = document.getElementById('view-save') as HTMLElement;
const viewSearch = document.getElementById('view-search') as HTMLElement;
const viewSuccess = document.getElementById('view-success') as HTMLElement;

// Auth View Elements
const formLogin = document.getElementById('form-login') as HTMLFormElement;
const inputEmail = document.getElementById('input-email') as HTMLInputElement;
const inputPassword = document.getElementById('input-password') as HTMLInputElement;
const authError = document.getElementById('auth-error') as HTMLElement;
const btnLoginSubmit = document.getElementById('btn-login-submit') as HTMLButtonElement;
const btnSyncVaultTab = document.getElementById('btn-sync-vault-tab') as HTMLButtonElement | null;

// Save View Elements
const formSave = document.getElementById('form-save') as HTMLFormElement;
const inputTitle = document.getElementById('input-title') as HTMLInputElement;
const inputUrl = document.getElementById('input-url') as HTMLInputElement;
const inputDesc = document.getElementById('input-desc') as HTMLTextAreaElement;
const inputCustomGroup = document.getElementById('input-custom-group') as HTMLInputElement;
const togglePin = document.getElementById('toggle-pin') as HTMLInputElement;
const chipsContainer = document.getElementById('group-chips-container') as HTMLElement;
const btnSaveSubmit = document.getElementById('btn-save-submit') as HTMLButtonElement;
const btnSaveText = document.getElementById('btn-save-text') as HTMLElement;
const saveStatusMsg = document.getElementById('save-status-msg') as HTMLElement;
const badgeInVault = document.getElementById('badge-in-vault') as HTMLElement;

const previewCard = document.getElementById('preview-image-container') as HTMLElement;
const previewImage = document.getElementById('preview-image') as HTMLImageElement;
const successGroupLabel = document.getElementById('success-group-label') as HTMLElement;

// Quick Open / Search View Elements
const inputSearchVault = document.getElementById('input-search-vault') as HTMLInputElement;
const btnSearchClear = document.getElementById('btn-search-clear') as HTMLButtonElement;
const searchGroupChips = document.getElementById('search-group-chips') as HTMLElement;
const searchResultsList = document.getElementById('search-results-list') as HTMLElement;

// State
let currentMode: 'save' | 'search' = 'save';
let currentMeta: ExtractedPageMetadata | null = null;
let selectedGroup = 'Unsorted';
let searchCatalog: SearchBookmarkItem[] = [];
let activeSearchGroup = 'All';
let selectedResultIndex = 0;
let filteredResults: SearchBookmarkItem[] = [];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Initialize View
 */
async function init(): Promise<void> {
  setupEventHandlers();

  // Check Firefox MV3 host permissions
  const hasHostPerm = await checkHostPermission();
  if (!hasHostPerm && bannerPermissionWarning) {
    bannerPermissionWarning.classList.remove('hidden');
  }

  const session = await getSession();
  let isAuthenticated = false;

  if (session.isAuthenticated && session.user) {
    isAuthenticated = true;
    verifySession().catch(() => {});
  } else {
    let activeSession = await verifySession();
    if (!activeSession) {
      const tabSync = await syncSessionFromActiveVaultTab();
      if (tabSync.success) {
        activeSession = await verifySession();
      }
    }
    if (activeSession) {
      isAuthenticated = true;
    }
  }

  if (isAuthenticated) {
    await loadActiveTabData();

    // Check if active tab URL already exists in vault
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    let isAlreadyInVault = false;
    if (tab?.url) {
      const existing = await db.bookmarks
        .where('url')
        .equals(tab.url)
        .and((b) => !b.deletedAt)
        .first()
        .catch(() => null);
      if (existing) isAlreadyInVault = true;
    }

    if (isAlreadyInVault) {
      await switchMode('search');
    } else {
      await switchMode('save');
    }
  } else {
    showView('auth');
  }
}

function showView(name: 'auth' | 'save' | 'search' | 'success'): void {
  viewAuth.classList.add('hidden');
  viewSave.classList.add('hidden');
  viewSearch.classList.add('hidden');
  viewSuccess.classList.add('hidden');

  if (name === 'auth') {
    viewAuth.classList.remove('hidden');
    btnModeSave.classList.add('hidden');
    btnModeSearch.classList.add('hidden');
  } else {
    btnModeSave.classList.remove('hidden');
    btnModeSearch.classList.remove('hidden');
  }

  if (name === 'save') {
    viewSave.classList.remove('hidden');
    currentMode = 'save';
    btnModeSave.classList.add('active');
    btnModeSearch.classList.remove('active');
  }

  if (name === 'search') {
    viewSearch.classList.remove('hidden');
    currentMode = 'search';
    btnModeSearch.classList.add('active');
    btnModeSave.classList.remove('active');
  }

  if (name === 'success') {
    viewSuccess.classList.remove('hidden');
  }
}

async function switchMode(mode: 'save' | 'search'): Promise<void> {
  showView(mode);

  if (mode === 'search') {
    await loadSearchCatalog();
    renderSearchResults();
    inputSearchVault.focus();
    inputSearchVault.select();
  }
}

/**
 * Load Search Catalog from IndexedDB
 */
async function loadSearchCatalog(): Promise<void> {
  try {
    const bookmarks = await db.bookmarks.filter((b) => !b.deletedAt).toArray();
    searchCatalog = bookmarks.map((b) => ({
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
    renderSearchGroupChips();
  } catch (err) {
    console.warn('[Markbel Popup] Failed to load search catalog:', err);
  }
}

/**
 * Render Search Group Filter Chips
 */
function renderSearchGroupChips(): void {
  const groups = new Set<string>();
  for (const b of searchCatalog) {
    if (b.group && b.group.trim()) {
      groups.add(b.group.trim());
    }
  }

  const groupList = ['All', ...Array.from(groups).sort()];
  searchGroupChips.innerHTML = groupList
    .map(
      (g) =>
        `<button type="button" class="search-chip ${
          g.toLowerCase() === activeSearchGroup.toLowerCase() ? 'active' : ''
        }" data-group="${escapeHtml(g)}">${escapeHtml(g)}</button>`
    )
    .join('');
}

/**
 * Render Search Results List with Selection Highlight
 */
function renderSearchResults(): void {
  filteredResults = filterAndRankBookmarks(searchCatalog, inputSearchVault.value, activeSearchGroup);

  if (filteredResults.length === 0) {
    searchResultsList.innerHTML = `
      <div class="search-empty-state">
        <p>No bookmarks found matching "<strong>${escapeHtml(inputSearchVault.value)}</strong>"</p>
        <span style="font-size: 11px; opacity: 0.7;">Try searching by title, group, or domain</span>
      </div>
    `;
    return;
  }

  if (selectedResultIndex >= filteredResults.length) {
    selectedResultIndex = 0;
  }

  searchResultsList.innerHTML = filteredResults
    .map((item, idx) => {
      const isSelected = idx === selectedResultIndex;
      const initial = (item.title || item.url || '?').charAt(0).toUpperCase();
      const iconHtml = item.favicon
        ? `<img class="search-item-icon" src="${escapeHtml(item.favicon)}" alt="" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" />
           <div class="search-item-fallback-icon" style="display: none;">${escapeHtml(initial)}</div>`
        : `<div class="search-item-fallback-icon">${escapeHtml(initial)}</div>`;

      let domain = '';
      try {
        domain = new URL(item.url).hostname.replace(/^www\./, '');
      } catch {
        domain = item.url;
      }

      return `
        <div class="search-item ${isSelected ? 'selected' : ''}" data-index="${idx}" role="option" aria-selected="${isSelected}">
          ${iconHtml}
          <div class="search-item-info">
            <div class="search-item-header">
              <span class="search-item-title">${escapeHtml(item.title || item.url)}</span>
              ${item.isPinned ? `<span class="search-item-pin-badge" title="Pinned">★</span>` : ''}
              <span class="search-item-group">${escapeHtml(item.group || 'Unsorted')}</span>
            </div>
            <span class="search-item-url">${escapeHtml(domain)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  renderSelection();
}

function renderSelection(): void {
  const items = searchResultsList.querySelectorAll<HTMLElement>('.search-item');
  items.forEach((el, idx) => {
    if (idx === selectedResultIndex) {
      el.classList.add('selected');
      el.setAttribute('aria-selected', 'true');
      el.scrollIntoView({ block: 'nearest' });
    } else {
      el.classList.remove('selected');
      el.setAttribute('aria-selected', 'false');
    }
  });
}

/**
 * Open Bookmark Action
 */
async function openBookmark(item: SearchBookmarkItem, newTab: boolean, active: boolean): Promise<void> {
  if (newTab) {
    await chrome.tabs.create({ url: item.url, active });
    if (active) window.close();
  } else {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    if (currentTab?.id) {
      await chrome.tabs.update(currentTab.id, { url: item.url });
    } else {
      await chrome.tabs.create({ url: item.url, active: true });
    }
    window.close();
  }
}

/**
 * Load Active Tab & DOM Metadata
 */
async function loadActiveTabData(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      showError('No active browser tab found.');
      return;
    }

    // Check for restricted internal browser URLs
    if (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:') ||
      tab.url.startsWith('moz-extension://')
    ) {
      inputTitle.value = tab.title || 'Browser Internal Tab';
      inputUrl.value = tab.url;
      btnSaveSubmit.disabled = true;
      btnSaveText.textContent = 'Cannot Save Internal URL';
      return;
    }

    // Attempt live DOM extraction via Content Script
    let meta: ExtractedPageMetadata | null = null;
    if (tab.id) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'MARKBEL_EXTRACT_METADATA' });
        if (response && response.success && response.data) {
          meta = response.data;
        }
      } catch {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          const retryRes = await chrome.tabs.sendMessage(tab.id, { type: 'MARKBEL_EXTRACT_METADATA' });
          if (retryRes && retryRes.success && retryRes.data) {
            meta = retryRes.data;
          }
        } catch (err) {
          console.warn('[Markbel Popup] In-DOM extraction fallback:', err);
        }
      }
    }

    currentMeta = meta || {
      url: tab.url,
      rawUrl: tab.url,
      title: tab.title || tab.url,
      description: '',
      image: '',
      favicon: tab.favIconUrl || '',
      siteName: '',
      selectedText: ''
    };

    // Apply instant media heuristics if image is missing or title is bare URL
    if (currentMeta.url && (!currentMeta.image || !currentMeta.title || currentMeta.title === currentMeta.url)) {
      const instant = extractInstantMediaMetadata(currentMeta.url);
      if (instant.image && !currentMeta.image) {
        currentMeta.image = instant.image;
      }
      if (instant.title && (!currentMeta.title || currentMeta.title === currentMeta.url)) {
        currentMeta.title = instant.title;
      }
      if (instant.siteName && !currentMeta.siteName) {
        currentMeta.siteName = instant.siteName;
      }
      if (instant.description && !currentMeta.description && !currentMeta.selectedText) {
        currentMeta.description = instant.description;
      }
    }

    // Query local database for existing bookmark
    let existingBookmark: any = null;
    try {
      existingBookmark = await db.bookmarks.where('url').equals(tab.url).first();
    } catch (e) {
      console.warn('[Markbel Popup] Could not query local bookmark:', e);
    }

    if (existingBookmark && !existingBookmark.deletedAt) {
      if (badgeInVault) badgeInVault.classList.remove('hidden');
      btnSaveText.textContent = 'Update Bookmark';
    } else {
      if (badgeInVault) badgeInVault.classList.add('hidden');
      btnSaveText.textContent = 'Save Bookmark';
    }

    // Populate Fields
    inputTitle.value = existingBookmark?.title || currentMeta.title;
    inputUrl.value = currentMeta.url;
    inputDesc.value = existingBookmark?.description || existingBookmark?.notes || currentMeta.selectedText || currentMeta.description || '';
    if (existingBookmark) {
      togglePin.checked = !!existingBookmark.isPinned;
    }

    // Render Preview Image if available
    if (currentMeta.image) {
      previewImage.src = currentMeta.image;
      previewCard.classList.remove('hidden');
    } else {
      previewCard.classList.add('hidden');
    }

    // Auto-resolve Smart Group
    const customRules = await getCustomSmartGroupRules().catch(() => []);
    const autoGroup = resolveSmartGroup(currentMeta.url, [], customRules);
    const targetGroup = existingBookmark?.group || autoGroup || 'Unsorted';

    await loadDynamicGroupChips(targetGroup);
    selectGroup(targetGroup);

  } catch (err) {
    console.error('[Markbel Popup] Error loading active tab:', err);
    showError('Unable to inspect active tab.');
  }
}

/**
 * Dynamically load smart group chips from IndexedDB for Save View
 */
async function loadDynamicGroupChips(targetGroup: string): Promise<void> {
  try {
    const groups = await db.groups.filter((g) => !g.deletedAt).toArray();
    const groupNames = Array.from(new Set(groups.map((g) => (g.name || '').trim()).filter(Boolean)));
    const defaultChips = ['YT', 'Insta', 'X', 'Unsorted'];
    const combined = Array.from(new Set([...groupNames, ...defaultChips]));

    chipsContainer.innerHTML = combined
      .map(
        (name) =>
          `<button type="button" class="chip ${
          name.toLowerCase() === targetGroup.toLowerCase() ? 'active' : ''
          }" data-group="${escapeHtml(name)}">${escapeHtml(name)}</button>`
      )
      .join('');
  } catch (e) {
    console.warn('[Markbel Popup] Failed to load dynamic groups:', e);
  }
}

function selectGroup(groupName: string): void {
  selectedGroup = groupName;
  let matchedChip = false;

  const chips = chipsContainer.querySelectorAll<HTMLButtonElement>('.chip');
  chips.forEach((chip) => {
    if (chip.getAttribute('data-group')?.toLowerCase() === groupName.toLowerCase()) {
      chip.classList.add('active');
      matchedChip = true;
    } else {
      chip.classList.remove('active');
    }
  });

  if (!matchedChip) {
    inputCustomGroup.value = groupName;
  } else {
    inputCustomGroup.value = '';
  }
}

/**
 * Event Listeners Setup
 */
function setupEventHandlers(): void {
  // Global Mode Toggle with Tab Key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey && e.target !== inputDesc) {
      e.preventDefault();
      switchMode(currentMode === 'save' ? 'search' : 'save');
    }
  });

  // Mode Switcher Buttons
  btnModeSave.addEventListener('click', () => switchMode('save'));
  btnModeSearch.addEventListener('click', () => switchMode('search'));

  // Quick Open Search Input Events
  inputSearchVault.addEventListener('input', () => {
    btnSearchClear.classList.toggle('hidden', !inputSearchVault.value);
    selectedResultIndex = 0;
    renderSearchResults();
  });

  btnSearchClear.addEventListener('click', () => {
    inputSearchVault.value = '';
    btnSearchClear.classList.add('hidden');
    selectedResultIndex = 0;
    renderSearchResults();
    inputSearchVault.focus();
  });

  // Search Group Chips Click
  searchGroupChips.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('.search-chip');
    if (!chip) return;
    const group = chip.getAttribute('data-group');
    if (group) {
      activeSearchGroup = group;
      searchGroupChips.querySelectorAll('.search-chip').forEach((c) => {
        c.classList.toggle('active', c.getAttribute('data-group') === group);
      });
      selectedResultIndex = 0;
      renderSearchResults();
    }
  });

  // Search Keyboard Navigation
  inputSearchVault.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        selectedResultIndex = Math.min(selectedResultIndex + 1, filteredResults.length - 1);
        renderSelection();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        selectedResultIndex = Math.max(selectedResultIndex - 1, 0);
        renderSelection();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults.length > 0 && filteredResults[selectedResultIndex]) {
        const selected = filteredResults[selectedResultIndex];
        const newTab = e.ctrlKey || e.metaKey || e.shiftKey;
        const active = !e.shiftKey;
        await openBookmark(selected, newTab, active);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      window.close();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      if (window.getSelection()?.toString().trim()) {
        return; // Normal copy within input
      }
      if (filteredResults[selectedResultIndex]) {
        e.preventDefault();
        await navigator.clipboard.writeText(filteredResults[selectedResultIndex].url);
        const originalPlaceholder = inputSearchVault.placeholder;
        inputSearchVault.placeholder = 'URL copied to clipboard!';
        setTimeout(() => {
          inputSearchVault.placeholder = originalPlaceholder;
        }, 1500);
      }
    }
  });

  // Search Results List Click
  searchResultsList.addEventListener('click', (e) => {
    const itemEl = (e.target as HTMLElement).closest('.search-item');
    if (!itemEl) return;
    const idx = Number(itemEl.getAttribute('data-index'));
    if (!isNaN(idx) && filteredResults[idx]) {
      openBookmark(filteredResults[idx], e.ctrlKey || e.metaKey, !e.shiftKey);
    }
  });

  // Vault Navigation
  btnOpenVault.addEventListener('click', async () => {
    const base = await getApiBase();
    const vaultUrl = `${base.replace(/\/api$/, '')}/app`;
    chrome.tabs.create({ url: vaultUrl });
  });

  // Settings Navigation
  btnOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Host Permission Request (Firefox MV3)
  if (btnGrantPermission) {
    btnGrantPermission.addEventListener('click', async () => {
      btnGrantPermission.disabled = true;
      btnGrantPermission.textContent = 'Requesting...';
      try {
        const granted = await requestHostPermission();
        if (granted) {
          if (bannerPermissionWarning) {
            bannerPermissionWarning.classList.add('hidden');
          }
          const session = await verifySession();
          if (session) {
            showView('save');
            await loadActiveTabData();
          }
        }
      } finally {
        btnGrantPermission.disabled = false;
        btnGrantPermission.textContent = 'Grant Permission';
      }
    });
  }

  // Sync Session from Open Tab
  if (btnSyncVaultTab) {
    btnSyncVaultTab.addEventListener('click', async () => {
      authError.classList.add('hidden');
      btnSyncVaultTab.disabled = true;
      btnSyncVaultTab.textContent = 'Connecting to Vault Tab...';

      try {
        const result = await syncSessionFromActiveVaultTab();
        if (result.success) {
          const session = await verifySession();
          if (session) {
            showView('save');
            await loadActiveTabData();
            return;
          }
        }
        authError.textContent = result.error || 'Could not find an authenticated Markbel tab.';
        authError.classList.remove('hidden');
      } catch (err: any) {
        authError.textContent = err?.message || 'Failed to sync session from tab';
        authError.classList.remove('hidden');
      } finally {
        btnSyncVaultTab.disabled = false;
        btnSyncVaultTab.textContent = 'Sync Session from Open Web Vault Tab';
      }
    });
  }

  // Group Chips in Save Tab
  chipsContainer.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('.chip');
    if (!chip) return;
    const group = chip.getAttribute('data-group');
    if (group) selectGroup(group);
  });

  inputCustomGroup.addEventListener('input', () => {
    const custom = inputCustomGroup.value.trim();
    if (custom) {
      selectedGroup = custom;
      chipsContainer.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    }
  });

  // Login Form
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    btnLoginSubmit.disabled = true;
    btnLoginSubmit.textContent = 'Signing in...';

    try {
      await login(inputEmail.value.trim(), inputPassword.value);
      showView('save');
      await loadActiveTabData();
    } catch (err: any) {
      authError.textContent = err?.message || 'Login failed';
      authError.classList.remove('hidden');
    } finally {
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.textContent = 'Sign In';
    }
  });

  // Bookmark Save Form
  formSave.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveStatusMsg.classList.add('hidden');
    btnSaveSubmit.disabled = true;
    btnSaveText.textContent = 'Saving...';

    const finalTitle = inputTitle.value.trim();
    const finalUrl = inputUrl.value.trim();
    const finalDesc = inputDesc.value.trim();
    const finalGroup = inputCustomGroup.value.trim() || selectedGroup || 'Unsorted';
    const isPinned = togglePin.checked;

    try {
      await saveBookmark({
        url: finalUrl,
        title: finalTitle,
        description: finalDesc,
        image: currentMeta?.image || '',
        favicon: currentMeta?.favicon || '',
        siteName: currentMeta?.siteName || '',
        group: finalGroup,
        isPinned
      });

      // Show Success confirmation HUD
      successGroupLabel.textContent = `Assigned to "${finalGroup}"`;
      showView('success');

      // Auto-dismiss HUD after 1.2s
      setTimeout(() => {
        window.close();
      }, 1200);

    } catch (err: any) {
      console.error('[Markbel Popup] Save error:', err);
      saveStatusMsg.textContent = err?.message || 'Failed to save bookmark';
      saveStatusMsg.classList.remove('hidden');
      btnSaveSubmit.disabled = false;
      btnSaveText.textContent = 'Save Bookmark';
    }
  });
}

function showError(msg: string): void {
  saveStatusMsg.textContent = msg;
  saveStatusMsg.classList.remove('hidden');
}

// Boot Controller
init();
