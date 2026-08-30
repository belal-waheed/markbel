/**
 * backup.ts — Obel Backup & Restore System
 *
 * Design decisions:
 * - Backup = a single JSON file containing all storage keys + metadata
 * - Values are stored as raw strings (already Zustand-serialized JSON)
 * - Version field allows future migrations
 * - Restoration writes to IndexedDB first, then forces Zustand rehydration
 *   via each store's `persist.rehydrate()` — avoids a full page reload whenever possible
 */

import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useNoteStore } from '@/stores/noteStore'
import { useTimerStore } from '@/stores/timerStore'
import { useCoffeeStore } from '@/stores/coffeeStore'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { get, set as idbSet } from 'idb-keyval'

// ─── Constants ────────────────────────────────────────────────────────────────

export const BACKUP_VERSION = 1

/**
 * Every persisted storage key that Obel owns.
 * Add new keys here if you add new persisted stores.
 */
export const OBEL_STORAGE_KEYS = [
  'obel-auth',
  'obel-tasks',
  'obel-habits',
  'obel-notes',
  'obel-timer',
  'obel-coffee',
  'obel-theme-store',
] as const

export type ObelStorageKey = (typeof OBEL_STORAGE_KEYS)[number]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackupMetadata {
  version: number
  createdAt: string         // ISO-8601
  appName: 'obel'
  userEmail?: string        // informational only — not used during restore
  counts: {
    tasks: number
    habits: number
    notes: number
    coffeeLogs: number
  }
}

export interface ObelBackup {
  meta: BackupMetadata
  data: Partial<Record<ObelStorageKey, string | null>>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  preview: BackupMetadata | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Extract a count from a Zustand persist snapshot safely */
function extractCount(raw: string | null | undefined, path: string[]): number {
  const parsed = safeParse<Record<string, unknown>>(raw, {})
  let node: unknown = parsed
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return 0
    node = (node as Record<string, unknown>)[key]
  }
  return Array.isArray(node) ? node.length : 0
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function createBackup(): Promise<ObelBackup> {
  const data: ObelBackup['data'] = {}

  for (const key of OBEL_STORAGE_KEYS) {
    data[key] = (await get(key)) || null
  }

  const userEmail = safeParse<{ state?: { user?: { email?: string } } }>(
    data['obel-auth'], {}
  ).state?.user?.email

  const meta: BackupMetadata = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appName: 'obel',
    userEmail,
    counts: {
      tasks:      extractCount(data['obel-tasks'],   ['state', 'tasks']),
      habits:     extractCount(data['obel-habits'],  ['state', 'habits']),
      notes:      extractCount(data['obel-notes'],   ['state', 'notes']),
      coffeeLogs: extractCount(data['obel-coffee'],  ['state', 'logs']),
    },
  }

  return { meta, data }
}

export function downloadBackup(backup: ObelBackup): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const date = new Date().toISOString().split('T')[0]

  const a = document.createElement('a')
  a.href     = url
  a.download = `obel_backup_${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Validate ─────────────────────────────────────────────────────────────────

/**
 * Validates a parsed backup object before touching storage.
 * Returns a structured result — the caller decides what to do.
 */
export function validateBackup(raw: unknown): ValidationResult {
  const errors: string[]   = []
  const warnings: string[] = []

  // 1. Must be a plain object
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, errors: ['Backup file is not a valid JSON object.'], warnings, preview: null }
  }

  const obj = raw as Record<string, unknown>

  // 2. Must have meta block
  if (!obj.meta || typeof obj.meta !== 'object') {
    errors.push('Missing or malformed "meta" block. This may not be an Obel backup.')
  }

  // 3. Must have data block
  if (!obj.data || typeof obj.data !== 'object') {
    errors.push('Missing or malformed "data" block.')
  }

  if (errors.length) {
    return { valid: false, errors, warnings, preview: null }
  }

  const meta = obj.meta as Record<string, unknown>
  const data = obj.data as Record<string, unknown>

  // 4. App name check
  if (meta.appName !== 'obel') {
    errors.push(`Backup is from a different app ("${meta.appName}"). Expected "obel".`)
  }

  // 5. Version check
  if (typeof meta.version !== 'number') {
    errors.push('Backup version is missing or not a number.')
  } else if (meta.version > BACKUP_VERSION) {
    errors.push(
      `Backup version (${meta.version}) is newer than this app supports (${BACKUP_VERSION}). Please update Obel first.`
    )
  }

  // 6. At least one meaningful key must exist
  const knownKeysFound = OBEL_STORAGE_KEYS.filter(
    (k) => k in data && typeof data[k] === 'string' && (data[k] as string).length > 0
  )
  if (knownKeysFound.length === 0) {
    errors.push('Backup contains no recognizable Obel data.')
  }

  // 7. Validate each value is parseable JSON (warn, not error)
  for (const key of knownKeysFound) {
    try {
      JSON.parse(data[key] as string)
    } catch {
      warnings.push(`Store "${key}" contains malformed JSON and will be skipped.`)
    }
  }

  // 8. Warn if tasks key is missing (most important store)
  if (!data['obel-tasks']) {
    warnings.push('Backup does not include task data ("obel-tasks").')
  }

  if (errors.length) {
    return { valid: false, errors, warnings, preview: null }
  }

  const preview: BackupMetadata = {
    version:   meta.version   as number,
    createdAt: (meta.createdAt as string) ?? '',
    appName:   'obel',
    userEmail: meta.userEmail as string | undefined,
    counts: {
      tasks:      ((meta.counts as Record<string, number>)?.tasks)      ?? 0,
      habits:     ((meta.counts as Record<string, number>)?.habits)     ?? 0,
      notes:      ((meta.counts as Record<string, number>)?.notes)      ?? 0,
      coffeeLogs: ((meta.counts as Record<string, number>)?.coffeeLogs) ?? 0,
    },
  }

  return { valid: true, errors, warnings, preview }
}

// ─── Restore ─────────────────────────────────────────────────────────────────

export interface RestoreResult {
  success: boolean
  restoredKeys: string[]
  skippedKeys: string[]
  error?: string
  requiresReload: boolean
}

/**
 * Applies a validated backup to IndexedDB and rehydrates Zustand stores.
 *
 * Strategy:
 * 1. Write all valid keys to storage atomically (best-effort)
 * 2. Call `rehydrate()` on each Zustand store that supports it
 * 3. If rehydration isn't possible (old store version), set `requiresReload: true`
 */
export async function applyBackup(backup: ObelBackup): Promise<RestoreResult> {
  const restoredKeys: string[] = []
  const skippedKeys:  string[] = []

  // Step 1 — Write to storage (IndexedDB)
  for (const key of OBEL_STORAGE_KEYS) {
    const value = backup.data[key]

    // Skip if null/undefined or empty string
    if (!value) {
      skippedKeys.push(key)
      continue
    }

    // Validate parseable before writing
    try {
      JSON.parse(value)
    } catch {
      skippedKeys.push(key)
      continue
    }

    try {
      await idbSet(key, value)
      restoredKeys.push(key)
    } catch (e) {
      // Storage quota exceeded or security error
      console.error(`Failed to restore "${key}":`, e)
      skippedKeys.push(key)
    }
  }

  if (restoredKeys.length === 0) {
    return {
      success: false,
      restoredKeys,
      skippedKeys,
      error: 'No data could be written to storage. Check browser storage permissions.',
      requiresReload: false,
    }
  }

  // Step 2 — Rehydrate Zustand stores
  // Zustand persist middleware exposes `rehydrate` on the store's `persist` API.
  // This is safer than a full page reload for in-session restores.
  let requiresReload = false

  try {
    const rehydrationPromises = [
      useTaskStore.persist.rehydrate(),
      useHabitStore.persist.rehydrate(),
      useNoteStore.persist.rehydrate(),
      useTimerStore.persist.rehydrate(),
      useCoffeeStore.persist.rehydrate(),
      useAuthStore.persist.rehydrate(),
      useThemeStore.persist.rehydrate(),
    ]
    await Promise.all(rehydrationPromises)

    // Trigger storage event so other tabs/listeners (like Theme provider)
    // catch the change immediately even if rehydrate() has limits.
    window.dispatchEvent(new Event('storage'))
  } catch (e) {
    // rehydrate() might not exist on older zustand versions — fall back to reload
    console.warn('Store rehydration failed, reload required:', e)
    requiresReload = true
  }

  return { success: true, restoredKeys, skippedKeys, requiresReload }
}

// ─── Parse file ───────────────────────────────────────────────────────────────

/** Read and parse a File object. Rejects with a user-friendly message on failure. */
export function parseBackupFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith('.json')) {
      reject(new Error('Please select a .json backup file.'))
      return
    }
    if (file.size > 10 * 1024 * 1024) { // 10 MB guard
      reject(new Error('File is too large. Obel backups should be under 10 MB.'))
      return
    }

    const reader = new FileReader()
    reader.onload  = (e) => {
      try {
        resolve(JSON.parse(e.target?.result as string))
      } catch {
        reject(new Error('File is not valid JSON. It may be corrupted.'))
      }
    }
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsText(file)
  })
}
