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
  async get<T>(path: string): Promise<T> {
    const res = await fetch(resolveApiUrl(path), {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include'
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
      credentials: 'include',
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
      credentials: 'include',
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
      credentials: 'include',
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
      headers: getHeaders(),
      credentials: 'include'
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
  }
}

