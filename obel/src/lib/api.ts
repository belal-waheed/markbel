const BASE_URL = '/api'

// Session-based Circuit Breaker with TTL: if an endpoint fails with 404,
// skip future fetches for 5 minutes to prevent console spam.
const failedEndpoints = new Map<string, number>()
const CIRCUIT_BREAKER_TTL = 5 * 60 * 1000 // 5 minutes

function isConfigured(endpoint: string): boolean {
  const fullUrl = `${BASE_URL}${endpoint}`
  const failedAt = failedEndpoints.get(fullUrl)
  if (failedAt) {
    if (Date.now() - failedAt < CIRCUIT_BREAKER_TTL) return false
    failedEndpoints.delete(fullUrl) // TTL expired — allow retry
  }
  return true
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const fullUrl = `${BASE_URL}${endpoint}`

  let res: Response
  try {
    res = await fetch(fullUrl, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch (err: any) {
    throw new ApiError(`Network error: ${err.message || 'Fetch failed'}`, 0)
  }

  if (res.status === 404) {
    failedEndpoints.set(fullUrl, Date.now())
    throw new ApiError(`404: ${endpoint}`, 404)
  }

  if (!res.ok) {
    let errorMsg = `${options.method || 'GET'} ${endpoint} failed: ${res.status}`
    try {
      const body = await res.json()
      if (body.error) errorMsg = body.error
    } catch { /* ignore parse errors */ }
    throw new ApiError(errorMsg, res.status)
  }

  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    try {
      return await res.json()
    } catch (e: any) {
      throw new ApiError(`Invalid JSON response: ${e.message}`, res.status)
    }
  }

  const text = await res.text()
  try {
    return text ? JSON.parse(text) : ({} as T)
  } catch {
    return { status: res.status, text } as unknown as T
  }
}

/**
 * Raw request that propagates errors to the caller.
 * Use for auth endpoints where the caller needs to handle specific HTTP errors.
 */
export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return request<T>(endpoint, options)
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  if (!isConfigured(endpoint)) {
    console.warn(`[API] Circuit breaker active for ${endpoint}, returning empty result`)
    return [] as unknown as T
  }
  try {
    return await request<T>(endpoint)
  } catch (err: any) {
    console.error(`[API] GET ${endpoint} failed:`, err.message || err)
    return [] as unknown as T
  }
}

export async function apiPost<T>(endpoint: string, data: unknown): Promise<T> {
  if (!isConfigured(endpoint)) throw new Error(`Circuit breaker active for ${endpoint}`)
  return await request<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function apiPut<T>(endpoint: string, data: unknown): Promise<T> {
  if (!isConfigured(endpoint)) throw new Error(`Circuit breaker active for ${endpoint}`)
  return await request<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  if (!isConfigured(endpoint)) throw new Error(`Circuit breaker active for ${endpoint}`)
  return await request<T>(endpoint, { method: 'DELETE' })
}
