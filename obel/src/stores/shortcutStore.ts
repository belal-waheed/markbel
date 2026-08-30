import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '@/lib/storage'

export interface ShortcutBinding {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
}

export const DEFAULT_SHORTCUTS: Record<string, ShortcutBinding> = {
  toggleSidebar: { key: 'b', ctrlKey: true },
  commandMenu: { key: 'p', ctrlKey: true },
  togglePreview: { key: 'd', altKey: true },
  toggleZen: { key: 'z', altKey: true },
  cycleTabs: { key: '`', ctrlKey: true },
  closeNote: { key: 'x', altKey: true },
  toggleFold: { key: 'c', altKey: true },
  quickSearch: { key: 'o', ctrlKey: true },
}

interface ShortcutState {
  shortcuts: Record<string, ShortcutBinding>
  updateShortcut: (action: string, binding: ShortcutBinding) => void
  resetShortcuts: () => void
}

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set) => ({
      shortcuts: { ...DEFAULT_SHORTCUTS },
      updateShortcut: (action, binding) => {
        set((state) => ({
          shortcuts: {
            ...state.shortcuts,
            [action]: binding,
          },
        }))
      },
      resetShortcuts: () => {
        set({ shortcuts: { ...DEFAULT_SHORTCUTS } })
      },
    }),
    {
      name: 'obel-shortcuts',
      storage: createJSONStorage(() => indexedDBStorage),
    }
  )
)
