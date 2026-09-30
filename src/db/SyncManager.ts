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

const apiClient: ApiClient = {
  get: async (endpoint: string, headers?: any, signal?: AbortSignal) => {
    return await baseClient(resolveApiUrl(endpoint), {
      method: 'GET',
      headers,
      signal
    });
  },
  post: async (endpoint: string, data: any, headers?: any, signal?: AbortSignal) => {
    return await baseClient(resolveApiUrl(endpoint), {
      method: 'POST',
      headers,
      body: data,
      signal
    });
  },
  put: async (endpoint: string, data: any, headers?: any, signal?: AbortSignal) => {
    return await baseClient(resolveApiUrl(endpoint), {
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
