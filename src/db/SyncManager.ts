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
  retry: 3,
  retryDelay: 1000,
  async onRequest({ options }) {
    options.headers = await getAuthHeaders(options.headers);
    options.credentials = 'include';
  }
});

async function asyncResolveApiUrl(path: string): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get('apiUrl');
    if (data.apiUrl) {
       let clean = data.apiUrl.trim().replace(/\/$/, '');
       if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
          clean = clean.startsWith('localhost') || clean.startsWith('127.0.0.1') ? 'http://' + clean : 'https://' + clean;
       }
       if (!clean.endsWith('/api')) clean += '/api';
       const cleanPath = path.startsWith('/api/') ? path.slice(4) : path;
       const normalizedPath = cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
       return clean + normalizedPath;
    }
  }
  return resolveApiUrl(path);
}
const apiClient: ApiClient = {
  get: async (endpoint: string, headers?: any, signal?: AbortSignal) => {
    return await baseClient(await asyncResolveApiUrl(endpoint), {
      method: 'GET',
      headers,
      signal
    });
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



