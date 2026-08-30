// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/lib/syncEngine.ts
// PURPOSE: PWA Background Outbox Queue Replay & Sync Manager
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { db } from './db'
import { apiRequest, apiGet, ApiError } from './api'
import { useTaskStore } from '../stores/taskStore'
import { useHabitStore } from '../stores/habitStore'
import { useNoteStore } from '../stores/noteStore'
import { useUserInfoStore } from '../stores/userInfoStore'
import { useTimerStore } from '../stores/timerStore'
import { useCoffeeStore } from '../stores/coffeeStore'
import { useAuthStore } from '../stores/authStore'

let isSyncing = false

/**
 * Pulls incremental server updates for notes, tasks, and habits
 * modified since the last sync timestamp.
 */
export async function pullServerUpdates(): Promise<void> {
  const user = useAuthStore.getState().user
  if (!user?.id) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  const lastSync = localStorage.getItem(`obel-last-sync-${user.id}`) || ''
  console.log(`[Sync Engine] Pulling updates since ${lastSync || 'beginning of time'}...`)

  try {
    const url = `/sync?userId=${user.id}${lastSync ? `&since=${encodeURIComponent(lastSync)}` : ''}`
    const data = await apiGet<{
      notes: any[]
      tasks: any[]
      habits: any[]
      timestamp: string
    }>(url)

    if (data) {
      console.log(`[Sync Engine] Incremental pull complete: notes=${data.notes.length}, tasks=${data.tasks.length}, habits=${data.habits.length}`)

      // 1. Process Notes
      if (data.notes.length > 0) {
        for (const note of data.notes) {
          await db.notes.put(note)
        }
        const { notes } = useNoteStore.getState()
        const noteMap = new Map(notes.map((n) => [n.id, n]))
        for (const note of data.notes) {
          noteMap.set(note.id, note)
        }
        useNoteStore.setState({ notes: Array.from(noteMap.values()) })
      }

      // 2. Process Tasks
      if (data.tasks.length > 0) {
        for (const task of data.tasks) {
          await db.tasks.put(task)
        }
        const { tasks } = useTaskStore.getState()
        const taskMap = new Map(tasks.map((t) => [t.id, t]))
        for (const task of data.tasks) {
          taskMap.set(task.id, task)
        }
        useTaskStore.setState({ tasks: Array.from(taskMap.values()) })
      }

      // 3. Process Habits
      if (data.habits.length > 0) {
        for (const habit of data.habits) {
          await db.habits.put(habit)
        }
        const { habits } = useHabitStore.getState()
        const habitMap = new Map(habits.map((h) => [h.id, h]))
        for (const habit of data.habits) {
          habitMap.set(habit.id, habit)
        }
        useHabitStore.setState({ habits: Array.from(habitMap.values()) })
      }

      // Persist the latest sync timestamp from the server
      localStorage.setItem(`obel-last-sync-${user.id}`, data.timestamp)
    }
  } catch (err) {
    console.error('[Sync Engine] Failed to pull server updates:', err)
  }
}

export async function replayOfflineQueue(): Promise<void> {
  if (isSyncing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  isSyncing = true
  console.log('[Sync Engine] Online state detected. Scanning offline sync queue...')

  let hasNetworkFailure = false

  try {
    const queue = await db.syncQueue.orderBy('timestamp').toArray()
    if (queue.length > 0) {
      console.log(`[Sync Engine] Found ${queue.length} pending mutations. Replaying sequentially...`)

      for (const item of queue) {
        try {
          const body = item.payload ? JSON.stringify(item.payload) : undefined
          
          const response = await apiRequest<Record<string, unknown>>(item.path, {
            method: item.method,
            body
          })

          if (response) {
            // Successfully replayed: Remove from local outbox queue
            await db.syncQueue.delete(item.id!)
          }
        } catch (err: unknown) {
          console.warn(`[Sync Engine] Failed to replay mutation path ${item.path}:`, err)
          
          const isApiError = err instanceof ApiError
          const status = isApiError ? (err as ApiError).status : -1

          // If it is a persistent client error discard it
          if (status === 400 || status === 404 || status === 409 || status === -1) {
            console.log(`[Sync Engine] Obsolete or invalid mutation detected (Status: ${status}). Discarding from queue...`)
            await db.syncQueue.delete(item.id!)
          } else {
            // Halting queue processing for temporary server failures
            console.warn('[Sync Engine] Temporary network/server failure during replay. Halting queue processing.')
            hasNetworkFailure = true
            break
          }
        }
      }
    } else {
      console.log('[Sync Engine] Offline queue is empty. Replay not required.')
    }

    if (!hasNetworkFailure) {
      // Pull incremental server changes
      console.log('[Sync Engine] Pulling server updates...')
      await pullServerUpdates()

      // Hydrate minor stores
      await Promise.all([
        useAuthStore.getState().refreshUser(),
        useUserInfoStore.getState().fetchUserInfo(),
        useTimerStore.getState().loadFromUser(),
        useCoffeeStore.getState().fetchLogs()
      ]).catch((err) => console.warn('[Sync Engine] supplementary store hydration failed:', err))
    }
  } catch (err: unknown) {
    console.error('[Sync Engine] Error during offline queue synchronization:', err)
  } finally {
    isSyncing = false
  }
}

/**
 * Initializes the background synchronization listeners in the client window.
 */
export function startSyncEngine(): void {
  if (typeof window === 'undefined') return

  console.log('[Sync Engine] Initializing background network sync listeners...')

  // Listen to network status recovery transitions
  window.addEventListener('online', () => {
    replayOfflineQueue().catch(() => {})
  })

  // Run initial trigger check in case app was hydrated while online
  if (navigator.onLine) {
    replayOfflineQueue().catch(() => {})
  }
}
