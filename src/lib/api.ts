import { Capacitor } from '@capacitor/core'

export interface APIResponse<T = any> {
  data?: T
  error?: string
}

export class ApiError extends Error {
  status: number
  data?: any

  constructor(message: string, status: number, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export const getApiBase = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '')
  }
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    return 'https://mark.obel.workers.dev/api'
  }
  if (Capacitor.isNativePlatform()) {
    return 'https://mark.obel.workers.dev/api'
  }
  return '/api'
}

export const resolveApiUrl = (path: string): string => {
  const base = getApiBase()
  // Strip leading /api if present to avoid /api/api duplication when base has /api
  const cleanPath = path.startsWith('/api/') ? path.slice(4) : path
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`

  if (base.endsWith('/api') && normalizedPath.startsWith('/')) {
    return `${base}${normalizedPath}`
  }
  return `${base}${normalizedPath}`
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  const token = typeof window !== 'undefined' ? localStorage.getItem('markbel_token') : null
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export const api = {
  async get<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(resolveApiUrl(path), {
      ...options,
      method: 'GET',
      headers: {
        ...getHeaders(),
        ...(options?.headers ? (options.headers as Record<string, string>) : {})
      },
      signal: options?.signal
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new ApiError(data.error || `Request failed with status ${res.status}`, res.status, data)
    }
    return data as T
  },

  async post<T>(path: string, body: any): Promise<T> {
    const res = await fetch(resolveApiUrl(path), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new ApiError(data.error || `Request failed with status ${res.status}`, res.status, data)
    }
    return data as T
  },

  async put<T>(path: string, body: any): Promise<T> {
    const res = await fetch(resolveApiUrl(path), {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new ApiError(data.error || `Request failed with status ${res.status}`, res.status, data)
    }
    return data as T
  },

  async patch<T>(path: string, body?: any): Promise<T> {
    const res = await fetch(resolveApiUrl(path), {
      method: 'PATCH',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new ApiError(data.error || `Request failed with status ${res.status}`, res.status, data)
    }
    return data as T
  },

  async delete<T>(path: string, body?: any): Promise<T> {
    const opts: RequestInit = {
      method: 'DELETE',
      headers: getHeaders()
    }
    if (body) {
      opts.body = JSON.stringify(body)
    }
    const res = await fetch(resolveApiUrl(path), opts)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new ApiError(data.error || `Request failed with status ${res.status}`, res.status, data)
    }
    return data as T
  },

  async getTokens(): Promise<ApiToken[]> {
    return getTokens();
  },

  async createToken(data: CreateTokenRequest): Promise<CreateTokenResponse> {
    return createToken(data);
  },

  async deleteToken(id: string): Promise<{ success: boolean }> {
    return deleteToken(id);
  },

  agent: {
    searchBookmarks(params?: AgentBookmarkSearchParams): Promise<AgentBookmarkSearchResponse> {
      return agentApi.searchBookmarks(params);
    },
    getBookmark(id: string): Promise<any> {
      return agentApi.getBookmark(id);
    },
    createBookmark(data: AgentCreateBookmarkRequest): Promise<any> {
      return agentApi.createBookmark(data);
    },
    updateBookmark(id: string, data: AgentUpdateBookmarkRequest): Promise<any> {
      return agentApi.updateBookmark(id, data);
    },
    deleteBookmark(id: string): Promise<{ success: boolean; id: string }> {
      return agentApi.deleteBookmark(id);
    },
    batchMutateBookmarks(operations: AgentBatchOperation[]): Promise<AgentBatchResponse> {
      return agentApi.batchMutateBookmarks(operations);
    },
    getGroups(): Promise<{ groups: AgentGroup[] }> {
      return agentApi.getGroups();
    },
    getRules(): Promise<{ rules: any[] }> {
      return agentApi.getRules();
    },
    saveRules(rules: any[]): Promise<{ success: boolean; rules: any[] }> {
      return agentApi.saveRules(rules);
    },
    getSettings(): Promise<{ settings: Record<string, any> }> {
      return agentApi.getSettings();
    },
    updateSettings(settings: Record<string, any>): Promise<{ success: boolean; settings: Record<string, any> }> {
      return agentApi.updateSettings(settings);
    },
    getStats(): Promise<AgentVaultStats> {
      return agentApi.getStats();
    },
    getOpenApiSpec(): Promise<any> {
      return agentApi.getOpenApiSpec();
    }
  }
}

export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateTokenRequest {
  name: string;
  scopes: string[];
  expiresInDays?: number | null;
}

export interface CreateTokenResponse {
  id: string;
  name: string;
  token: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
}

export async function getTokens(): Promise<ApiToken[]> {
  const res = await api.get<ApiToken[] | { tokens: ApiToken[] }>('/tokens');
  return Array.isArray(res) ? res : (res.tokens || []);
}

export async function createToken(data: CreateTokenRequest): Promise<CreateTokenResponse> {
  return await api.post<CreateTokenResponse>('/tokens', data);
}

export async function deleteToken(id: string): Promise<{ success: boolean }> {
  return await api.delete<{ success: boolean }>(`/tokens/${encodeURIComponent(id)}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AGENT REST API INTERFACES & CLIENT METHODS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AgentBookmarkSearchParams {
  q?: string;
  group?: string;
  is_read?: 'true' | 'false' | boolean;
  is_archived?: 'true' | 'false' | 'all' | boolean;
  is_pinned?: 'true' | 'false' | boolean;
  include_content?: 'true' | 'false' | boolean;
  limit?: number;
  offset?: number;
}

export interface AgentBookmarkSearchResponse {
  items: any[];
  total: number;
  limit: number;
  offset: number;
}

export interface AgentCreateBookmarkRequest {
  url: string;
  title?: string;
  description?: string;
  group?: string;
  isPinned?: boolean;
  remindAt?: string;
}

export interface AgentUpdateBookmarkRequest {
  title?: string;
  description?: string;
  group?: string;
  isRead?: boolean;
  isPinned?: boolean;
  remindAt?: string;
  isArchived?: boolean;
}

export interface AgentBatchOperation {
  action: 'update' | 'archive' | 'delete';
  id: string;
  data?: Partial<AgentUpdateBookmarkRequest>;
}

export interface AgentBatchResponse {
  success: boolean;
  processed: number;
}

export interface AgentGroup {
  id: string;
  name: string;
  color: string;
  bookmarkCount: number;
}

export interface AgentVaultStats {
  totalBookmarks: number;
  unreadCount: number;
  archivedCount: number;
  groupsCount: number;
  latestSyncSequence: number;
}

export interface VaultCollaborator {
  id: string;
  owner_id: string;
  collaborator_user_id: string | null;
  collaborator_email: string;
  role: 'viewer' | 'editor';
  status: 'pending' | 'accepted';
  invite_token: string;
  invite_link?: string;
  created_at: string;
  accepted_at?: string | null;
}

export interface InviteCollaboratorRequest {
  email: string;
  role?: 'viewer' | 'editor';
}

export const agentApi = {
  async searchBookmarks(params: AgentBookmarkSearchParams = {}): Promise<AgentBookmarkSearchResponse> {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.group) searchParams.set('group', params.group);
    if (params.is_read !== undefined) searchParams.set('is_read', String(params.is_read));
    if (params.is_archived !== undefined) searchParams.set('is_archived', String(params.is_archived));
    if (params.is_pinned !== undefined) searchParams.set('is_pinned', String(params.is_pinned));
    if (params.include_content !== undefined) searchParams.set('include_content', String(params.include_content));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.offset !== undefined) searchParams.set('offset', String(params.offset));

    const qs = searchParams.toString();
    const endpoint = `/agent/v1/bookmarks/search${qs ? `?${qs}` : ''}`;
    return await api.get<AgentBookmarkSearchResponse>(endpoint);
  },

  async getBookmark(id: string): Promise<any> {
    return await api.get<any>(`/agent/v1/bookmarks/${encodeURIComponent(id)}`);
  },

  async createBookmark(data: AgentCreateBookmarkRequest): Promise<any> {
    return await api.post<any>('/agent/v1/bookmarks', data);
  },

  async updateBookmark(id: string, data: AgentUpdateBookmarkRequest): Promise<any> {
    return await api.patch<any>(`/agent/v1/bookmarks/${encodeURIComponent(id)}`, data);
  },

  async deleteBookmark(id: string): Promise<{ success: boolean; id: string }> {
    return await api.delete<{ success: boolean; id: string }>(`/agent/v1/bookmarks/${encodeURIComponent(id)}`);
  },

  async batchMutateBookmarks(operations: AgentBatchOperation[]): Promise<AgentBatchResponse> {
    return await api.post<AgentBatchResponse>('/agent/v1/bookmarks/batch', { operations });
  },

  async getGroups(): Promise<{ groups: AgentGroup[] }> {
    return await api.get<{ groups: AgentGroup[] }>('/agent/v1/groups');
  },

  async getRules(): Promise<{ rules: any[] }> {
    return await api.get<{ rules: any[] }>('/agent/v1/rules');
  },

  async saveRules(rules: any[]): Promise<{ success: boolean; rules: any[] }> {
    return await api.put<{ success: boolean; rules: any[] }>('/agent/v1/rules', { rules });
  },

  async getSettings(): Promise<{ settings: Record<string, any> }> {
    return await api.get<{ settings: Record<string, any> }>('/agent/v1/settings');
  },

  async updateSettings(settings: Record<string, any>): Promise<{ success: boolean; settings: Record<string, any> }> {
    return await api.patch<{ success: boolean; settings: Record<string, any> }>('/agent/v1/settings', { settings });
  },

  async getStats(): Promise<AgentVaultStats> {
    return await api.get<AgentVaultStats>('/agent/v1/stats');
  },

  async listCollaborators(): Promise<{ collaborators: VaultCollaborator[] }> {
    return await api.get<{ collaborators: VaultCollaborator[] }>('/agent/v1/collaborators');
  },

  async inviteCollaborator(data: InviteCollaboratorRequest): Promise<VaultCollaborator> {
    return await api.post<VaultCollaborator>('/agent/v1/collaborators', data);
  },

  async deleteCollaborator(id: string): Promise<{ success: boolean; id: string }> {
    return await api.delete<{ success: boolean; id: string }>(`/agent/v1/collaborators/${encodeURIComponent(id)}`);
  },

  async acceptCollaboratorInvite(inviteToken: string): Promise<{ success: boolean; vault_id: string; role: string; status: string }> {
    return await api.post<{ success: boolean; vault_id: string; role: string; status: string }>('/agent/v1/collaborators/accept', { inviteToken });
  },

  async listSharedVaults(): Promise<{ shared_vaults: any[] }> {
    return await api.get<{ shared_vaults: any[] }>('/agent/v1/collaborators/shared-vaults');
  },

  async getOpenApiSpec(): Promise<any> {
    return await api.get<any>('/agent/v1/openapi.json');
  },
};




