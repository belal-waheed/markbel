import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '@/lib/storage'
import { apiGet, apiPut } from '@/lib/api'
import { db } from '@/lib/db'
import { useAuthStore } from './authStore'
import { useTaskStore } from './taskStore'
import { useCoffeeStore } from './coffeeStore'
import { wakeLockSystem } from '@/lib/wakeLock'

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak' | 'coffeeBreak'

export interface PomodoroSettings {
  focusDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  longBreakInterval: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  soundEnabled: boolean
  notificationsEnabled: boolean
  energySaver: boolean
}

export interface SessionHistory {
  id: string
  mode: TimerMode
  duration: number // in seconds
  completedAt: string // ISO string
  taskId?: string
  type: 'start' | 'finish' | 'complete'
}

interface TimerState {
  timeRemaining: number
  isRunning: boolean
  mode: TimerMode
  sessionsCompleted: number
  expectedEndTime: number | null
  totalFocusSeconds: number

  settings: PomodoroSettings
  sessionHistory: SessionHistory[]
  activeTaskId: string | null
  isFullscreen: boolean

  setMode: (mode: TimerMode) => void
  start: (taskId?: string) => void
  pause: () => void
  reset: () => void
  skip: () => void
  tick: (options?: { skipNotification?: boolean }) => void
  updateSettings: (settings: Partial<PomodoroSettings>) => Promise<void>
  setActiveTaskId: (taskId: string | null) => void
  loadFromUser: () => Promise<void>
  saveToUser: () => Promise<void>
  resumeTick: () => void
  setIsFullscreen: (val: boolean) => void
}

let globalTimerInterval: ReturnType<typeof setInterval> | null = null

function startGlobalTick() {
  if (globalTimerInterval) return
  globalTimerInterval = setInterval(() => {
    const state = useTimerStore.getState()
    if (state.isRunning) state.tick()
  }, 500) // 500ms for snappier UI
}

function stopGlobalTick() {
  if (globalTimerInterval) {
    clearInterval(globalTimerInterval)
    globalTimerInterval = null
  }
}

function getDurationForMode(mode: TimerMode, settings: PomodoroSettings): number {
  switch (mode) {
    case 'focus': return settings.focusDuration * 60
    case 'shortBreak': return settings.shortBreakDuration * 60
    case 'longBreak': return settings.longBreakDuration * 60
    case 'coffeeBreak': return 5 * 60
  }
}

function mergeHistory(apiHistory: SessionHistory[], localHistory: SessionHistory[]): SessionHistory[] {
  const map = new Map<string, SessionHistory>()
  
  // Local history is usually more recent or has more items if offline
  localHistory.forEach(h => {
    const key = h.id || `${h.completedAt}-${h.mode}-${h.type}`
    map.set(key, h)
  })
  
  // API history might have items from other devices or older sessions
  apiHistory.forEach(h => {
    const key = h.id || `${h.completedAt}-${h.mode}-${h.type}`
    map.set(key, h)
  })
  
  return Array.from(map.values())
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
    .slice(-300) // Slightly larger buffer for history
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timeRemaining: 25 * 60,
      expectedEndTime: null,
      isRunning: false,
      mode: 'focus',
      sessionsCompleted: 0,
      totalFocusSeconds: 0,
      settings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        longBreakInterval: 4,
        autoStartBreaks: false,
        autoStartFocus: false,
        soundEnabled: true,
        notificationsEnabled: true,
        energySaver: false,
      },
      sessionHistory: [],
      activeTaskId: null,
      isFullscreen: false,

      setMode: (mode) => {
        const { settings } = get()
        set({
          mode,
          timeRemaining: getDurationForMode(mode, settings),
          expectedEndTime: null,
          isRunning: false,
        })
        stopGlobalTick()
        import('@/lib/notifications').then(({ notificationSystem }) => {
          notificationSystem.cancelScheduled('obel-timer')
        })
      },

      start: (taskId) => {
        if (get().isRunning) return
        const now = Date.now()
        const endTime = now + get().timeRemaining * 1000
        set({
          isRunning: true,
          expectedEndTime: endTime,
          activeTaskId: taskId !== undefined ? taskId : get().activeTaskId,
        })

        const { mode, settings } = get()
        if (settings.notificationsEnabled) {
          import('@/lib/notifications').then(({ notificationSystem }) => {
            const modeNames: Record<TimerMode, string> = {
              focus: 'Focus',
              shortBreak: 'Short Break',
              longBreak: 'Long Break',
              coffeeBreak: 'Coffee Break',
            }
            notificationSystem.schedule(
              `${modeNames[mode]} session finished!`,
              endTime,
              'obel-timer',
              { 
                body: 'Time to switch modes. Open Obel to start your next session.',
                icon: '/icons/badge-timer.png',
                badge: '/icons/badge-timer.svg'
              }
            )
          })
        }

        // Record start event
        const startItem: SessionHistory = {
          id: `local-${crypto.randomUUID()}`,
          mode,
          duration: 0,
          completedAt: new Date().toISOString(),
          taskId: taskId || get().activeTaskId || undefined,
          type: 'start'
        }
        set((s) => ({ sessionHistory: [...s.sessionHistory, startItem] }))

        startGlobalTick()
        if (!settings.energySaver) {
          wakeLockSystem.request()
        }
      },

      pause: () => {
        set({ isRunning: false, expectedEndTime: null })
        stopGlobalTick()
        wakeLockSystem.release()
        import('@/lib/notifications').then(({ notificationSystem }) => {
          notificationSystem.cancelScheduled('obel-timer')
        })

        // Record pause/finish event
        const finishItem: SessionHistory = {
          id: `local-${crypto.randomUUID()}`,
          mode: get().mode,
          duration: 0,
          completedAt: new Date().toISOString(),
          taskId: get().activeTaskId || undefined,
          type: 'finish'
        }
        set((s) => ({ sessionHistory: [...s.sessionHistory, finishItem] }))
      },

      reset: () => {
        const { mode, settings } = get()
        set({
          isRunning: false,
          expectedEndTime: null,
          timeRemaining: getDurationForMode(mode, settings),
          activeTaskId: null,
        })
        stopGlobalTick()
        wakeLockSystem.release()
        import('@/lib/notifications').then(({ notificationSystem }) => {
          notificationSystem.cancelScheduled('obel-timer')
        })
      },

      skip: () => {
        const { mode, settings, sessionsCompleted } = get()
        let nextMode: TimerMode
        if (mode === 'focus') {
          const nextSession = sessionsCompleted + 1
          nextMode =
            nextSession % settings.longBreakInterval === 0 ? 'longBreak' : 'shortBreak'
        } else {
          nextMode = 'focus'
        }
        set({
          mode: nextMode,
          timeRemaining: getDurationForMode(nextMode, settings),
          expectedEndTime: null,
          isRunning: false,
          activeTaskId: null,
        })
        stopGlobalTick()
        wakeLockSystem.release()
        import('@/lib/notifications').then(({ notificationSystem }) => {
          notificationSystem.cancelScheduled('obel-timer')
        })
      },

      tick: (options) => {
        const {
          expectedEndTime,
          isRunning,
          mode,
          settings,
          sessionsCompleted,
          activeTaskId,
        } = get()
        if (!isRunning || !expectedEndTime) return

        const now = Date.now()
        const remaining = Math.max(0, Math.ceil((expectedEndTime - now) / 1000))
        set({ timeRemaining: remaining })

        if (remaining > 0) return

        // ── Session completed ──────────────────────────────────────────
        stopGlobalTick()

        // ── CRITICAL: Cancel any scheduled notifications for this session ──
        import('@/lib/notifications').then(({ notificationSystem }) => {
          notificationSystem.cancelScheduled('obel-timer')
        })

        const finalDuration =
          mode === 'coffeeBreak' ? 5 * 60 : getDurationForMode(mode, settings)

        // Credit focus time to active task
        if (mode === 'focus' && activeTaskId) {
          const task = useTaskStore
            .getState()
            .tasks.find((t) => t.id === activeTaskId)
          useTaskStore.getState().updateTask(activeTaskId, {
            focusSessions: (task?.focusSessions || 0) + 1,
            focusTime: (task?.focusTime || 0) + finalDuration,
          })
        }

        const newHistoryItem: SessionHistory = {
          id: `local-${crypto.randomUUID()}`,
          mode,
          duration: finalDuration,
          completedAt: new Date().toISOString(),
          taskId: activeTaskId || undefined,
          type: 'complete'
        }

        let nextMode: TimerMode = 'focus'
        let newSessionsCompleted = sessionsCompleted

        if (mode === 'focus') {
          newSessionsCompleted = sessionsCompleted + 1
          nextMode =
            newSessionsCompleted % settings.longBreakInterval === 0
              ? 'longBreak'
              : 'shortBreak'
        } else if (mode === 'coffeeBreak') {
          nextMode = 'focus'
          // Use the new coffee management API
          useCoffeeStore.getState().addLog({
            type: 'Coffee Break',
            caffeineMg: 80,
            mood: 'Relaxed'
          })
        } else {
          nextMode = 'focus'
        }

        const shouldAutoStart =
          (nextMode === 'focus' && settings.autoStartFocus) ||
          (nextMode !== 'focus' &&
            (nextMode as string) !== 'coffeeBreak' &&
            settings.autoStartBreaks)

        const nextDuration = getDurationForMode(nextMode, settings)

        // Accumulate totalFocusSeconds — this counter NEVER shrinks
        const newTotalFocusSeconds = mode === 'focus' 
          ? get().totalFocusSeconds + finalDuration 
          : get().totalFocusSeconds

        set({
          mode: nextMode,
          timeRemaining: nextDuration,
          isRunning: shouldAutoStart,
          expectedEndTime: shouldAutoStart ? Date.now() + nextDuration * 1000 : null,
          sessionsCompleted: newSessionsCompleted,
          sessionHistory: [...get().sessionHistory, newHistoryItem],
          activeTaskId: activeTaskId, // Keep task selected through breaks
          totalFocusSeconds: newTotalFocusSeconds,
        })

        get().saveToUser()

        if (mode === 'focus') {
          useAuthStore.getState().addXP(Math.round((finalDuration / 60) * 2))
        }

        if (settings.soundEnabled) {
          import('@/lib/sounds').then(({ soundSystem }) => soundSystem.playChime())
        }
        if (settings.notificationsEnabled && !options?.skipNotification) {
          import('@/lib/notifications').then(({ notificationSystem }) => {
            const title = nextMode === 'focus' ? 'Break Over!' : 'Session Complete!'
            notificationSystem.send(title, { 
              body: 'Time to switch modes. Open Obel to start your next session.', 
              tag: 'obel-timer',
              icon: '/icons/badge-timer.png',
              badge: '/icons/badge-timer.svg',
              silent: true 
            })
            if (shouldAutoStart) {
              const modeNames: Record<TimerMode, string> = {
                focus: 'Focus',
                shortBreak: 'Short Break',
                longBreak: 'Long Break',
                coffeeBreak: 'Coffee Break',
              }
              notificationSystem.schedule(
                `${modeNames[nextMode]} session finished!`,
                Date.now() + nextDuration * 1000,
                'obel-timer',
                {
                  body: 'Time to switch modes. Open Obel to start your next session.',
                  icon: '/icons/badge-timer.png',
                  badge: '/icons/badge-timer.svg'
                }
              )
            }
          })
        } else if (settings.notificationsEnabled && options?.skipNotification && shouldAutoStart) {
          // Even if we skip the immediate "finished" notification, we still need to schedule the NEXT one
          import('@/lib/notifications').then(({ notificationSystem }) => {
            const modeNames: Record<TimerMode, string> = {
              focus: 'Focus',
              shortBreak: 'Short Break',
              longBreak: 'Long Break',
              coffeeBreak: 'Coffee Break',
            }
            notificationSystem.schedule(
              `${modeNames[nextMode]} session finished!`,
              Date.now() + nextDuration * 1000,
              'obel-timer',
              {
                body: 'Time to switch modes. Open Obel to start your next session.',
                icon: '/icons/badge-timer.png',
                badge: '/icons/badge-timer.svg'
              }
            )
          })
        }

        if (shouldAutoStart) {
          startGlobalTick()
          if (!settings.energySaver) {
            wakeLockSystem.request()
          }
        } else {
          wakeLockSystem.release()
        }
      },

      updateSettings: async (newSettings) => {
        const { settings, mode, isRunning } = get()
        const merged = { ...settings, ...newSettings }
        const updates: Partial<TimerState> = { settings: merged }
        if (!isRunning) {
          updates.timeRemaining = getDurationForMode(mode, merged)
        }
        set(updates)
        await get().saveToUser()
      },

      setActiveTaskId: (taskId) => set({ activeTaskId: taskId }),

      loadFromUser: async () => {
        const userId = useAuthStore.getState().user?.id
        if (!userId) return
        try {
          const doc = await apiGet<{
            settings?: Partial<PomodoroSettings>
            sessionHistory?: SessionHistory[]
            sessionsCompleted?: number
            totalFocusSeconds?: number
          }>(`/pomodoro?userId=${userId}`)

          const settings = doc?.settings || {}
          const history = Array.isArray(doc?.sessionHistory) ? doc.sessionHistory : []
          
          // CRITICAL: Merge logic for offline-first resilience
          const serverSessions = typeof doc?.sessionsCompleted === 'number' ? doc.sessionsCompleted : 0
          const localSessions = get().sessionsCompleted
          const sessionsCompleted = Math.max(serverSessions, localSessions)
          
          const serverTotalSeconds = typeof doc?.totalFocusSeconds === 'number' ? doc.totalFocusSeconds : 0
          const localTotalSeconds = get().totalFocusSeconds
          const totalFocusSeconds = Math.max(serverTotalSeconds, localTotalSeconds)

          const mergedHistory = mergeHistory(history, get().sessionHistory)

          const mergedSettings: PomodoroSettings = {
            focusDuration: settings.focusDuration ?? 25,
            shortBreakDuration: settings.shortBreakDuration ?? 5,
            longBreakDuration: settings.longBreakDuration ?? 15,
            longBreakInterval: settings.longBreakInterval ?? 4,
            autoStartBreaks: settings.autoStartBreaks ?? false,
            autoStartFocus: settings.autoStartFocus ?? false,
            soundEnabled: settings.soundEnabled ?? true,
            notificationsEnabled: settings.notificationsEnabled ?? true,
            energySaver: settings.energySaver ?? false,
          }

          set({ 
            settings: mergedSettings, 
            sessionHistory: mergedHistory, 
            sessionsCompleted, 
            totalFocusSeconds 
          })

          // Only reset timeRemaining if not currently running
          if (!get().isRunning) {
            set({ timeRemaining: getDurationForMode(get().mode, mergedSettings) })
          }
        } catch {
          // Network failure — use local/default settings
        }
      },

      saveToUser: async () => {
        const { settings, sessionHistory, totalFocusSeconds } = get()
        const userId = useAuthStore.getState().user?.id
        if (!userId) return
        const totalFocusHours = (totalFocusSeconds / 3600).toFixed(1)

        const payload = {
          settings,
          sessionHistory: sessionHistory.slice(-200),
          totalFocusHours,
          totalFocusSeconds,
          sessionsCompleted: get().sessionsCompleted,
        }

        // Save to dedicated pomodoro collection
        try {
          await apiPut(`/pomodoro/${userId}`, payload)
        } catch {
          console.warn('Network error: pomodoro data saved locally for background sync')
          await db.queueSync(`/pomodoro/${userId}`, 'PUT', payload)
        }

        // Also update totalFocusHours on user profile for dashboard display
        try {
          await useAuthStore.getState().updateUser({ totalFocusHours })
        } catch {
          // silently keep local
        }
      },

      // ── CRITICAL FIX: handle timer that expired while app was closed ──
      resumeTick: () => {
        const { isRunning, expectedEndTime, mode, settings } = get()
        if (!isRunning || !expectedEndTime) return

        const now = Date.now()

        if (now >= expectedEndTime) {
          // Timer expired while the app was closed — force to 0 then complete
          set({ timeRemaining: 0 })
          // Small delay so persisted state settles before completion logic runs
          setTimeout(() => get().tick({ skipNotification: true }), 150)
        } else {
          // Still running — sync remaining time with wall clock and resume
          const remaining = Math.ceil((expectedEndTime - now) / 1000)
          set({ timeRemaining: remaining })
          startGlobalTick()

          // Re-schedule the notification with the correct remaining time
          if (settings.notificationsEnabled) {
            import('@/lib/notifications').then(({ notificationSystem }) => {
              const modeNames: Record<TimerMode, string> = {
                focus: 'Focus',
                shortBreak: 'Short Break',
                longBreak: 'Long Break',
                coffeeBreak: 'Coffee Break',
              }
              notificationSystem.schedule(
                `${modeNames[mode]} session finished!`,
                expectedEndTime,
                'obel-timer',
                { 
                  body: 'Time to switch modes. Open Obel to start your next session.',
                  icon: '/icons/badge-timer.png',
                  badge: '/icons/badge-timer.svg'
                }
              )
            })
          }
        }
      },
      setIsFullscreen: (val) => set({ isFullscreen: val }),
    }),
    {
      name: 'obel-timer',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        settings: state.settings,
        sessionsCompleted: state.sessionsCompleted,
        totalFocusSeconds: state.totalFocusSeconds,
        sessionHistory: state.sessionHistory.slice(-200), // Cap to prevent unbounded IndexedDB growth
        timeRemaining: state.timeRemaining,
        mode: state.mode,
        activeTaskId: state.activeTaskId,
        expectedEndTime: state.expectedEndTime,
        isRunning: state.isRunning,
      }),
    }
  )
)

// ─── Battery & CPU Optimization ──────────────────────────────────
// Automatically suspends CPU timer interval ticking when PWA goes
// into the background, and instantly mathematically aligns the remaining
// time using the high-precision expectedEndTime timestamp when brought back.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopGlobalTick()
    } else {
      const state = useTimerStore.getState()
      if (state.isRunning && state.expectedEndTime) {
        const remaining = Math.max(0, Math.ceil((state.expectedEndTime - Date.now()) / 1000))
        useTimerStore.setState({ timeRemaining: remaining })
        startGlobalTick()
      }
    }
  })
}

