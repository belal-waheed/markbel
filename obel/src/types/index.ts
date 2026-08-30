// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE: src/types/index.ts
// PURPOSE: Unified TypeScript Types & Interfaces for Obel Suite
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── 1. USER & SETTINGS INFO (Rolling Accumulator) ─────────────────

export interface ICaffeineTodayLog {
  time: string    // e.g. "08:30"
  mg: number      // e.g. 80
}

export interface ITaskList {
  id: string
  title: string
  order: number
}

export interface IUserSettings {
  theme: string
  soundEnabled: boolean
  hapticsEnabled: boolean
}

export interface ITodayState {
  dateStr: string          // e.g. "2026-05-18" (format: YYYY-MM-DD)
  caffeineMg: number
  caffeineLogs: ICaffeineTodayLog[]
  pomoMinutes: number
  pomoSessions: number
  habitsCompleted: string[] // Habit IDs checked off today
  tasksCompleted: string[]  // Task IDs completed today
}

export interface ICumulativeStats {
  lifetimeCaffeineMg: number
  lifetimeCaffeineCups: number
  lifetimePomoMinutes: number
  lifetimePomoSessions: number
  lifetimeHabitsCount: number

  // Rolling history arrays (Capped at size 30 for weekly/monthly charts)
  caffeineHistory30Days: number[]
  pomoHistory30Days: number[]
  habitsHistory30Days: number[]
}

export interface IUserInfo {
  id: string
  userId: string
  xp: number
  taskLists: ITaskList[]
  settings: IUserSettings
  today: ITodayState
  stats: ICumulativeStats
  createdAt: string
  updatedAt: string
}

// ─── 2. TASKS & CHECKLISTS ─────────────────────────────────────────

export type TaskStatus = 'todo' | 'in-progress' | 'done'

export interface ISubtask {
  id: string
  title: string
  completed: boolean
}

export interface ITask {
  id: string
  userId: string
  title: string
  tags: string[]
  subtasks: ISubtask[]
  status: TaskStatus
  dueDate?: string
  createdAt: string
  completedAt?: string
  focusSessions?: number
  focusTime?: number
  scheduledTime?: string
  estimatedDuration?: number
  listId?: string
  linkedNoteIds?: string[]
  order?: number
  updatedAt: string
}

// ─── 3. HABIT DEFINITIONS ──────────────────────────────────────────

export interface IHabit {
  id: string
  userId: string
  name: string
  description: string
  frequency: string // 'daily' | 'weekly' | 'custom'
  createdAt: string
  updatedAt: string
  icon?: string
  color?: string
  customDays?: number[]     // Array of days: [1, 3, 5] (Mon, Wed, Fri)
  reminderTime?: string     // e.g. "09:00"
  goalTarget?: number       // For step-based habits (e.g. 8 glasses of water)
  goalUnit?: string         // e.g. "glasses"
  currentStreak: number
  longestStreak: number
  completedDates: string[]
  goalProgress?: Record<string, number>
  order?: number
}

// ─── 4. NOTES & KNOWLEDGE BASE ─────────────────────────────────────

export type NoteColor = 'none' | 'red' | 'orange' | 'green' | 'blue' | 'purple' | 'pink'

export interface INoteFolder {
  id: string
  name: string
}

export interface INote {
  id: string
  userId: string
  title: string
  content: string
  pinned: boolean
  color: NoteColor
  folderId?: string
  linkedTaskIds?: string[]
  audioMap?: Record<string, string>
  createdAt: string
  updatedAt: string
}
