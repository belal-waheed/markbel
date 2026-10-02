import { SyncManager, SyncState, ApiClient } from '@/sync';
import { WebSyncStorage } from './adapters/WebSyncStorage';
import { WebEnvironment } from './adapters/WebEnvironment';
import { resolveApiUrl } from '@/lib/api';

const storage = new WebSyncStorage();
const env = new WebEnvironment();

async function getAuthHeaders(extraHeaders?: any): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extraHeaders };
  let token: string | null = null;
  
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get('authToken');
    token = data.authToken;
  }
  if (!token && typeof window !== 'undefined' && window.localStorage) {
    token = localStorage.getItem('markbel_token');
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

import { ofetch } from 'ofetch';

const baseClient = ofetch.create({
  retry: 1,
  retryDelay: 500,
  async onRequest({ options }) {
    options.headers = await getAuthHeaders(options.headers);
  }
});

async function asyncResolveApiUrl(path: string): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    let base = 'https://mark.obel.workers.dev/api';
    if (chrome.storage && chrome.storage.local) {
      try {
        const data = await chrome.storage.local.get('apiUrl');
        if (data?.apiUrl && typeof data.apiUrl === 'string') {
          let clean = data.apiUrl.trim().replace(/\/$/, '');
          if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
            clean = clean.startsWith('localhost') || clean.startsWith('127.0.0.1') ? 'http://' + clean : 'https://' + clean;
          }
          if (!clean.endsWith('/api')) clean += '/api';
          base = clean;
        }
      } catch (err) {
        console.warn('[SyncManager] Failed to read apiUrl from chrome.storage:', err);
      }
    }
    const cleanPath = path.startsWith('/api/') ? path.slice(4) : path;
    const normalizedPath = cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
    return base + normalizedPath;
  }
  return resolveApiUrl(path);
}
const apiClient: ApiClient = {
  get: async (endpoint: string, headers?: any, signal?: AbortSignal) => {
    let cursor = 0;
    try {
      const match = endpoint.match(/[?&]cursor=(\d+)/);
      if (match) {
        cursor = parseInt(match[1], 10);
      } else if (headers && typeof headers['If-None-Match'] === 'string') {
        const hMatch = headers['If-None-Match'].match(/cursor-(\d+)/);
        if (hMatch) cursor = parseInt(hMatch[1], 10);
      }
    } catch {}

    try {
      const res = await baseClient(await asyncResolveApiUrl(endpoint), {
        method: 'GET',
        headers,
        signal
      });
      if (res === null || res === undefined) {
        return { changes: [], nextCursor: cursor, hasMore: false, notModified: true };
      }
      return res;
    } catch (err: any) {
      if (
        err?.status === 304 ||
        err?.statusCode === 304 ||
        err?.response?.status === 304
      ) {
        return { changes: [], nextCursor: cursor, hasMore: false, notModified: true };
      }
      throw err;
    }
  },
  post: async (endpoint: string, data: any, headers?: any, signal?: AbortSignal) => {
    return await baseClient(await asyncResolveApiUrl(endpoint), {
      method: 'POST',
      headers,
      body: data,
      signal
    });
  },
  put: async (endpoint: string, data: any, headers?: any, signal?: AbortSignal) => {
    return await baseClient(await asyncResolveApiUrl(endpoint), {
      method: 'PUT',
      headers,
      body: data,
      signal
    });
  }
};

export const syncManager = new SyncManager({
  storage,
  connectivity: env,
  lifecycle: env,
  apiClient
});

export { SyncState };



