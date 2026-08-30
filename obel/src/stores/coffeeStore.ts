import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '@/lib/storage'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { db } from '@/lib/db'
import { useAuthStore } from './authStore'

export interface CoffeeEntry {
  id: string
  userId: string
  type: string
  caffeineMg: number
  mood: string
  timestamp: string
}

function mergeLogs(apiLogs: CoffeeEntry[], localLogs: CoffeeEntry[], userId: string): CoffeeEntry[] {
  const apiIds = new Set(apiLogs.map((l) => l.id))
  const apiKeys = new Set(apiLogs.map((l) => `${l.type}|${l.timestamp}`))

  const localOnly = localLogs.filter((l) => {
    if (l.userId !== userId) return false
    if (apiIds.has(l.id)) return false
    
    if (l.id.startsWith('temp-')) {
      if (apiKeys.has(`${l.type}|${l.timestamp}`)) return false
    } else {
      return false
    }
    return true
  })

  return [...apiLogs, ...localOnly].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

interface CoffeeState {
  logs: CoffeeEntry[]
  isLoading: boolean
  error: string | null

  fetchLogs: () => Promise<void>
  addLog: (entry: Omit<CoffeeEntry, 'id' | 'timestamp' | 'userId'>) => Promise<void>
  deleteLog: (id: string) => Promise<void>
  
  // Helpers
  getCupsToday: () => number
  getCurrentCaffeineLevel: () => number // 0-100 based on decay
}

export const useCoffeeStore = create<CoffeeState>()(
  persist(
    (set, get) => ({
      logs: [],
      isLoading: false,
      error: null,

      fetchLogs: async () => {
        const userId = useAuthStore.getState().user?.id
        if (!userId) return

        const hasLocal = get().logs.some((l) => l.userId === userId)
        if (!hasLocal) set({ isLoading: true, error: null })

        try {
          const raw = await apiGet<CoffeeEntry[]>(`/coffee?userId=${userId}`)
          const apiLogs = Array.isArray(raw) ? raw : []
          const merged = mergeLogs(apiLogs, get().logs, userId)
          set({ logs: merged, isLoading: false, error: null })
        } catch {
          set({ isLoading: false, error: null })
        }
      },

      addLog: async (data) => {
        const userId = useAuthStore.getState().user?.id
        if (!userId) return
        
        const tempId = `temp-${crypto.randomUUID()}`
        const newEntry: CoffeeEntry = {
          ...data,
          id: tempId,
          userId,
          timestamp: new Date().toISOString(),
        }

        // Optimistic update
        set((s) => ({ logs: [newEntry, ...s.logs] }))

        try {
          const saved = await apiPost<CoffeeEntry>('/coffee', { ...newEntry, id: undefined })
          if (saved && saved.id) {
            set((s) => ({ 
              logs: s.logs.map((l) => (l.id === tempId ? saved : l))
            }))
          }
          
          // Update the legacy counter in authStore for compatibility
          const authStore = useAuthStore.getState()
          if (authStore.user) {
             authStore.updateUser({ 
               coffeeCups: (authStore.user.coffeeCups || 0) + 1 
             })
          }
          
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(20)
          }
        } catch (err: unknown) {
          console.warn('Network error: coffee log stored locally for background sync')
          await db.queueSync('/coffee', 'POST', { ...newEntry, id: undefined })
        }
      },

      deleteLog: async (id) => {
        // Optimistic delete — remove locally first for instant UX
        set((s) => ({ logs: s.logs.filter((l) => l.id !== id) }))

        // Skip API for temp IDs (never reached the server)
        if (id.startsWith('temp-')) return

        apiDelete(`/coffee/${id}`)
          .catch(async () => {
            console.warn('Network error: deleteLog queued for background sync')
            await db.queueSync(`/coffee/${id}`, 'DELETE', null)
          })
      },

      getCupsToday: () => {
        const today = new Date().toDateString()
        return get().logs.filter(
          (l) => new Date(l.timestamp).toDateString() === today
        ).length
      },

      getCurrentCaffeineLevel: () => {
        if (get().logs.length === 0) return 0
        const sortedLogs = [...get().logs].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        const lastLog = sortedLogs[0]
        const lastTime = new Date(lastLog.timestamp).getTime()
        const now = Date.now()
        const diffMinutes = (now - lastTime) / (1000 * 60)
        
        // Decay calculation (5-hour half-life)
        const decayMinutes = 300 
        const level = Math.max(0, 100 - (diffMinutes / decayMinutes) * 100)
        return Math.round(level)
      },
    }),
    {
      name: 'obel-coffee',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({ logs: state.logs }),
    }
  )
)
