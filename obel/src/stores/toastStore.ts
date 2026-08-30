import { create } from 'zustand'

interface ToastState {
  message: string | null
  undoAction: (() => void) | null
  isOpen: boolean
  
  showToast: (message: string, undoAction?: () => void) => void
  hideToast: () => void
  undo: () => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  message: null,
  undoAction: null,
  isOpen: false,

  showToast: (message, undoAction) => {
    set({ message, undoAction, isOpen: true })
  },

  hideToast: () => {
    set({ isOpen: false })
  },

  undo: () => {
    const { undoAction } = get()
    if (undoAction) {
      undoAction()
    }
    set({ isOpen: false, undoAction: null })
  }
}))
