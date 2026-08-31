import React, { createContext, useContext, useState, useEffect } from 'react'
import { api, ApiError } from './api.js'
import { syncManager } from '../db/SyncManager.js'

export interface UserProfile {
  id: string
  name: string
  email: string
  avatar?: string
  createdAt: string
}

export interface AuthContextType {
  user: UserProfile | null
  token: string | null
  loading: boolean
  isGuest: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return null
    const cached = localStorage.getItem('markbel_user')
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch {
        return null
      }
    }
    return null
  })

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('markbel_token')
  })

  const [loading, setLoading] = useState(true)

  const isGuest = !token

  const sendTokenToNative = (t: string | null) => {
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'TOKEN_SYNC', token: t })
      )
    }
  }

  useEffect(() => {
    async function bootstrap() {
      const savedToken = localStorage.getItem('markbel_token')
      const savedUser = localStorage.getItem('markbel_user')

      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser))
        } catch {}
      }

      if (!savedToken) {
        setLoading(false)
        return
      }

      setToken(savedToken)
      sendTokenToNative(savedToken)

      try {
        // Silent background validation of user session
        const profile = await api.get<UserProfile>('/users/me')
        if (profile && profile.id) {
          setUser(profile)
          localStorage.setItem('markbel_user', JSON.stringify(profile))
        }
        
        await syncManager.registerDevice('web', '1.0.0').catch(() => {})
        syncManager.startPeriodicSync()
      } catch (err: any) {
        console.warn('[Auth] Background profile verification notice:', err?.message || err)
        // Keep cached token and user to maintain offline-first capability
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const data = await api.post<{ token: string; user: UserProfile }>('/users/login', { email, password })
      localStorage.setItem('markbel_token', data.token)
      localStorage.setItem('markbel_user', JSON.stringify(data.user))
      setToken(data.token)
      setUser(data.user)
      sendTokenToNative(data.token)
      await syncManager.registerDevice('web', '1.0.0')
      syncManager.startPeriodicSync()
    } finally {
      setLoading(false)
    }
  }

  const signup = async (name: string, email: string, password: string) => {
    setLoading(true)
    try {
      const data = await api.post<{ token: string; user: UserProfile }>('/users/signup', { name, email, password })
      localStorage.setItem('markbel_token', data.token)
      localStorage.setItem('markbel_user', JSON.stringify(data.user))
      setToken(data.token)
      setUser(data.user)
      sendTokenToNative(data.token)
      await syncManager.registerDevice('web', '1.0.0')
      syncManager.startPeriodicSync()
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('markbel_token')
    localStorage.removeItem('markbel_user')
    setToken(null)
    setUser(null)
    sendTokenToNative(null)
    syncManager.stop()
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, isGuest, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

