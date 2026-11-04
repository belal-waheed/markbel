/**
 * Markbel Extension - Popup HUD Save View Controller
 * Active tab inspection, media heuristics, smart grouping, shared vault selector,
 * and bookmark save mutation execution.
 */

import { saveBookmark, listSharedVaults, SharedVault } from '../api';
import { db } from '@/db/db';
import { resolveSmartGroup, getCustomSmartGroupRules } from '@/lib/smartGroups';
import { extractInstantMediaMetadata } from '@/lib/mediaHeuristics';
import type { ExtractedPageMetadata } from '../content';
import { escapeHtml, isRestrictedBrowserUrl, showError, showView } from './popupUtils';

export interface BookmarkSavePayload {
  url: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
  siteName: string;
  group: string;
  isPinned: boolean;
  targetVaultOwnerId?: string;
  remindAt?: string;
}

/**
 * Format a reminder date as ISO-8601 string safely
 */
export function formatReminderDate(date: Date | string | null | undefined): string | undefined {
  if (!date) return undefined;
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Resolve effective bookmark group with strict priority:
 * 1. User custom input
 * 2. Selected chip group (if not 'All')
 * 3. Auto-detected heuristic smart group
 * 4. Fallback 'Unsorted'
 */
export function resolveEffectiveGroup(
  customGroup?: string,
  selectedChipGroup?: string,
  autoGroup?: string
): string {
  const custom = customGroup?.trim();
  if (custom) return custom;
  const chip = selectedChipGroup?.trim();
  if (chip && chip.toLowerCase() !== 'all') return chip;
  const auto = autoGroup?.trim();
  if (auto) return auto;
  return 'Unsorted';
}

/**
 * Pure function to construct the validated bookmark payload
 */
export function buildBookmarkSavePayload(params: {
  url: string;
  title: string;
  description?: string;
  customGroup?: string;
  selectedGroup?: string;
  autoGroup?: string;
  isPinned?: boolean;
  image?: string;
  favicon?: string;
  siteName?: string;
  targetVaultOwnerId?: string;
  remindAt?: Date | string;
}): BookmarkSavePayload {
  const finalGroup = resolveEffectiveGroup(params.customGroup, params.selectedGroup, params.autoGroup);
  const formattedReminder = formatReminderDate(params.remindAt);

  return {
    url: params.url.trim(),
    title: params.title.trim() || params.url.trim(),
    description: (params.description || '').trim(),
    image: params.image || '',
    favicon: params.favicon || '',
    siteName: params.siteName || '',
    group: finalGroup,
    isPinned: !!params.isPinned,
    targetVaultOwnerId: params.targetVaultOwnerId || undefined,
    ...(formattedReminder ? { remindAt: formattedReminder } : {})
  };
}

/**
 * Format success HUD confirmation text
 */
export function formatSuccessNotification(group: string, vaultOwnerDisplay?: string | null): string {
  if (vaultOwnerDisplay) {
    return `Assigned to "${group}" in ${vaultOwnerDisplay}'s Vault`;
  }
  return `Assigned to "${group}"`;
}

// Controller State
let currentMeta: ExtractedPageMetadata | null = null;
let selectedGroup = 'Unsorted';
let editorVaults: SharedVault[] = [];
let activeVaultOwnerId = '';

export function getSelectedGroup(): string {
  return selectedGroup;
}

export function getActiveVaultOwnerId(): string {
  return activeVaultOwnerId;
}

export function getCurrentMeta(): ExtractedPageMetadata | null {
  return currentMeta;
}

/**
 * Load Active Tab & DOM Metadata
 */
export async function loadActiveTabData(): Promise<void> {
  if (typeof document === 'undefined') return;

  const inputTitle = document.getElementById('input-title') as HTMLInputElement | null;
  const inputUrl = document.getElementById('input-url') as HTMLInputElement | null;
  const inputDesc = document.getElementById('input-desc') as HTMLTextAreaElement | null;
  const togglePin = document.getElementById('toggle-pin') as HTMLInputElement | null;
  const badgeInVault = document.getElementById('badge-in-vault');
  const btnSaveSubmit = document.getElementById('btn-save-submit') as HTMLButtonElement | null;
  const btnSaveText = document.getElementById('btn-save-text');
  const previewCard = document.getElementById('preview-image-container');
  const previewImage = document.getElementById('preview-image') as HTMLImageElement | null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    if (!tab || !tab.url) {
      showError('No active browser tab found.');
      return;
    }

    // Check for restricted internal browser URLs
    if (isRestrictedBrowserUrl(tab.url)) {
      if (inputTitle) inputTitle.value = tab.title || 'Browser Internal Tab';
      if (inputUrl) inputUrl.value = tab.url;
      if (btnSaveSubmit) btnSaveSubmit.disabled = true;
      if (btnSaveText) btnSaveText.textContent = 'Cannot Save Internal URL';
      return;
    }

    if (btnSaveSubmit) btnSaveSubmit.disabled = false;

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
      badgeInVault?.classList.remove('hidden');
      if (btnSaveText) btnSaveText.textContent = 'Update Bookmark';
    } else {
      badgeInVault?.classList.add('hidden');
      if (btnSaveText) btnSaveText.textContent = 'Save Bookmark';
    }

    // Populate Fields
    if (inputTitle) inputTitle.value = existingBookmark?.title || currentMeta.title;
    if (inputUrl) inputUrl.value = currentMeta.url;
    if (inputDesc) {
      inputDesc.value =
        existingBookmark?.description ||
        existingBookmark?.notes ||
        currentMeta.selectedText ||
        currentMeta.description ||
        '';
    }
    if (togglePin && existingBookmark) {
      togglePin.checked = !!existingBookmark.isPinned;
    }

    // Render Preview Image if available
    if (currentMeta.image && previewImage && previewCard) {
      previewImage.src = currentMeta.image;
      previewCard.classList.remove('hidden');
    } else if (previewCard) {
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
export async function loadDynamicGroupChips(targetGroup: string): Promise<void> {
  if (typeof document === 'undefined') return;
  const chipsContainer = document.getElementById('group-chips-container');
  if (!chipsContainer) return;

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

/**
 * Load Shared Vaults where user has Editor permission
 */
export async function loadSharedVaults(): Promise<void> {
  if (typeof document === 'undefined') return;
  const vaultSelectorContainer = document.getElementById('vault-selector-container');
  const selectVault = document.getElementById('select-vault') as HTMLSelectElement | null;

  try {
    const vaults = await listSharedVaults();
    editorVaults = vaults.filter((v) => v.role === 'editor');

    if (editorVaults.length > 0 && vaultSelectorContainer && selectVault) {
      vaultSelectorContainer.classList.remove('hidden');

      const stored: Record<string, any> = await chrome.storage.local.get(['activeVaultOwnerId']).catch(() => ({}));
      activeVaultOwnerId = (stored?.activeVaultOwnerId as string) || '';

      selectVault.innerHTML = '<option value="">Personal Vault</option>';
      for (const vault of editorVaults) {
        const opt = document.createElement('option');
        opt.value = vault.owner_id;
        const ownerDisplay = vault.owner_name || vault.owner_email || vault.owner_id;
        opt.textContent = `${ownerDisplay}'s Vault`;
        selectVault.appendChild(opt);
      }

      if (activeVaultOwnerId && editorVaults.some((v) => v.owner_id === activeVaultOwnerId)) {
        selectVault.value = activeVaultOwnerId;
      } else {
        selectVault.value = '';
        activeVaultOwnerId = '';
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.remove(['activeVaultOwnerId']).catch(() => {});
        }
      }
    } else if (vaultSelectorContainer) {
      vaultSelectorContainer.classList.add('hidden');
      activeVaultOwnerId = '';
      if (selectVault) {
        selectVault.innerHTML = '<option value="">Personal Vault</option>';
        selectVault.value = '';
      }
    }
  } catch (err) {
    console.warn('[Markbel Popup] Failed to load shared vaults:', err);
  }
}

/**
 * Select a group chip and update custom input
 */
export function selectGroup(groupName: string): void {
  selectedGroup = groupName;
  if (typeof document === 'undefined') return;

  const chipsContainer = document.getElementById('group-chips-container');
  const inputCustomGroup = document.getElementById('input-custom-group') as HTMLInputElement | null;
  if (!chipsContainer) return;

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

  if (inputCustomGroup) {
    inputCustomGroup.value = matchedChip ? '' : groupName;
  }
}

/**
 * Initialize Save View event handlers
 */
export function initSaveView(callbacks?: { onSaveComplete?: () => void }): void {
  if (typeof document === 'undefined') return;

  const chipsContainer = document.getElementById('group-chips-container');
  const inputCustomGroup = document.getElementById('input-custom-group') as HTMLInputElement | null;
  const selectVault = document.getElementById('select-vault') as HTMLSelectElement | null;
  const formSave = document.getElementById('form-save') as HTMLFormElement | null;
  const inputTitle = document.getElementById('input-title') as HTMLInputElement | null;
  const inputUrl = document.getElementById('input-url') as HTMLInputElement | null;
  const inputDesc = document.getElementById('input-desc') as HTMLTextAreaElement | null;
  const togglePin = document.getElementById('toggle-pin') as HTMLInputElement | null;
  const saveStatusMsg = document.getElementById('save-status-msg');
  const btnSaveSubmit = document.getElementById('btn-save-submit') as HTMLButtonElement | null;
  const btnSaveText = document.getElementById('btn-save-text');
  const successGroupLabel = document.getElementById('success-group-label');

  // Group chips click
  chipsContainer?.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('.chip');
    if (!chip) return;
    const group = chip.getAttribute('data-group');
    if (group) selectGroup(group);
  });

  // Custom group input
  inputCustomGroup?.addEventListener('input', () => {
    const custom = inputCustomGroup.value.trim();
    if (custom) {
      selectedGroup = custom;
      chipsContainer?.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    }
  });

  // Shared vault dropdown
  selectVault?.addEventListener('change', async () => {
    activeVaultOwnerId = selectVault.value;
    if (activeVaultOwnerId) {
      await chrome.storage?.local?.set({ activeVaultOwnerId }).catch(() => {});
    } else {
      await chrome.storage?.local?.remove(['activeVaultOwnerId']).catch(() => {});
    }
  });

  // Save form submission
  formSave?.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveStatusMsg?.classList.add('hidden');
    if (btnSaveSubmit) btnSaveSubmit.disabled = true;
    if (btnSaveText) btnSaveText.textContent = 'Saving...';

    const finalTitle = inputTitle?.value || '';
    const finalUrl = inputUrl?.value || '';
    const finalDesc = inputDesc?.value || '';
    const customGroup = inputCustomGroup?.value || '';
    const isPinned = !!togglePin?.checked;

    const payload = buildBookmarkSavePayload({
      url: finalUrl,
      title: finalTitle,
      description: finalDesc,
      customGroup,
      selectedGroup,
      isPinned,
      image: currentMeta?.image || '',
      favicon: currentMeta?.favicon || '',
      siteName: currentMeta?.siteName || '',
      targetVaultOwnerId: activeVaultOwnerId || undefined
    });

    try {
      await saveBookmark(payload);

      // Show Success confirmation HUD
      let vaultOwnerName: string | null = null;
      if (activeVaultOwnerId) {
        const vaultObj = editorVaults.find((v) => v.owner_id === activeVaultOwnerId);
        vaultOwnerName = vaultObj ? vaultObj.owner_name || vaultObj.owner_email || 'Shared' : 'Shared';
      }

      if (successGroupLabel) {
        successGroupLabel.textContent = formatSuccessNotification(payload.group, vaultOwnerName);
      }
      showView('success');
      callbacks?.onSaveComplete?.();

      // Auto-dismiss HUD after 1.2s
      setTimeout(() => {
        window.close();
      }, 1200);
    } catch (err: any) {
      console.error('[Markbel Popup] Save error:', err);
      if (saveStatusMsg) {
        saveStatusMsg.textContent = err?.message || 'Failed to save bookmark';
        saveStatusMsg.classList.remove('hidden');
      }
      if (btnSaveSubmit) btnSaveSubmit.disabled = false;
      if (btnSaveText) btnSaveText.textContent = 'Save Bookmark';
    }
  });
}
