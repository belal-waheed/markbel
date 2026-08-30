import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '@/lib/storage'
import { apiGet, apiPost, apiPut, apiRequest } from '@/lib/api'
import { db } from '@/lib/db'

export interface UserProfile {
  id: string
  name: string
  email: string
  password?: string
  avatar: string
  pomodoroSettings: any
  sessionHistory: any[]
  totalFocusHours: string
  createdAt: string
  unlockedThemes?: string[]
  activeTheme?: string
  partnerId?: string
  coffeeCups: number
  xp: number
  level: number
  longestFocusStreak: number
  lastFocusDate?: string
  coffeeLog?: any[]
  taskLists?: any[]
  noteFolders?: any[]
  noteSettings?: {
    fontSize: string
    lineHeight: string
    editorTheme: string
    fontFamily: string
  }
  openNoteIds?: string[]
}

function normalizeUser(user: any): UserProfile {
  const u = { ...user }
  const fields = ['pomodoroSettings', 'sessionHistory', 'taskLists', 'noteFolders', 'coffeeLog', 'unlockedThemes', 'noteSettings', 'openNoteIds']
  fields.forEach(field => {
    if (typeof u[field] === 'string') {
      try { u[field] = JSON.parse(u[field]) } catch { /* keep as is */ }
    }
  })
  return u as UserProfile
}


interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  isOffline: boolean
  _hasHydrated: boolean

  login: (email: string, password: string) => Promise<boolean>
  signup: (name: string, email: string, password: string) => Promise<boolean>
  logout: () => void
  updateUser: (data: Partial<UserProfile>) => Promise<void>
  refreshUser: () => Promise<void>
  addXP: (amount: number) => Promise<void>
  trackCoffee: () => Promise<void>
  clearError: () => void
  setHasHydrated: (val: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isOffline: false,
      _hasHydrated: false,

      login: async (email, password) => {
        set({ isLoading: true, error: null })

        // ── OFFLINE FALLBACK ─────────────────────────────────────────
        // If we already have a persisted user with this email,
        // allow offline login (password is never stored locally).
        const cached = get().user
        if (cached && cached.email === email && !navigator.onLine) {
          set({ isAuthenticated: true, isLoading: false, error: null, isOffline: true })
          return true
        }

        try {
          const raw = await apiRequest<any>('/users/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          })

          if (!raw || !raw.id) {
            set({ isLoading: false, error: 'Login failed' })
            return false
          }

          const user = normalizeUser(raw)
          set({ user, isAuthenticated: true, isLoading: false, error: null, isOffline: false })
          return true
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : ''
          // Handle specific API errors
          if (message.includes('401') || message.includes('Incorrect') || message.includes('No account')) {
            set({ isLoading: false, error: message.includes('No account') ? 'No account found with this email' : 'Incorrect password' })
            return false
          }
          // Network error — try offline fallback
          if (cached && cached.email === email) {
            set({
              isAuthenticated: true,
              isLoading: false,
              error: null,
              isOffline: true,
            })
            return true
          }
          set({
            isLoading: false,
            error: 'Network unavailable. Please check your connection.',
          })
          return false
        }
      },

      signup: async (name, email, password) => {
        set({ isLoading: true, error: null })
        try {
          const existing = await apiGet<UserProfile[]>(
            `/users?email=${encodeURIComponent(email)}`
          )
          if (existing.some((u) => u.email === email)) {
            set({ isLoading: false, error: 'An account with this email already exists' })
            return false
          }

          const raw = await apiPost<any>('/users', {
            name,
            email,
            password,
            avatar: '',
            pomodoroSettings: {
              focusDuration: 25,
              shortBreakDuration: 5,
              longBreakDuration: 15,
              longBreakInterval: 4,
              autoStartBreaks: false,
              autoStartFocus: false,
            },
            sessionHistory: [],
            totalFocusHours: '0',
            xp: 0,
            level: 1,
            coffeeCups: 0,
            longestFocusStreak: 0,
            createdAt: new Date().toISOString(),
          })

          const user = normalizeUser(raw)
          set({ user, isAuthenticated: true, isLoading: false, error: null, isOffline: false })
          return true
        } catch {
          set({ isLoading: false, error: 'Network error. Please try again.' })
          return false
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, error: null, isOffline: false })
      },

      updateUser: async (data) => {
        const { user } = get()
        if (!user) return
        
        // Always optimistic-update locally first so the UI is snappy
        set({ user: { ...user, ...data } })
        
        const { password, id, ...updatesOnly } = data as any
        try {
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            await apiPut<UserProfile>(`/users/${user.id}`, updatesOnly)
          } else {
            await db.queueSync(`/users/${user.id}`, 'PUT', updatesOnly)
          }
        } catch (err) {
          console.warn('Network error: updateUser queued for background sync', err)
          await db.queueSync(`/users/${user.id}`, 'PUT', updatesOnly)
        }
      },

      refreshUser: async () => {
        const { user } = get()
        if (!user) return
        try {
          const raw = await apiGet<any>(`/users/${user.id}`)
          if (raw && raw.id) {
            const updated = normalizeUser(raw)
            set({ user: updated })
          }
        } catch {
          // ignore
        }
      },

      addXP: async (amount) => {
        const { user } = get()
        if (!user) return
        const currentXP = user.xp || 0
        const newXP = currentXP + amount
        const newLevel = Math.floor(newXP / 500) + 1
        const currentLevel = user.level || 1

        await get().updateUser({ xp: newXP, level: newLevel })

        if (newLevel > currentLevel) {
          import('canvas-confetti').then((confetti) => {
            confetti.default({
              particleCount: 200,
              spread: 100,
              origin: { y: 0.6 },
            })
          })
        }
      },

      trackCoffee: async () => {
        const { user } = get()
        if (!user) return
        const log = Array.isArray(user.coffeeLog) ? user.coffeeLog : []
        const newLog = [...log, { id: crypto.randomUUID(), timestamp: new Date().toISOString() }]
        const newCount = (user.coffeeCups || 0) + 1
        
        await get().updateUser({ 
          coffeeCups: newCount, 
          coffeeLog: newLog 
        })
      },

      clearError: () => set({ error: null }),
      setHasHydrated: (val) => set({ _hasHydrated: val }),
    }),
    {
      name: 'obel-auth',
      storage: createJSONStorage(() => indexedDBStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
      partialize: (state) => {
        // Strip password from persisted state — never store it in IndexedDB
        const { password, ...safeUser } = state.user || {} as UserProfile
        return {
          user: state.user ? safeUser as UserProfile : null,
          isAuthenticated: state.isAuthenticated,
        }
      },
    }
  )
)
