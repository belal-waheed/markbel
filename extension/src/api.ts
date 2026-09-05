/**
 * Markbel Extension - Edge API Client & Session Manager
 * Connects directly to Cloudflare Workers D1 delta sync (/api/sync/push).
 */

export const DEFAULT_API_BASE = 'https://mark.obel.workers.dev/api';

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
}

/**
 * Normalizes an API base URL (strips trailing slash, ensures /api suffix)
 */
export function normalizeApiUrl(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return DEFAULT_API_BASE;
  let clean = raw.trim().replace(/\/$/, '');
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
  const res = await fetch(`${base}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any).error || `Login failed with status ${res.status}`);
  }

  if (data.token) {
    await setSession(data.token, data.user);
  }
  return data;
}

/**
 * Verifies current token validity
 */
export async function verifySession(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session.token) return null;

  const base = await getApiBase();
  try {
    const res = await fetch(`${base}/users/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        await clearSession();
      }
      return null;
    }

    const user = (await res.json()) as AuthUser;
    await chrome.storage.local.set({ authUser: user });
    return user;
  } catch (err) {
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
  isPinned = false
}: SaveBookmarkParams): Promise<{ success: boolean; bookmarkId: string }> {
  const session = await getSession();
  if (!session.token) {
    throw new Error('Please sign in to Markbel to save bookmarks.');
  }

  const base = await getApiBase();
  const bookmarkId = crypto.randomUUID();
  const changeId = crypto.randomUUID();
  const now = new Date().toISOString();

  const payload = {
    id: bookmarkId,
    url: url.trim(),
    title: (title || url).trim(),
    description: (description || '').trim(),
    image: (image || '').trim(),
    favicon: (favicon || '').trim(),
    siteName: (siteName || '').trim(),
    group: group || 'Unsorted',
    isRead: false,
    isPinned: Boolean(isPinned),
    createdAt: now,
    updatedAt: now
  };

  const body = {
    deviceId: 'browser-extension',
    changes: [
      {
        changeId,
        entityType: 'bookmark',
        entityId: bookmarkId,
        operation: 'create',
        baseVersion: 0,
        payload
      }
    ]
  };

  const res = await fetch(`${base}/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any).error || `Save failed with status ${res.status}`);
  }

  return { success: true, bookmarkId };
}
