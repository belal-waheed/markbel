/**
 * Markbel Extension - Edge API Client & Session Manager
 * Connects directly to Cloudflare Workers D1 delta sync (/api/sync/push).
 */

import { bookmarkRepository } from '@/db/SyncRepository';
import { syncManager } from '@/db/SyncManager';

export const DEFAULT_API_BASE = 'https://mark.obel.workers.dev/api';

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface ExtensionSession {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
}

export interface SaveBookmarkParams {
  url: string;
  title: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  group?: string;
  isPinned?: boolean;
  contentType?: string;
}

/**
 * Normalizes an API base URL (strips trailing slash, ensures /api suffix)
 */
export function normalizeApiUrl(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return DEFAULT_API_BASE;
  let clean = raw.trim().replace(/\/$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    if (clean.startsWith('localhost') || clean.startsWith('127.0.0.1')) {
      clean = `http://${clean}`;
    } else {
      clean = `https://${clean}`;
    }
  }
  if (!clean.endsWith('/api')) {
    clean = `${clean}/api`;
  }
  return clean;
}

/**
 * Retrieves configured API base URL from chrome.storage.local
 */
export async function getApiBase(): Promise<string> {
  try {
    const result = await chrome.storage.local.get(['apiUrl']);
    return normalizeApiUrl(result.apiUrl as string);
  } catch {
    return DEFAULT_API_BASE;
  }
}

/**
 * Retrieves stored user session
 */
export async function getSession(): Promise<ExtensionSession> {
  try {
    const result = await chrome.storage.local.get(['authToken', 'authUser']);
    const token = (result.authToken as string) || null;
    const user = (result.authUser as AuthUser) || null;
    return {
      token,
      user,
      isAuthenticated: Boolean(token)
    };
  } catch {
    return {
      token: null,
      user: null,
      isAuthenticated: false
    };
  }
}

/**
 * Persists user session to storage
 */
export async function setSession(token: string, user: AuthUser): Promise<void> {
  await chrome.storage.local.set({
    authToken: token,
    authUser: user
  });
}

/**
 * Clears stored user session
 */
export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(['authToken', 'authUser']);
}

/**
 * Authenticates against Markbel backend using browser-native fetch
 */
export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const base = await getApiBase();
  const targetUrl = `${base}/users/login`;
  const cleanEmail = (email || '').trim().toLowerCase();

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: cleanEmail, password })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}: ${res.statusText || 'Authentication failed'}`);
    }

    if (data.token) {
      await setSession(data.token, data.user);
      await syncManager.sync(true).catch(() => {});
    }
    
    return data;
  } catch (err: any) {
    console.error('[Markbel Extension Login Error]:', err);
    throw err;
  }
}

/**
 * Verifies current token validity using browser-native fetch
 */
export async function verifySession(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session.token) return null;

  const base = await getApiBase();
  const targetUrl = `${base}/users/me`;

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      }
    });

    if (res.status === 401) {
      await clearSession();
      return null;
    }

    const user = await res.json().catch(() => null);
    if (!res.ok || !user) {
      throw new Error('Failed to verify session');
    }

    await chrome.storage.local.set({ authUser: user });
    return user;
  } catch (err: any) {
    console.warn('[Markbel Extension] Offline session check notice:', err);
    return session.user;
  }
}

/**
 * Submits a new bookmark mutation to the backend delta sync engine (/api/sync/push)
 */
export async function saveBookmark({
  url,
  title,
  description = '',
  image = '',
  favicon = '',
  siteName = '',
  group = 'Unsorted',
  isPinned = false,
  contentType
}: SaveBookmarkParams): Promise<{ success: boolean; bookmarkId: string }> {
  const session = await getSession();
  if (!session.token) {
    throw new Error('Please sign in to Markbel to save bookmarks.');
  }

  const bookmarkId = crypto.randomUUID();

  // 1. Create locally in Dexie database (Outbox pattern)
  await bookmarkRepository.create({
    id: bookmarkId,
    userId: session.user?.id || 'local-user',
    url: url.trim(),
    title: (title || url).trim(),
    description: (description || '').trim(),
    image: (image || '').trim(),
    favicon: (favicon || '').trim(),
    siteName: (siteName || '').trim(),
    group: group || 'Unsorted',
    contentType: contentType as any,
    isRead: false,
    isPinned: Boolean(isPinned)
  });

  // 2. Direct sync race (up to 2500ms) to ensure mutations reach Cloudflare D1 before popup closes
  try {
    await Promise.race([
      syncManager.sync(true),
      new Promise((res) => setTimeout(res, 2500))
    ]);
  } catch (err) {
    console.warn('[Markbel Extension] Immediate sync notice:', err);
  }

  // 3. Trigger background worker to flush the outbox as fallback
  try {
    chrome.runtime.sendMessage({ type: 'SYNC_OUTBOX' }).catch(() => {});
  } catch {}

  return { success: true, bookmarkId };
}

/**
 * Automatically inspects open Markbel web tabs to import an active session
 */
export async function syncSessionFromActiveVaultTab(): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const tabs = await chrome.tabs.query({ url: '*://mark.obel.workers.dev/*' });
    if (!tabs || tabs.length === 0) {
      return { success: false, error: 'No open Markbel tabs found.' };
    }
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        const [execution] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const token = localStorage.getItem('markbel_token');
            const userStr = localStorage.getItem('markbel_user');
            if (token && userStr) {
              try {
                return { token, user: JSON.parse(userStr) };
              } catch {
                return null;
              }
            }
            return null;
          }
        });
        if (execution?.result?.token && execution?.result?.user) {
          await setSession(execution.result.token, execution.result.user);
          await syncManager.sync(true).catch(() => {});
          return { success: true, email: execution.result.user.email };
        }
      } catch (scriptErr) {
        console.warn('[Markbel Extension] Tab script inspection failed:', scriptErr);
      }
    }
    return { success: false, error: 'No authenticated session found in open tabs.' };
  } catch (err: any) {
    console.warn('[Markbel Extension] syncSessionFromActiveVaultTab error:', err);
    return { success: false, error: err?.message || 'Failed to inspect open tabs.' };
  }
}

