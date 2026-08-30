import { useState, useCallback, useEffect } from 'react'

export interface ContextMenuState<T = any> {
  x: number
  y: number
  isOpen: boolean
  data: T | null
}

/**
 * A custom hook to manage Obsidian-style context menu coordinates and state.
 */
export function useContextMenu<T = any>() {
  const [state, setState] = useState<ContextMenuState<T>>({
    x: 0,
    y: 0,
    isOpen: false,
    data: null,
  })

  const openMenu = useCallback((e: React.MouseEvent | MouseEvent, data: T) => {
    e.preventDefault()
    e.stopPropagation()
    setState({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      data,
    })
  }, [])

  const closeMenu = useCallback(() => {
    setState((prev) => {
      if (!prev.isOpen) return prev
      return { ...prev, isOpen: false }
    })
  }, [])

  useEffect(() => {
    if (!state.isOpen) return

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target && target.closest && target.closest('[data-context-menu="true"]')) {
        return
      }
      closeMenu()
    }

    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu()
      }
    }

    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('contextmenu', handleGlobalClick)
    window.addEventListener('keydown', handleGlobalKeydown)

    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('contextmenu', handleGlobalClick)
      window.removeEventListener('keydown', handleGlobalKeydown)
    }
  }, [state.isOpen, closeMenu])

  return {
    ...state,
    openMenu,
    closeMenu,
  }
}
