import { get, set, del } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'

/** 
 * Custom Zustand Storage engine using IndexedDB (idb-keyval)
 * Moves heavy serialization and disk I/O off the main thread.
 * 
 * Supports migration from localStorage if data exists.
 */
export const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // 1. Try IndexedDB first (primary storage)
    const value = await get(name)
    if (value !== undefined) return value

    // 2. Fallback: Check localStorage for legacy data
    const localValue = localStorage.getItem(name)
    if (localValue !== null) {
      console.log(`[Storage] Migrating ${name} from localStorage to IndexedDB...`)
      try {
        await set(name, localValue)
        // Cleanup localStorage now that it's safe in IndexedDB
        localStorage.removeItem(name)
        return localValue
      } catch (err) {
        console.error(`[Storage] Failed to migrate ${name}:`, err)
        return localValue
      }
    }

    return null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value)
    // Preemptive Strike: Ensure this key never exists in localStorage
    localStorage.removeItem(name)
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name)
    // Also remove from localStorage in case a legacy key exists
    localStorage.removeItem(name)
  },
}

/** 
 * Scans localStorage and removes any keys starting with 'obel-'
 * to ensure we are purely using IndexedDB.
 */
export async function scrubLocalStorage() {
  const keys = Object.keys(localStorage)
  const obelKeys = keys.filter(k => k.startsWith('obel-') && k !== 'obel-theme-store')
  
  if (obelKeys.length > 0) {
    console.log(`[Storage] Scrubbing ${obelKeys.length} legacy keys from localStorage...`)
    for (const key of obelKeys) {
      localStorage.removeItem(key)
    }
  }
}

/** Utility to check storage health and usage */
export async function getStorageStats() {
  const localStorageUsage = JSON.stringify(localStorage).length
  
  // IndexedDB usage is harder to calculate exactly without walking everything,
  // but we can at least check if it's available.
  const isIDBAvailable = typeof indexedDB !== 'undefined'
  
  // Browser Quota API
  let quotaInfo = { usage: 0, quota: 0 }
  if (navigator.storage && navigator.storage.estimate) {
    quotaInfo = await navigator.storage.estimate() as { usage: number, quota: number }
  }

  return {
    lsBytes: localStorageUsage,
    idbAvailable: isIDBAvailable,
    quota: quotaInfo.quota,
    usage: quotaInfo.usage,
    percentage: quotaInfo.quota ? Math.round((quotaInfo.usage / quotaInfo.quota) * 100) : 0
  }
}

/** Clear all local data */
export async function clearAllLocalData() {
  localStorage.clear()
  if (typeof indexedDB !== 'undefined') {
    const dbs = await window.indexedDB.databases()
    dbs.forEach(db => {
      if (db.name) window.indexedDB.deleteDatabase(db.name)
    })
  }
  window.location.reload()
}
