import { SyncManager, SyncState, ApiClient } from '@/sync';
import { WebSyncStorage } from './adapters/WebSyncStorage';
import { WebEnvironment } from './adapters/WebEnvironment';
import { resolveApiUrl } from '@/lib/api';

const storage = new WebSyncStorage();
const env = new WebEnvironment();

function getAuthHeaders(extraHeaders?: any): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = typeof window !== 'undefined' ? localStorage.getItem('markbel_token') : null;
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

const apiClient: ApiClient = {
  get: async (endpoint: string, headers?: any, signal?: AbortSignal) => {
    const res = await fetch(resolveApiUrl(endpoint), {
      headers: getAuthHeaders(headers),
      signal,
      credentials: 'include'
    });
    if (!res.ok) {
      const err: any = new Error(`Pull request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  },
  post: async (endpoint: string, data: any, headers?: any, signal?: AbortSignal) => {
    const res = await fetch(resolveApiUrl(endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders(headers) },
      body: JSON.stringify(data),
      signal,
      credentials: 'include'
    });
    if (!res.ok) {
      const err: any = new Error(`Push request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  },
  put: async (endpoint: string, data: any, headers?: any, signal?: AbortSignal) => {
    const res = await fetch(resolveApiUrl(endpoint), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders(headers) },
      body: JSON.stringify(data),
      signal,
      credentials: 'include'
    });
    if (!res.ok) {
      const err: any = new Error(`Put request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  }
};

export const syncManager = new SyncManager({
  storage,
  connectivity: env,
  lifecycle: env,
  apiClient
});

export { SyncState };
