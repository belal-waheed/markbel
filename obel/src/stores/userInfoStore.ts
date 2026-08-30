// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/stores/userInfoStore.ts
// PURPOSE: Zustand Store for UserInfo settings & rolling cumulative stats
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '../lib/storage'
import { IUserInfo, ITaskList } from '../types'
import { db } from '../lib/db'
import { checkAndRollOver } from '../lib/rollover'
import { apiGet, apiPut, apiPost, ApiError } from '../lib/api'
import { useAuthStore } from './authStore'
import dayjs from 'dayjs'

interface UserInfoState {
  userInfo: IUserInfo | null
  isLoading: boolean
  error: string | null

  fetchUserInfo: () => Promise<void>
  seedUserInfo: (userId: string) => Promise<void>
  updateUserInfoLocalAndSync: (updates: Partial<IUserInfo> | ((prev: IUserInfo) => IUserInfo)) => Promise<void>
  
  // XP & Levels
  addXP: (amount: number) => Promise<void>
  
  // Caffeine logs
  addCaffeine: (mg: number) => Promise<void>
  
  // Pomodoro sessions
  addPomodoro: (minutes: number) => Promise<void>
  
  // Habit completion tracking
  completeHabitToday: (habitId: string) => Promise<void>
  uncompleteHabitToday: (habitId: string) => Promise<void>
  
  // Task completion tracking
  completeTaskToday: (taskId: string) => Promise<void>
  
  // Lists and general settings
  updateSettings: (settings: Partial<IUserInfo['settings']>) => Promise<void>
  updateTaskLists: (lists: ITaskList[]) => Promise<void>
}

const DEFAULT_LISTS: ITaskList[] = [
  { id: 'imp', title: 'IMP', order: 0 },
  { id: 'fast', title: 'Fast', order: 1 },
  { id: 'later', title: 'Later', order: 2 }
]

export const useUserInfoStore = create<UserInfoState>()(
  persist(
    (set, get) => ({
      userInfo: null,
      isLoading: false,
      error: null,

      fetchUserInfo: async () => {
        const userId = useAuthStore.getState().user?.id
        if (!userId) return

        if (get().isLoading) {
          console.log('[UserInfoStore] fetchUserInfo is already in progress, skipping concurrent call')
          return
        }

        set({ isLoading: true, error: null })

        // 1. Try local Dexie database first (Primary high-performance load)
        let localInfo = await db.userInfo.where({ userId }).first()

        if (localInfo) {
          // Perform local rollover check
          const rolledOver = checkAndRollOver(localInfo)
          if (rolledOver) {
            console.log('[UserInfoStore] Rollover occurred offline/locally. Updating local DB.')
            await db.userInfo.put(rolledOver)
            localInfo = rolledOver

            // Queue background sync for the rollover since it is a write operation
            await db.syncQueue.put({
              path: `/users/info/${userId}`,
              method: 'PUT',
              payload: rolledOver,
              timestamp: Date.now()
            })
          }
          set({ userInfo: localInfo, isLoading: false })
        }

        // 2. Fetch authoritative state from backend if online
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const raw = await apiGet<Record<string, unknown>>(`/users/info?userId=${userId}`)
            if (raw && raw.id) {
              let serverInfo = raw as unknown as IUserInfo

              // Sync check: Last-Update-Wins (LWW) conflict check
              if (localInfo) {
                const clientTime = new Date(localInfo.updatedAt).getTime()
                const serverTime = new Date(serverInfo.updatedAt).getTime()

                // If local client has unsynced updates, trust local client
                if (clientTime > serverTime) {
                  serverInfo = localInfo
                  // Sync local to server
                  await apiPut(`/users/info/${userId}`, localInfo)
                }
              }

              // Run rollover engine on server state in case server missed it
              const rolledOver = checkAndRollOver(serverInfo)
              if (rolledOver) {
                serverInfo = rolledOver
                await apiPut(`/users/info/${userId}`, serverInfo)
              }

              // Update local Dexie database and Zustand state
              await db.userInfo.put(serverInfo)
              set({ userInfo: serverInfo, isLoading: false, error: null })
            } else {
              // No user info exists on backend yet; seed it
              await get().seedUserInfo(userId)
            }
          } catch (err: any) {
            console.warn('[UserInfoStore] Failed to fetch server info, fallback to local', err)
            set({ isLoading: false })
          }
        } else {
          set({ isLoading: false })
        }
      },

      seedUserInfo: async (userId) => {
        const now = new Date().toISOString()
        const initialInfo: IUserInfo = {
          id: crypto.randomUUID(),
          userId,
          xp: 0,
          taskLists: DEFAULT_LISTS,
          settings: {
            theme: 'deep-plum',
            soundEnabled: true,
            hapticsEnabled: true
          },
          today: {
            dateStr: dayjs().format('YYYY-MM-DD'),
            caffeineMg: 0,
            caffeineLogs: [],
            pomoMinutes: 0,
            pomoSessions: 0,
            habitsCompleted: [],
            tasksCompleted: []
          },
          stats: {
            lifetimeCaffeineMg: 0,
            lifetimeCaffeineCups: 0,
            lifetimePomoMinutes: 0,
            lifetimePomoSessions: 0,
            lifetimeHabitsCount: 0,
            caffeineHistory30Days: [],
            pomoHistory30Days: [],
            habitsHistory30Days: []
          },
          createdAt: now,
          updatedAt: now
        }

        set({ userInfo: initialInfo })
        await db.userInfo.put(initialInfo)

        try {
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            await apiPost('/users/info', initialInfo)
          } else {
            await db.queueSync('/users/info', 'POST', initialInfo)
          }
        } catch (err: any) {
          if (err instanceof ApiError && err.status === 409) {
            console.log('[UserInfoStore] UserInfo already seeded on server, skipping sync queue.')
          } else {
            await db.queueSync('/users/info', 'POST', initialInfo)
          }
        }
      },

      /**
       * Unified helper to commit local mutations to Zustand + Dexie,
       * and queue them for PWA background synchronization.
       */
      updateUserInfoLocalAndSync: async (updatesOrFn) => {
        const { userInfo } = get()
        if (!userInfo) return

        let updatedInfo = { ...userInfo }

        if (typeof updatesOrFn === 'function') {
          updatedInfo = updatesOrFn(updatedInfo)
        } else {
          Object.assign(updatedInfo, updatesOrFn)
        }

        updatedInfo.updatedAt = new Date().toISOString()

        // 1. Commits optimistically to Zustand store
        set({ userInfo: updatedInfo })

        // 2. Commits asynchronously to local Dexie IndexedDB
        await db.userInfo.put(updatedInfo)

        // 3. Commit/Queue sync
        const userId = userInfo.userId
        try {
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            await apiPut(`/users/info/${userId}`, updatedInfo)
          } else {
            await db.queueSync(`/users/info/${userId}`, 'PUT', updatedInfo)
          }
        } catch {
          await db.queueSync(`/users/info/${userId}`, 'PUT', updatedInfo)
        }
      },

      addXP: async (amount) => {
        await get().updateUserInfoLocalAndSync((prev) => {
          const newXp = prev.xp + amount
          const oldLevel = Math.floor(prev.xp / 500) + 1
          const newLevel = Math.floor(newXp / 500) + 1

          if (newLevel > oldLevel) {
            // Trigger levelling effects lazily
            import('canvas-confetti').then((confetti) => {
              confetti.default({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
            }).catch(() => {})
          }
          prev.xp = newXp
          return prev
        })
      },

      addCaffeine: async (mg) => {
        await get().updateUserInfoLocalAndSync((prev) => {
          const time = dayjs().format('HH:mm')
          prev.today.caffeineMg += mg
          prev.today.caffeineLogs = [...(prev.today.caffeineLogs || []), { time, mg }]
          return prev
        })
      },

      addPomodoro: async (minutes) => {
        await get().updateUserInfoLocalAndSync((prev) => {
          prev.today.pomoMinutes += minutes
          prev.today.pomoSessions += 1
          return prev
        })
      },

      completeHabitToday: async (habitId) => {
        await get().updateUserInfoLocalAndSync((prev) => {
          const completed = prev.today.habitsCompleted || []
          if (!completed.includes(habitId)) {
            prev.today.habitsCompleted = [...completed, habitId]
          }
          return prev
        })
      },

      uncompleteHabitToday: async (habitId) => {
        await get().updateUserInfoLocalAndSync((prev) => {
          const completed = prev.today.habitsCompleted || []
          prev.today.habitsCompleted = completed.filter(id => id !== habitId)
          return prev
        })
      },

      completeTaskToday: async (taskId) => {
        await get().updateUserInfoLocalAndSync((prev) => {
          const completed = prev.today.tasksCompleted || []
          if (!completed.includes(taskId)) {
            prev.today.tasksCompleted = [...completed, taskId]
          }
          return prev
        })
      },

      updateSettings: async (settings) => {
        await get().updateUserInfoLocalAndSync((prev) => {
          prev.settings = { ...prev.settings, ...settings }
          return prev
        })
      },

      updateTaskLists: async (taskLists) => {
        await get().updateUserInfoLocalAndSync((prev) => {
          prev.taskLists = taskLists
          return prev
        })
      }
    }),
    {
      name: 'obel-user-info-v2',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({ userInfo: state.userInfo })
    }
  )
)
