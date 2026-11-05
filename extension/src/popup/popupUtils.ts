/**
 * Markbel Extension - Popup HUD Utilities
 * HTML escaping, view state transitions, host permissions, and status feedback.
 */

import { checkHostPermission, requestHostPermission } from '../api';
import { sanitizeAndCleanUrl } from '@/lib/urlSafety';

export type PopupView = 'auth' | 'save' | 'search' | 'success';
export type PopupMode = 'save' | 'search';

/**
 * Escape unsafe HTML characters for safe rendering in popup HUD
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate whether a URL is a restricted internal browser schema
 */
export function isRestrictedBrowserUrl(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.trim().toLowerCase();
  if (!lower) return false;

  // Explicit browser internal schemes
  if (
    lower.startsWith('chrome://') ||
    lower.startsWith('chrome-extension://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('about:') ||
    lower.startsWith('moz-extension://') ||
    lower.startsWith('devtools://') ||
    lower.startsWith('view-source:') ||
    lower.startsWith('brave://') ||
    lower.startsWith('opera://') ||
    lower.startsWith('vivaldi://') ||
    lower.startsWith('helium://') ||
    lower.startsWith('arc://') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:')
  ) {
    return true;
  }

  // Web store restricted domains
  if (
    lower.startsWith('https://chrome.google.com/webstore') ||
    lower.startsWith('https://chromewebstore.google.com')
  ) {
    return true;
  }

  // If it does not start with standard web protocol or local file, treat as restricted
  if (!lower.startsWith('http://') && !lower.startsWith('https://') && !lower.startsWith('file://')) {
    return true;
  }

  return false;
}

/**
 * Resolve initial view and mode based on session and vault status
 */
export function resolveInitialMode(params: {
  isAuthenticated: boolean;
  isAlreadyInVault: boolean;
  url?: string | null;
}): { view: PopupView; mode: PopupMode } {
  if (!params.isAuthenticated) {
    return { view: 'auth', mode: 'save' };
  }
  if (
    params.url !== undefined &&
    (!params.url || params.url === 'about:blank' || isRestrictedBrowserUrl(params.url))
  ) {
    return { view: 'search', mode: 'search' };
  }
  if (params.isAlreadyInVault) {
    return { view: 'search', mode: 'search' };
  }
  return { view: 'save', mode: 'save' };
}

/**
 * Check whether an active tab URL already exists in local vault storage.
 * Evaluates the sanitized canonical URL first, with graceful fallback to raw URL.
 */
export async function checkIfUrlInVault(
  bookmarksTable: {
    where: (index: string) => {
      equals: (val: string) => {
        and: (predicate: (b: any) => boolean) => {
          first: () => Promise<any>;
        };
      };
    };
  },
  rawUrl?: string | null
): Promise<boolean> {
  if (!rawUrl || !rawUrl.trim()) return false;
  const trimmed = rawUrl.trim();
  let cleanUrl = trimmed;
  try {
    cleanUrl = sanitizeAndCleanUrl(trimmed).cleanUrlStr;
  } catch {}

  let existing = await bookmarksTable
    .where('url')
    .equals(cleanUrl)
    .and((b: any) => !b.deletedAt)
    .first()
    .catch(() => null);

  if (!existing && cleanUrl !== trimmed) {
    existing = await bookmarksTable
      .where('url')
      .equals(trimmed)
      .and((b: any) => !b.deletedAt)
      .first()
      .catch(() => null);
  }

  return !!existing;
}

/**
 * Toggle visibility of popup HUD views and mode buttons
 */
export function showView(name: PopupView): void {
  if (typeof document === 'undefined') return;

  const viewAuth = document.getElementById('view-auth');
  const viewSave = document.getElementById('view-save');
  const viewSearch = document.getElementById('view-search');
  const viewSuccess = document.getElementById('view-success');
  const btnModeSave = document.getElementById('btn-mode-save');
  const btnModeSearch = document.getElementById('btn-mode-search');

  viewAuth?.classList.add('hidden');
  viewSave?.classList.add('hidden');
  viewSearch?.classList.add('hidden');
  viewSuccess?.classList.add('hidden');

  if (name === 'auth') {
    viewAuth?.classList.remove('hidden');
    btnModeSave?.classList.add('hidden');
    btnModeSearch?.classList.add('hidden');
  } else {
    btnModeSave?.classList.remove('hidden');
    btnModeSearch?.classList.remove('hidden');
  }

  if (name === 'save') {
    viewSave?.classList.remove('hidden');
    btnModeSave?.classList.add('active');
    btnModeSearch?.classList.remove('active');
  }

  if (name === 'search') {
    viewSearch?.classList.remove('hidden');
    btnModeSearch?.classList.add('active');
    btnModeSave?.classList.remove('active');
  }

  if (name === 'success') {
    viewSuccess?.classList.remove('hidden');
  }
}

/**
 * Check Firefox MV3 host permissions and update warning banner
 */
export async function checkAndRenderHostPermissionBanner(): Promise<boolean> {
  if (typeof document === 'undefined') return true;
  const banner = document.getElementById('banner-permission-warning');
  const hasPerm = await checkHostPermission();
  if (!hasPerm && banner) {
    banner.classList.remove('hidden');
  } else if (hasPerm && banner) {
    banner.classList.add('hidden');
  }
  return hasPerm;
}

/**
 * Setup event handler for host permission grant button
 */
export function setupHostPermissionHandler(onGranted: () => Promise<void>): void {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('btn-grant-permission') as HTMLButtonElement | null;
  const banner = document.getElementById('banner-permission-warning');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Requesting...';
    try {
      const granted = await requestHostPermission();
      if (granted) {
        banner?.classList.add('hidden');
        await onGranted();
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Grant Permission';
    }
  });
}

/**
 * Present error or informational feedback in Save view
 */
export function showSaveStatus(msg: string, isError = false): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('save-status-msg');
  if (!el) return;
  el.textContent = msg;
  if (isError) {
    el.classList.add('error');
  } else {
    el.classList.remove('error');
  }
  el.classList.remove('hidden');
}

/**
 * Present general error banner in Save view
 */
export function showError(msg: string): void {
  showSaveStatus(msg, true);
}
