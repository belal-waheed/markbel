import { useEffect } from 'react'

type ShortcutAction = (e: KeyboardEvent) => void

interface ShortcutConfig {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  action: ShortcutAction
}

/**
 * A custom hook to manage keyboard shortcuts.
 * @param shortcuts An array of shortcut configurations.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (!e.key || !shortcut.key) continue
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()


        // If a modifier is NOT specified, we should ensure it's NOT pressed
        // to avoid conflicts (e.g., 'd' vs 'alt+d')
        const ctrlRequired = shortcut.ctrlKey || false
        const altRequired = shortcut.altKey || false
        const shiftRequired = shortcut.shiftKey || false

        if (
          keyMatch &&
          (e.ctrlKey || e.metaKey) === ctrlRequired &&
          e.altKey === altRequired &&
          e.shiftKey === shiftRequired
        ) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          shortcut.action(e)
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [shortcuts])
}
