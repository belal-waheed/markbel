/**
 * Markbel Extension - Edge API Client & Session Manager
 * Connects directly to Cloudflare Workers D1 delta sync (/api/sync/push).
 */

import { ofetch } from 'ofetch';
import { bookmarkRepository } from '@/db/SyncRepository';

export const DEFAULT_API_BASE = 'https://mark.obel.workers.dev/api';

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export const apiClient = ofetch.create({
  retry: 3,
  retryDelay: 1000,
  onResponseError({ request, response, options }) {
    if (response.status >= 500) {
      throw new NetworkError('Server error. Please try again later.');
    }
  },
  onRequestError({ request, error }) {
    throw new NetworkError('Network disconnected or endpoint blocked.');
  }
});

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
  const result = await chrome.storage.local.get(['apiUrl']);
  return normalizeApiUrl(result.apiUrl as string);
}

/**
 * Retrieves stored user session
 */
export async function getSession(): Promise<ExtensionSession> {
  const result = await chrome.storage.local.get(['authToken', 'authUser']);
  const token = (result.authToken as string) || null;
  const user = (result.authUser as AuthUser) || null;
  return {
    token,
    user,
    isAuthenticated: Boolean(token)
  };
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
 * Authenticates against Markbel backend
 */
export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const base = await getApiBase();
  try {
    const data = await apiClient(`${base}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email, password }
    });

    if (data.token) {
      await setSession(data.token, data.user);
    }
    
    return data;
  } catch (err: any) {
    if (err.response) {
      throw new Error(err.response._data?.error || `Login failed with status ${err.response.status}`);
    }
    throw err;
  }
}

/**
 * Verifies current token validity
 */
export async function verifySession(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session.token) return null;

  const base = await getApiBase();
  try {
    const user = await apiClient<AuthUser>(`${base}/users/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      }
    });

    await chrome.storage.local.set({ authUser: user });
    return user;
  } catch (err: any) {
    if (err.response && err.response.status === 401) {
      await clearSession();
      return null;
    }
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

  // 2. Trigger background worker to flush the outbox
  try {
    chrome.runtime.sendMessage({ type: 'SYNC_OUTBOX' });
  } catch (err) {
    console.warn('Could not notify background worker to sync outbox immediately', err);
  }

  return { success: true, bookmarkId };
}
