import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '@/lib/storage'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { db } from '@/lib/db'
import { useAuthStore } from './authStore'
import { useToastStore } from './toastStore'
import dayjs from 'dayjs'

export type TaskStatus = 'todo' | 'in-progress' | 'done'

export interface TaskList {
  id: string
  title: string
  order: number
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Task {
  id: string
  title: string
  tags: string[]
  subtasks: Subtask[]
  status: TaskStatus
  dueDate?: string
  createdAt: string
  completedAt?: string
  userId: string
  focusSessions?: number
  focusTime?: number
  scheduledTime?: string
  estimatedDuration?: number
  listId?: string
  linkedNoteIds?: string[]
  order?: number
  updatedAt: string
}

/** 
 * Lightweight normalization for legacy data stored as strings.
 * Mongoose on backend handles most of this now, but this is a 
 * safety layer for local storage/legacy API results.
 */
function normalizeTask(task: any): Task {
  const t = { ...task }
  if (t.listId === null || t.listId === 'imp') {
    t.listId = undefined
  }
  if (typeof t.tags === 'string') {
    try { t.tags = JSON.parse(t.tags) } catch { t.tags = [] }
  }
  if (typeof t.subtasks === 'string') {
    try { t.subtasks = JSON.parse(t.subtasks) } catch { t.subtasks = [] }
  }
  if (typeof t.linkedNoteIds === 'string') {
    try { t.linkedNoteIds = JSON.parse(t.linkedNoteIds) } catch { t.linkedNoteIds = [] }
  }
  if (!Array.isArray(t.tags)) t.tags = []
  if (!Array.isArray(t.subtasks)) t.subtasks = []
  if (!Array.isArray(t.linkedNoteIds)) t.linkedNoteIds = []
  if (!t.updatedAt) t.updatedAt = t.createdAt || new Date().toISOString()
  return t as Task
}


/** Merge API tasks with local tasks.
 *  - API tasks are source of truth for known IDs.
 *  - Local-only tasks (temp IDs or IDs not in API) are kept so offline
 *    work is never silently discarded.
 */
function mergeTasks(
  apiTasks: Task[],
  localTasks: Task[],
  userId: string,
  pendingIds: Set<string>
): Task[] {
  const localMap = new Map(localTasks.map((t) => [t.id, t]));
  const apiIds = new Set(apiTasks.map((t) => t.id));
  const apiTitles = new Set(apiTasks.map((t) => `${t.title}|${t.createdAt}`));

  const merged = apiTasks.map((apiTask) => {
    const localTask = localMap.get(apiTask.id);
    if (!localTask) return apiTask;

    // Use updatedAt if available, fallback to createdAt for old tasks
    const apiTS = apiTask.updatedAt || apiTask.createdAt;
    const localTS = localTask.updatedAt || localTask.createdAt;

    const apiTime = new Date(apiTS).getTime();
    const localTime = new Date(localTS).getTime();

    if (localTime > apiTime) {
      return localTask; // Keep newer client-side modifications
    }

    // If timestamps match, do a deep check to be absolutely sure
    // We use JSON.stringify for a reliable deep comparison
    if (apiTime === localTime) {
      const hasChanged = JSON.stringify(apiTask) !== JSON.stringify(localTask);
      if (!hasChanged) return localTask; // KEEP LOCAL REFERENCE
    }

    return apiTask;
  });

  const localOnly = localTasks.filter((t) => {
    if (t.userId !== userId) return false;
    if (apiIds.has(t.id)) return false;

    if (t.id.startsWith('temp-') || pendingIds.has(t.id)) {
      if (t.id.startsWith('temp-') && apiTitles.has(`${t.title}|${t.createdAt}`)) return false;
      return true;
    }

    return false; // Real IDs not in API and not pending sync are considered deleted
  });

  return [...merged, ...localOnly];
}

interface TaskState {
  tasks: Task[]
  lists: TaskList[]
  isLoading: boolean
  error: string | null

  fetchTasks: () => Promise<void>
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'userId' | 'updatedAt'>) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleComplete: (id: string) => Promise<void>

  updateListTitle: (id: string, title: string) => void
  addList: (title: string) => void
  deleteList: (id: string) => void

  addSubtask: (taskId: string, title: string) => Promise<void>
  updateSubtask: (taskId: string, subtaskId: string, title: string) => Promise<void>
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>
  moveTaskToList: (taskId: string, listId: string) => Promise<void>
  reorderLists: (newLists: TaskList[]) => void
  reorderTasks: (
    sourceListId: string,
    destinationListId: string,
    sourceIndex: number,
    destinationIndex: number,
    taskId: string
  ) => void

  getFilteredTasks: (status?: string, search?: string) => Task[]
  getAllTags: () => string[]
  getTasksDueToday: () => Task[]
  getTasksDueThisWeek: () => Task[]
  getCompletedToday: () => Task[]
  calculateTaskProgress: (taskId: string) => number
}

const DEFAULT_LISTS: TaskList[] = [
  { id: 'imp', title: 'IMP', order: 0 },
  { id: 'fast', title: 'Fast', order: 1 },
  { id: 'later', title: 'Later', order: 2 },
]

function syncTaskNotification(task: Task) {
  if (typeof window === 'undefined') return

  import('@/lib/notifications').then(async ({ notificationSystem }) => {
    // Cancel any existing scheduled reminder
    notificationSystem.cancelScheduled(`task-${task.id}`)

    // If done, we do not want any notification
    if (task.status === 'done') return

    // If Web Push is active, do not schedule local reminders
    const hasPush = await notificationSystem.hasActivePushSubscription()
    if (hasPush) return

    if (task.scheduledTime) {
      const datePart = task.dueDate
        ? (task.dueDate.includes('T') ? task.dueDate.split('T')[0] : task.dueDate)
        : dayjs().format('YYYY-MM-DD')

      const triggerTime = dayjs(`${datePart}T${task.scheduledTime}`)
      const triggerMs = triggerTime.valueOf()

      if (triggerMs > Date.now()) {
        notificationSystem.schedule(
          `Task Reminder: ${task.title}`,
          triggerMs,
          `task-${task.id}`,
          {
            body: `Time to get this done! Open Obel to update progress.`,
            icon: '/icons/badge-task.png',
            badge: '/icons/badge-task.svg',
            tag: `task-${task.id}`
          }
        )
      }
    }
  }).catch(() => {})
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      lists: DEFAULT_LISTS,
      isLoading: false,
      error: null,

      fetchTasks: async () => {
        const user = useAuthStore.getState().user
        if (!user?.id) return

        // 1. Load local tasks from Dexie first (Offline-first hydration!)
        try {
          const localTasks = await db.tasks.where({ userId: user.id }).toArray()
          set({ tasks: localTasks.map(normalizeTask) })
        } catch (err) {
          console.error('[TaskStore] Failed to load local tasks from Dexie:', err)
        }

        // Hydrate lists from user profile — ALWAYS trust the server
        if (user.taskLists !== undefined && user.taskLists !== null) {
          const parsedLists = Array.isArray(user.taskLists) 
            ? user.taskLists 
            : typeof user.taskLists === 'string' 
              ? (() => { try { return JSON.parse(user.taskLists as string) } catch { return [] } })()
              : []
          // Always set from server, even if empty — server is source of truth
          set({ lists: parsedLists.length > 0 ? parsedLists : DEFAULT_LISTS })
        }

        const userId = user.id

        // ── OFFLINE GUARD ─────────────────────────────────────────────
        // If offline, don't attempt to fetch from API. 
        // This ensures local data (including unsynced changes) remains untouched.
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.log('[TaskStore] Offline, skipping fetchTasks network request.');
          return;
        }

        // Show loading only if we have no local data yet
        const hasLocal = get().tasks.some((t) => t.userId === userId)
        if (!hasLocal) set({ isLoading: true, error: null })

        try {
          const raw = await apiGet<any[]>(`/tasks?userId=${userId}`)
          const apiTasks = (Array.isArray(raw) ? raw : []).map(normalizeTask)

          // Get all pending sync queue items to identify local-only unsynced tasks
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
            console.error('[TaskStore] Failed to read sync queue:', err)
          }

          // Bulk save to Dexie
          for (const task of apiTasks) {
            await db.tasks.put(task)
          }

          const currentTasks = get().tasks
          const merged = mergeTasks(apiTasks, currentTasks, userId, pendingIds)

          // Delete tasks from Dexie that are no longer in the merged set (meaning they were deleted on the server)
          const mergedIds = new Set(merged.map(t => t.id))
          const deletedIds = currentTasks
            .filter(t => t.userId === userId && !mergedIds.has(t.id))
            .map(t => t.id)

          for (const id of deletedIds) {
            await db.tasks.delete(id).catch(() => {})
          }

          set({ tasks: merged, isLoading: false, error: null })
          console.log(`[TaskStore] Fetched ${apiTasks.length} tasks from server`)
        } catch (err: any) {
          // Network failure – keep whatever is in local store but set error state
          const errorMsg = err.message || 'Failed to load tasks'
          console.error(`[TaskStore] Failed to fetch tasks:`, errorMsg)
          set({ isLoading: false, error: errorMsg })
        }
      },

      addTask: async (taskData) => {
        const userId = useAuthStore.getState().user?.id
        if (!userId) return

        const id = crypto.randomUUID() // Client-generated authoritative UUID
        const now = new Date().toISOString()
        const task: Task = {
          ...taskData,
          id,
          createdAt: now,
          updatedAt: now,
          subtasks: taskData.subtasks || [],
          tags: taskData.tags || [],
          linkedNoteIds: taskData.linkedNoteIds || [],
          status: 'todo',
          userId,
        } as Task
        
        set((s) => ({ tasks: [...s.tasks, task] }))
        syncTaskNotification(task)

        // Write to local database (Dexie)
        db.tasks.put(task).catch(err => console.error('Dexie save error:', err))

        // Bidirectional Link Sync: Update all notes that are linked to this task
        import('./noteStore').then(({ useNoteStore }) => {
          task.linkedNoteIds?.forEach(noteId => {
            const note = useNoteStore.getState().notes.find(n => n.id === noteId)
            if (note && !note.linkedTaskIds?.includes(id)) {
              useNoteStore.getState().updateNote(noteId, {
                linkedTaskIds: [...(note.linkedTaskIds || []), id]
              })
            }
          })
        }).catch(() => {})

        try {
          const raw = await apiPost<any>('/tasks', task)
          if (raw) {
            const saved = normalizeTask(raw)
            db.tasks.put(saved).catch(() => {})
            set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? saved : t)) }))
            syncTaskNotification(saved)
          }
        } catch {
          console.warn('Network error: addTask stored locally for background sync')
          await db.queueSync('/tasks', 'POST', task)
        }
      },

      updateTask: async (id, updates) => {
        const now = new Date().toISOString()
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return

        const updated = { ...task, ...updates, updatedAt: now }

        // Bidirectional Link Sync: If updates contain linkedNoteIds, align notes' linkedTaskIds
        if (updates.linkedNoteIds) {
          const newIds = updates.linkedNoteIds
          const oldIds = task.linkedNoteIds || []
          
          import('./noteStore').then(({ useNoteStore }) => {
            const noteStore = useNoteStore.getState()
            
            // Notes that were added: link them
            newIds.forEach(noteId => {
              const note = noteStore.notes.find(n => n.id === noteId)
              if (note && !note.linkedTaskIds?.includes(id)) {
                noteStore.updateNote(noteId, {
                  linkedTaskIds: [...(note.linkedTaskIds || []), id]
                })
              }
            })
            
            // Notes that were removed: unlink them
            oldIds.forEach(noteId => {
              if (!newIds.includes(noteId)) {
                const note = noteStore.notes.find(n => n.id === noteId)
                if (note) {
                  noteStore.updateNote(noteId, {
                    linkedTaskIds: (note.linkedTaskIds || []).filter(tid => tid !== id)
                  })
                }
              }
            })
          }).catch(() => {})
        }

        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
        }))
        syncTaskNotification(updated)

        // Save to Dexie
        db.tasks.put(updated).catch(err => console.error('Dexie update error:', err))

        const apiUpdates = { ...updates, id, updatedAt: now }
        if ('listId' in apiUpdates && (apiUpdates.listId === undefined || apiUpdates.listId === 'imp')) {
          (apiUpdates as any).listId = null
        }
        try {
          const raw = await apiPut<any>(`/tasks/${id}`, apiUpdates)
          const updatedServer = normalizeTask(raw)
          db.tasks.put(updatedServer).catch(() => {})
          set((s) => ({
            tasks: s.tasks.map((t) => (t.id === id ? updatedServer : t)),
          }))
          syncTaskNotification(updatedServer)
        } catch {
          console.warn('Network error: updateTask queued for background sync')
          await db.queueSync(`/tasks/${id}`, 'PUT', apiUpdates)
        }
      },

      deleteTask: async (id) => {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
        db.tasks.delete(id).catch(err => console.error('Dexie delete error:', err))

        import('@/lib/notifications').then(({ notificationSystem }) => {
          notificationSystem.cancelScheduled(`task-${id}`)
        }).catch(() => {})

        // Bidirectional Link Cleanup: Remove this task ID from all notes
        import('./noteStore').then(({ useNoteStore }) => {
          useNoteStore.setState((s: any) => ({
            notes: s.notes.map((n: any) => ({
              ...n,
              linkedTaskIds: n.linkedTaskIds?.filter((tid: string) => tid !== id) || [],
            })),
          }))
        }).catch(() => {})

        try {
          await apiDelete(`/tasks/${id}`)
        } catch {
          console.warn('Network error: deleteTask queued for background sync')
          await db.queueSync(`/tasks/${id}`, 'DELETE', null)
        }
      },

      toggleComplete: async (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return
        
        const originalStatus = task.status
        const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done'
        const isDone = newStatus === 'done'
        const updates: Partial<Task> = {
          status: newStatus,
          completedAt: isDone ? new Date().toISOString() : undefined,
        }

        if (isDone) {
          const { soundSystem } = await import('@/lib/sounds')
          soundSystem.playSuccess()
          useAuthStore.getState().addXP(50)
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(15)
          }

          // Trigger Undo Toast
          useToastStore.getState().showToast(`Task Completed!`, () => {
             get().updateTask(id, { status: originalStatus, completedAt: undefined })
          })
        }
        
        await get().updateTask(id, updates)
      },

      updateListTitle: (id, title) => {
        set((state) => {
          const newLists = state.lists.map((l) => (l.id === id ? { ...l, title } : l))
          useAuthStore.getState().updateUser({ taskLists: newLists })
          return { lists: newLists }
        })
      },

      addList: (title) => {
        const newList: TaskList = {
          id: crypto.randomUUID(),
          title,
          order: get().lists.length,
        }
        set((state) => {
          const newLists = [...state.lists, newList]
          useAuthStore.getState().updateUser({ taskLists: newLists })
          return { lists: newLists }
        })
      },

      deleteList: (id) => {
        set((state) => {
          const newLists = state.lists.filter((l) => l.id !== id)
          useAuthStore.getState().updateUser({ taskLists: newLists })
          return { lists: newLists }
        })
      },

      moveTaskToList: async (taskId, listId) => {
        await get().updateTask(taskId, { listId })
      },

      reorderLists: (newLists) => {
        const ordered = newLists.map((l, i) => ({ ...l, order: i }))
        set({ lists: ordered })
        
        // Debounce the backend sync to prevent 500 errors from rapid updates
        const timeoutId = (window as any)._reorderTimeout
        if (timeoutId) clearTimeout(timeoutId)
        
        ;(window as any)._reorderTimeout = setTimeout(() => {
          useAuthStore.getState().updateUser({ taskLists: ordered })
        }, 1000)
      },

      reorderTasks: (_sourceListId, destinationListId, _sourceIndex, destinationIndex, taskId) => {
        set((state) => {
          const newTasks = [...state.tasks]
          const taskIndex = newTasks.findIndex(t => t.id === taskId)
          if (taskIndex === -1) return state
          
          const task = { ...newTasks[taskIndex] }
          task.listId = destinationListId === 'imp' ? undefined : destinationListId
          newTasks[taskIndex] = task
          
          // Separate tasks of the destination list into active and completed (since completed are hidden)
          const allDestTasks = newTasks.filter(
            (t) => (t.listId === destinationListId) || (!t.listId && destinationListId === 'imp')
          )
          
          const activeTasks = allDestTasks
            .filter((t) => t.status !== 'done' && t.id !== taskId)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            
          const completedTasks = allDestTasks
            .filter((t) => t.status === 'done' && t.id !== taskId)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            
          // Insert at visual index
          activeTasks.splice(destinationIndex, 0, task)
          
          // Merge active first, completed second, to keep order indexes clean
          const reorderedDest = [...activeTasks, ...completedTasks]
          
          // Update order property and timestamps for all affected tasks
          reorderedDest.forEach((t, i) => {
            const idx = newTasks.findIndex(nt => nt.id === t.id)
            if (idx !== -1) {
              const updatedTask = { ...newTasks[idx], order: i, updatedAt: new Date().toISOString() }
              newTasks[idx] = updatedTask
              db.tasks.put(updatedTask).catch(err => console.error('Dexie reorder update error:', err))
            }
          })
          
          // Debounce the backend sync
          const timeoutId = (window as any)._reorderTasksTimeout
          if (timeoutId) clearTimeout(timeoutId)
          
          ;(window as any)._reorderTasksTimeout = setTimeout(() => {
            const currentTasks = get().tasks
            const affectedTasks = currentTasks.filter(
              (t) => (t.listId === destinationListId) || (!t.listId && destinationListId === 'imp')
            )

            import('@/lib/api').then(({ apiPut }) => {
              affectedTasks.forEach(async (t) => {
                if (!t.id.startsWith('temp-')) {
                  const updates = { 
                    listId: t.listId, 
                    order: t.order, 
                    updatedAt: t.updatedAt 
                  }
                  try {
                    await apiPut(`/tasks/${t.id}`, updates)
                  } catch {
                    console.warn(`[Reorder sync] failed for task ${t.id}, queueing offline sync`)
                    await db.queueSync(`/tasks/${t.id}`, 'PUT', updates)
                  }
                }
              })
            }).catch(() => {})
          }, 1000)

          return { tasks: newTasks }
        })
      },

      addSubtask: async (taskId, title) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return
        const newSubtask: Subtask = {
          id: crypto.randomUUID(),
          title,
          completed: false,
        }
        await get().updateTask(taskId, { subtasks: [...task.subtasks, newSubtask] })
      },

      updateSubtask: async (taskId, subtaskId, title) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return
        const subtasks = task.subtasks.map((s) =>
          s.id === subtaskId ? { ...s, title } : s
        )
        await get().updateTask(taskId, { subtasks })
      },

      toggleSubtask: async (taskId, subtaskId) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return
        const subtasks = task.subtasks.map((s) => {
          if (s.id === subtaskId) {
            const willComplete = !s.completed
            if (willComplete) {
              import('@/lib/sounds').then(({ soundSystem }) => soundSystem.playClick())
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(10)
              }
            }
            return { ...s, completed: willComplete }
          }
          return s
        })
        await get().updateTask(taskId, { subtasks })
      },

      deleteSubtask: async (taskId, subtaskId) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return
        const subtasks = task.subtasks.filter((s) => s.id !== subtaskId)
        await get().updateTask(taskId, { subtasks })
      },

      getFilteredTasks: (status, search) => {
        let filtered = get().tasks
        
        // Default to hiding 'done' tasks unless explicitly requested
        if (!status || status === 'all') {
          filtered = filtered.filter((t) => t.status !== 'done')
        } else if (status !== 'all') {
          filtered = filtered.filter((t) => t.status === status)
        }

        if (search) {
          const q = search.toLowerCase()
          filtered = filtered.filter(
            (t) =>
              t.title.toLowerCase().includes(q)
          )
        }
        return filtered
      },

      getAllTags: () => {
        const tags = new Set<string>()
        get().tasks.forEach((t) => t.tags.forEach((tag) => tags.add(tag)))
        return Array.from(tags)
      },

      getTasksDueToday: () => {
        const today = new Date().toISOString().split('T')[0]
        return get().tasks.filter(
          (t) => t.dueDate?.startsWith(today) && t.status !== 'done'
        )
      },

      getTasksDueThisWeek: () => {
        const today = dayjs().startOf('day')
        const nextWeek = dayjs().add(7, 'day').endOf('day')
        return get().tasks.filter(
          (t) => {
            if (!t.dueDate || t.status === 'done') return false
            const taskDate = dayjs(t.dueDate)
            return taskDate.isAfter(today.subtract(1, 'minute')) && taskDate.isBefore(nextWeek)
          }
        ).sort((a, b) => dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf())
      },

      getCompletedToday: () => {
        const today = new Date().toISOString().split('T')[0]
        return get().tasks.filter((t) => t.completedAt?.startsWith(today))
      },

      calculateTaskProgress: (taskId: string) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task || !task.subtasks || task.subtasks.length === 0) {
          return task?.status === 'done' ? 100 : 0
        }
        const completed = task.subtasks.filter((s) => s.completed).length
        return Math.round((completed / task.subtasks.length) * 100)
      },
    }),
    {
      name: 'obel-tasks',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({ lists: state.lists }),
    }
  )
)
