import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useAuthStore } from './authStore'

// Theme colors matching index.css
const THEME_COLORS = { light: '#f8f4fa', dark: '#100d12' } as const

/** Apply dark/light class and update <meta name="theme-color"> for mobile browser chrome */
function applyTheme(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  // Update the mobile browser chrome color
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', isDark ? THEME_COLORS.dark : THEME_COLORS.light)
  }
}

interface ThemeState {
  isDark: boolean
  setIsDark: (isDark: boolean) => void
  toggleTheme: () => void
  loadFromUser: () => void
  saveToUser: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true,
      setIsDark: (isDark) => {
        set({ isDark })
        applyTheme(isDark)
        get().saveToUser()
      },
      toggleTheme: () => {
        set((state) => {
          const next = !state.isDark
          applyTheme(next)
          return { isDark: next }
        })
        // Delay slightly so set() completes before we read the new value
        setTimeout(() => get().saveToUser(), 0)
      },

      loadFromUser: () => {
        const user = useAuthStore.getState().user
        if (!user || user.activeTheme === undefined) return
        try {
          const isDark = user.activeTheme === 'dark'
          set({ isDark })
          applyTheme(isDark)
        } catch {
          // Use local default
        }
      },

      saveToUser: () => {
        const user = useAuthStore.getState().user
        if (!user) return
        const { isDark } = get()
        useAuthStore.getState().updateUser({
          activeTheme: isDark ? 'dark' : 'light',
        })
      },
    }),
    {
      name: 'obel-theme-store',
      // Use standard localStorage for synchronous theme application on load
      storage: createJSONStorage(() => localStorage),
    }
  )
)
