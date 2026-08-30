import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '@/lib/storage'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { db } from '@/lib/db'
import { useAuthStore } from './authStore'
import dayjs from 'dayjs'

export interface Habit {
  id: string
  userId: string
  name: string
  description: string
  frequency: string
  completedDates: string[]
  currentStreak: number
  longestStreak: number
  createdAt: string
  icon?: string
  color?: string
  customDays?: number[]
  reminderTime?: string
  goalTarget?: number
  goalUnit?: string
  goalProgress?: Record<string, number>
  order?: number
  updatedAt: string
}

function normalizeHabit(habit: any): Habit {
  const h = { ...habit }
  if (typeof h.completedDates === 'string') {
    try { h.completedDates = JSON.parse(h.completedDates) } catch { h.completedDates = [] }
  }
  if (typeof h.customDays === 'string') {
    try { h.customDays = JSON.parse(h.customDays) } catch { h.customDays = [] }
  }
  if (typeof h.goalProgress === 'string') {
    try { h.goalProgress = JSON.parse(h.goalProgress) } catch { h.goalProgress = {} }
  }
  if (!Array.isArray(h.completedDates)) h.completedDates = []
  if (!Array.isArray(h.customDays)) h.customDays = []
  if (!h.goalProgress || typeof h.goalProgress !== 'object') h.goalProgress = {}
  if (!h.updatedAt) h.updatedAt = h.createdAt || new Date().toISOString()
  return h as Habit
}


interface HabitState {
  habits: Habit[]
  isLoading: boolean
  error: string | null

  fetchHabits: () => Promise<void>
  addHabit: (
    habit: Omit<
      Habit,
      'id' | 'userId' | 'completedDates' | 'currentStreak' | 'longestStreak' | 'createdAt' | 'updatedAt'
    >
  ) => Promise<void>
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  toggleHabitCompletion: (id: string, dateStr: string) => Promise<void>
  incrementHabitProgress: (id: string, dateStr: string) => Promise<void>
  decrementHabitProgress: (id: string, dateStr: string) => Promise<void>
}

function calculateStreaks(dates: string[]): {
  currentStreak: number
  longestStreak: number
} {
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 }

  const sorted = [...new Set(dates)].sort()
  const todayStr = dayjs().format('YYYY-MM-DD')
  const yesterdayStr = dayjs().subtract(1, 'day').format('YYYY-MM-DD')

  // Longest streak
  let longestStreak = 1
  let currentRun = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = dayjs(sorted[i]).diff(dayjs(sorted[i - 1]), 'day')
    if (diff === 1) {
      currentRun++
      longestStreak = Math.max(longestStreak, currentRun)
    } else if (diff > 1) {
      currentRun = 1
    }
  }

  // Current streak (must include today or yesterday)
  const lastDate = sorted[sorted.length - 1]
  let currentStreak = 0
  if (lastDate === todayStr || lastDate === yesterdayStr) {
    currentStreak = 1
    for (let i = sorted.length - 2; i >= 0; i--) {
      const expected = dayjs(lastDate)
        .subtract(currentStreak, 'day')
        .format('YYYY-MM-DD')
      if (sorted[i] === expected) {
        currentStreak++
      } else {
        break
      }
    }
  }

  return { currentStreak, longestStreak }
}

function mergeHabits(
  apiHabits: Habit[],
  localHabits: Habit[],
  userId: string,
  pendingIds: Set<string>
): Habit[] {
  const localMap = new Map(localHabits.map(h => [h.id, h]))
  
  const merged = apiHabits.map(apiHabit => {
    const localHabit = localMap.get(apiHabit.id)
    if (!localHabit) return apiHabit

    // Compare timestamps (fallback to createdAt)
    const apiTime = new Date(apiHabit.updatedAt || apiHabit.createdAt).getTime()
    const localTime = new Date(localHabit.updatedAt || localHabit.createdAt).getTime()

    if (apiTime > localTime) {
      return apiHabit
    } else if (localTime > apiTime) {
      return localHabit
    } else {
      // Same timestamp, preserve local reference if possible to avoid re-renders
      return localHabit
    }
  })

  // Add local-only habits (e.g. temp- IDs or unsynced offline habits)
  const apiIds = new Set(apiHabits.map(h => h.id))
  const localOnly = localHabits.filter(h => 
    h.userId === userId && 
    !apiIds.has(h.id) && 
    (h.id.startsWith('temp-') || pendingIds.has(h.id))
  )

  return [...merged, ...localOnly]
}

function syncHabitNotification(habit: Habit) {
  if (typeof window === 'undefined') return

  import('@/lib/notifications').then(async ({ notificationSystem }) => {
    // Cancel existing scheduled notification
    notificationSystem.cancelScheduled(`habit-${habit.id}`)

    // If no reminder time, we are done
    if (!habit.reminderTime) return

    // If Web Push is active, do not schedule local reminders
    const hasPush = await notificationSystem.hasActivePushSubscription()
    if (hasPush) return

    const [hourStr, minStr] = habit.reminderTime.split(':')
    const hour = parseInt(hourStr, 10)
    const min = parseInt(minStr, 10)

    let trigger = dayjs().hour(hour).minute(min).second(0).millisecond(0)
    const todayStr = dayjs().format('YYYY-MM-DD')
    const completedToday = habit.completedDates?.includes(todayStr)

    // If the reminder time has already passed today OR if already completed today,
    // schedule it for tomorrow!
    if (trigger.isBefore(dayjs()) || completedToday) {
      trigger = trigger.add(1, 'day')
    }

    const triggerMs = trigger.valueOf()

    notificationSystem.schedule(
      `Habit Reminder: ${habit.name}`,
      triggerMs,
      `habit-${habit.id}`,
      {
        body: `Don't break your streak! Time to complete your habit.`,
        icon: '/icons/badge-habit.png',
        badge: '/icons/badge-habit.svg',
        tag: `habit-${habit.id}`
      }
    )
  }).catch(() => {})
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      isLoading: false,
      error: null,

      fetchHabits: async () => {
        const userId = useAuthStore.getState().user?.id
        if (!userId) return

        // 1. Load local habits from Dexie first (Offline-first hydration!)
        try {
          const localHabits = await db.habits.where({ userId }).toArray()
          set({ habits: localHabits.map(normalizeHabit) })
        } catch (err) {
          console.error('[HabitStore] Failed to load local habits from Dexie:', err)
        }

        const hasLocal = get().habits.some((h) => h.userId === userId)
        if (!hasLocal) set({ isLoading: true, error: null })

        // ── OFFLINE GUARD ─────────────────────────────────────────────
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.log('[HabitStore] Offline, skipping fetchHabits network request.');
          return;
        }

        try {
          const raw = await apiGet<any[]>(`/habits?userId=${userId}`)
          const habits = (Array.isArray(raw) ? raw : []).map(normalizeHabit)

          // Get all pending sync queue items to identify local-only unsynced habits
          const pendingIds = new Set<string>()
          try {
            const queue = await db.syncQueue.toArray()
            for (const item of queue) {
              if (item.payload && (item.payload as any).id) {
                pendingIds.add((item.payload as any).id)
              } else {
                const parts = item.path.split('/')
                const lastPart = parts[parts.length - 1]
                if (lastPart) pendingIds.add(lastPart)
              }
            }
          } catch (err) {
            console.error('[HabitStore] Failed to read sync queue:', err)
          }

          // Bulk save to Dexie
          for (const habit of habits) {
            await db.habits.put(habit)
          }

          const currentHabits = get().habits
          const merged = mergeHabits(habits, currentHabits, userId, pendingIds)

          // Delete habits from Dexie that are no longer in the merged set (meaning they were deleted on the server)
          const mergedIds = new Set(merged.map(h => h.id))
          const deletedIds = currentHabits
            .filter(h => h.userId === userId && !mergedIds.has(h.id))
            .map(h => h.id)

          for (const id of deletedIds) {
            await db.habits.delete(id).catch(() => {})
          }

          set({ habits: merged, isLoading: false, error: null })
        } catch {
          // Network failure — keep local
          set({ isLoading: false, error: null })
        }
      },

      addHabit: async (habitData) => {
        const userId = useAuthStore.getState().user?.id
        if (!userId) return

        const id = crypto.randomUUID() // Client-generated authoritative UUID
        const newHabit: Habit = {
          ...habitData,
          id,
          userId,
          completedDates: [],
          currentStreak: 0,
          longestStreak: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        set((state) => ({ habits: [...state.habits, newHabit] }))
        syncHabitNotification(newHabit)

        // Write to local database (Dexie)
        db.habits.put(newHabit).catch(err => console.error('Dexie save error:', err))

        try {
          const raw = await apiPost<any>('/habits', newHabit)
          if (raw) {
            const added = normalizeHabit(raw)
            db.habits.put(added).catch(() => {})
            set((state) => ({
              habits: state.habits.map((h) => (h.id === id ? added : h)),
            }))
            syncHabitNotification(added)
          }
        } catch {
          console.warn('Network error: addHabit stored locally for background sync')
          await db.queueSync('/habits', 'POST', newHabit)
        }
      },

      updateHabit: async (id, updates) => {
        const now = new Date().toISOString()
        const habit = get().habits.find((h) => h.id === id)
        if (!habit) return

        const updated = { ...habit, ...updates, updatedAt: now }

        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? updated : h)),
        }))
        syncHabitNotification(updated)

        // Save to Dexie
        db.habits.put(updated).catch(err => console.error('Dexie update error:', err))

        const apiUpdates = { ...updates, id, updatedAt: now }
        try {
          const raw = await apiPut<any>(`/habits/${id}`, apiUpdates)
          const updatedServer = normalizeHabit(raw)
          db.habits.put(updatedServer).catch(() => {})
          set((state) => ({
            habits: state.habits.map((h) => (h.id === id ? updatedServer : h)),
          }))
          syncHabitNotification(updatedServer)
        } catch {
          console.warn('Network error: updateHabit queued for background sync')
          await db.queueSync(`/habits/${id}`, 'PUT', apiUpdates)
        }
      },

      deleteHabit: async (id) => {
        set((state) => ({ habits: state.habits.filter((h) => h.id !== id) }))
        db.habits.delete(id).catch(err => console.error('Dexie delete error:', err))

        import('@/lib/notifications').then(({ notificationSystem }) => {
          notificationSystem.cancelScheduled(`habit-${id}`)
        }).catch(() => {})

        try {
          await apiDelete(`/habits/${id}`)
        } catch {
          console.warn('Network error: deleteHabit queued for background sync')
          await db.queueSync(`/habits/${id}`, 'DELETE', null)
        }
      },

      toggleHabitCompletion: async (id, dateStr) => {
        const habit = get().habits.find((h) => h.id === id)
        if (!habit) return

        // If it's a step-based habit, clicking it should probably increment it
        if (habit.goalTarget && habit.goalTarget > 1) {
          const progress = habit.goalProgress?.[dateStr] || 0
          if (progress < habit.goalTarget) {
            await get().incrementHabitProgress(id, dateStr)
          } else {
            // If already complete, maybe clear it?
            const updates: Partial<Habit> = {
              completedDates: (habit.completedDates || []).filter(d => d !== dateStr),
              goalProgress: { ...(habit.goalProgress || {}), [dateStr]: 0 }
            }
            await get().updateHabit(id, updates)
          }
          return
        }

        const dates = Array.isArray(habit.completedDates) ? habit.completedDates : []
        const isCompleted = dates.includes(dateStr)
        const newDates = isCompleted
          ? dates.filter((d) => d !== dateStr)
          : [...dates, dateStr]

        const uniqueDates = Array.from(new Set(newDates))
        const { currentStreak, longestStreak } = calculateStreaks(uniqueDates)
        const newLongestStreak = Math.max(habit.longestStreak, longestStreak)

        const updates: Partial<Habit> = {
          completedDates: uniqueDates,
          currentStreak,
          longestStreak: newLongestStreak,
        }

        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        }))

        await get().updateHabit(id, updates)
      },

      incrementHabitProgress: async (id, dateStr) => {
        const habit = get().habits.find((h) => h.id === id)
        if (!habit) return

        const currentProgress = habit.goalProgress?.[dateStr] || 0
        const newProgress = currentProgress + 1
        const updates: Partial<Habit> = {
          goalProgress: { ...(habit.goalProgress || {}), [dateStr]: newProgress }
        }

        // If reached target, mark as completed date
        if (habit.goalTarget && newProgress >= habit.goalTarget) {
          const dates = Array.isArray(habit.completedDates) ? habit.completedDates : []
          if (!dates.includes(dateStr)) {
            const uniqueDates = Array.from(new Set([...dates, dateStr]))
            const { currentStreak, longestStreak } = calculateStreaks(uniqueDates)
            updates.completedDates = uniqueDates
            updates.currentStreak = currentStreak
            updates.longestStreak = Math.max(habit.longestStreak, longestStreak)
          }
        }

        await get().updateHabit(id, updates)
      },

      decrementHabitProgress: async (id, dateStr) => {
        const habit = get().habits.find((h) => h.id === id)
        if (!habit) return

        const currentProgress = habit.goalProgress?.[dateStr] || 0
        if (currentProgress <= 0) return

        const newProgress = currentProgress - 1
        const updates: Partial<Habit> = {
          goalProgress: { ...(habit.goalProgress || {}), [dateStr]: newProgress }
        }

        // If falls below target, remove from completed dates
        if (habit.goalTarget && newProgress < habit.goalTarget) {
          const dates = Array.isArray(habit.completedDates) ? habit.completedDates : []
          if (dates.includes(dateStr)) {
            const newDates = dates.filter(d => d !== dateStr)
            const { currentStreak, longestStreak } = calculateStreaks(newDates)
            updates.completedDates = newDates
            updates.currentStreak = currentStreak
            updates.longestStreak = longestStreak
          }
        }

        await get().updateHabit(id, updates)
      },
    }),
    {
      name: 'obel-habits',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: () => ({}),
    }
  )
)
