import Dexie, { type Table } from 'dexie'
import { get, del } from 'idb-keyval'
import { ITask, IHabit, INote, IUserInfo } from '../types'

export interface ISyncQueueEntry {
  id?: number
  path: string
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  payload: any
  timestamp: number
}

export class ObelDatabase extends Dexie {
  tasks!: Table<ITask, string>
  habits!: Table<IHabit, string>
  notes!: Table<INote, string>
  userInfo!: Table<IUserInfo, string>
  syncQueue!: Table<ISyncQueueEntry, number>

  constructor() {
    super('ObelDatabase')

    // Define structural tables with their IndexedDB index keys.
    // Standard keys represent the primary key followed by indexed fields for fast queries.
    this.version(1).stores({
      tasks: 'id, userId, status, listId, order, updatedAt',
      habits: 'id, userId, updatedAt',
      notes: 'id, userId, folderId, updatedAt',
      userInfo: 'id, userId, updatedAt',
      syncQueue: '++id, timestamp'
    })
  }

  /**
   * Helper to queue modifications for background synchronization when offline.
   */
  async queueSync(path: string, method: ISyncQueueEntry['method'], payload: any) {
    const entry: ISyncQueueEntry = {
      path,
      method,
      payload,
      timestamp: Date.now()
    }
    await this.syncQueue.add(entry)
    console.log(`[Dexie Sync] Queued offline sync: ${method} ${path}`)
  }

  /**
   * Scans IndexedDB for old Zustand whole-store serialized keys and migrates
   * their records into native Dexie tables.
   */
  async migrateLegacyZustandData() {
    if (typeof window === 'undefined') return
    console.log('[Database] Checking for legacy Zustand store keys to migrate...')

    try {
      // 1. Migrate Notes
      const rawNotes = await get('obel-notes')
      if (rawNotes) {
        try {
          const parsed = JSON.parse(rawNotes)
          if (parsed?.state?.notes && Array.isArray(parsed.state.notes)) {
            console.log(`[Database] Migrating ${parsed.state.notes.length} notes to Dexie...`)
            for (const note of parsed.state.notes) {
              await this.notes.put(note)
            }
          }
        } catch (e) {
          console.error('[Database] Failed to parse obel-notes JSON:', e)
        }
        await del('obel-notes')
      }

      // 2. Migrate Tasks
      const rawTasks = await get('obel-tasks')
      if (rawTasks) {
        try {
          const parsed = JSON.parse(rawTasks)
          if (parsed?.state?.tasks && Array.isArray(parsed.state.tasks)) {
            console.log(`[Database] Migrating ${parsed.state.tasks.length} tasks to Dexie...`)
            for (const task of parsed.state.tasks) {
              await this.tasks.put(task)
            }
          }
        } catch (e) {
          console.error('[Database] Failed to parse obel-tasks JSON:', e)
        }
        await del('obel-tasks')
      }

      // 3. Migrate Habits
      const rawHabits = await get('obel-habits')
      if (rawHabits) {
        try {
          const parsed = JSON.parse(rawHabits)
          if (parsed?.state?.habits && Array.isArray(parsed.state.habits)) {
            console.log(`[Database] Migrating ${parsed.state.habits.length} habits to Dexie...`)
            for (const habit of parsed.state.habits) {
              await this.habits.put(habit)
            }
          }
        } catch (e) {
          console.error('[Database] Failed to parse obel-habits JSON:', e)
        }
        await del('obel-habits')
      }

      console.log('[Database] Migration scanning complete.')
    } catch (err) {
      console.error('[Database] Error during legacy Zustand data migration:', err)
    }
  }
}

// Instantiate and export the database singleton
export const db = new ObelDatabase()

// Trigger migrations asynchronously on database open
if (typeof window !== 'undefined') {
  db.open().then(() => {
    db.migrateLegacyZustandData()
  }).catch((err) => {
    console.error('[Database] Failed to open Dexie database:', err)
  })
}
