/**
 * Markbel Extension - Popup HUD Controller (TypeScript)
 * Type-safe active tab extraction, smart grouping, and delta sync submission.
 */

import {
  login,
  verifySession,
  saveBookmark,
  getApiBase
} from '../api';
import { resolveSmartGroup } from '@/lib/smartGroups';
import type { ExtractedPageMetadata } from '../content';

// DOM Elements
const viewAuth = document.getElementById('view-auth') as HTMLElement;
const viewSave = document.getElementById('view-save') as HTMLElement;
const viewSuccess = document.getElementById('view-success') as HTMLElement;

const formLogin = document.getElementById('form-login') as HTMLFormElement;
const inputEmail = document.getElementById('input-email') as HTMLInputElement;
const inputPassword = document.getElementById('input-password') as HTMLInputElement;
const authError = document.getElementById('auth-error') as HTMLElement;
const btnLoginSubmit = document.getElementById('btn-login-submit') as HTMLButtonElement;

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

const previewCard = document.getElementById('preview-image-container') as HTMLElement;
const previewImage = document.getElementById('preview-image') as HTMLImageElement;
const successGroupLabel = document.getElementById('success-group-label') as HTMLElement;

const btnOpenVault = document.getElementById('btn-open-vault') as HTMLButtonElement;
const btnOptions = document.getElementById('btn-options') as HTMLButtonElement;

// State
let currentMeta: ExtractedPageMetadata | null = null;
let selectedGroup = 'Unsorted';

/**
 * Initialize View
 */
async function init(): Promise<void> {
  setupEventHandlers();

  const session = await verifySession();
  if (!session) {
    showView('auth');
    return;
  }

  showView('save');
  await loadActiveTabData();
}

function showView(name: 'auth' | 'save' | 'success'): void {
  viewAuth.classList.add('hidden');
  viewSave.classList.add('hidden');
  viewSuccess.classList.add('hidden');

  if (name === 'auth') viewAuth.classList.remove('hidden');
  if (name === 'save') viewSave.classList.remove('hidden');
  if (name === 'success') viewSuccess.classList.remove('hidden');
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
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
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
        // Content script may not be injected yet, inject on-demand
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

    // Populate Fields
    inputTitle.value = currentMeta.title;
    inputUrl.value = currentMeta.url;
    inputDesc.value = currentMeta.selectedText || currentMeta.description || '';

    // Render Preview Image if available
    if (currentMeta.image) {
      previewImage.src = currentMeta.image;
      previewCard.classList.remove('hidden');
    } else {
      previewCard.classList.add('hidden');
    }

    // Auto-resolve Smart Group via Markbel's domain rules
    const autoGroup = resolveSmartGroup(currentMeta.url);
    selectGroup(autoGroup);

  } catch (err) {
    console.error('[Markbel Popup] Error loading active tab:', err);
    showError('Unable to inspect active tab.');
  }
}

/**
 * Handle Group Chip Selection
 */
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
  // Vault Navigation
  btnOpenVault.addEventListener('click', async () => {
    const base = await getApiBase();
    const vaultUrl = base.replace(/\/api$/, '');
    chrome.tabs.create({ url: vaultUrl });
  });

  // Settings Navigation
  btnOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Group Chips
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
