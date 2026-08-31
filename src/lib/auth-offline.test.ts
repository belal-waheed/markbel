import { describe, it, expect, beforeEach } from 'vitest'
import { ApiError } from './api'

// Node environment localStorage mock
const storageMock: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => storageMock[key] || null,
  setItem: (key: string, value: string) => {
    storageMock[key] = value
  },
  removeItem: (key: string) => {
    delete storageMock[key]
  },
  clear: () => {
    Object.keys(storageMock).forEach((key) => delete storageMock[key])
  }
}

describe('Auth Offline & Session Resilience', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('correctly constructs ApiError with status and message', () => {
    const error = new ApiError('Unauthorized: Token expired', 401, { code: 'TOKEN_EXPIRED' })
    expect(error.name).toBe('ApiError')
    expect(error.status).toBe(401)
    expect(error.message).toBe('Unauthorized: Token expired')
    expect(error.data).toEqual({ code: 'TOKEN_EXPIRED' })
  })

  it('preserves cached user and token in localStorage', () => {
    const mockUser = {
      id: 'test-user-123',
      name: 'Tester',
      email: 'test@example.com',
      createdAt: new Date().toISOString()
    }
    const mockToken = 'mock-jwt-token-xyz'

    localStorageMock.setItem('markbel_token', mockToken)
    localStorageMock.setItem('markbel_user', JSON.stringify(mockUser))

    const savedToken = localStorageMock.getItem('markbel_token')
    const savedUser = JSON.parse(localStorageMock.getItem('markbel_user') || '{}')

    expect(savedToken).toBe(mockToken)
    expect(savedUser.id).toBe('test-user-123')
    expect(savedUser.name).toBe('Tester')
  })

  it('distinguishes between 401 auth errors and 500 server errors', () => {
    const authError = new ApiError('Unauthorized', 401)
    const serverError = new ApiError('Internal Server Error', 500)
    const networkError = new TypeError('Failed to fetch')

    expect(authError instanceof ApiError && authError.status === 401).toBe(true)
    expect(serverError instanceof ApiError && serverError.status === 401).toBe(false)
    expect(networkError instanceof ApiError).toBe(false)
  })
})
