import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import AuthGuard from '@/components/layout/AuthGuard'
import PWAUpdater from '@/components/layout/PWAUpdater'
import { ReloadPrompt } from '@/components/pwa/ReloadPrompt'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler'

// Static imports for initial view/login screen
import LoginPage from '@/views/LoginPage'

// Premium retry helper for lazy-loaded chunks to gracefully recover from ChunkLoadErrors
function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    // Clear dynamic chunk retry flag if it was successfully resolved previously
    if (typeof window !== 'undefined' && window.sessionStorage.getItem('chunk-reload-retry')) {
      setTimeout(() => {
        window.sessionStorage.removeItem('chunk-reload-retry')
      }, 5000)
    }

    try {
      return await componentImport()
    } catch (error) {
      console.error('Error loading dynamic chunk, attempting retry reload:', error)
      if (typeof window !== 'undefined') {
        const hasReloaded = window.sessionStorage.getItem('chunk-reload-retry')
        if (!hasReloaded) {
          window.sessionStorage.setItem('chunk-reload-retry', 'true')
          window.location.reload()
          return new Promise(() => {}) // Keep Suspense active while reloading
        }
      }
      throw error
    }
  })
}

// Lazy load heavy components with retry safeguards to ensure instant load times and complete chunk stability
const DashboardPage = lazyWithRetry(() => import('@/views/DashboardPage'))
const TasksPage = lazyWithRetry(() => import('@/views/TasksPage'))
const PomodoroPage = lazyWithRetry(() => import('@/views/PomodoroPage'))
const HabitsPage = lazyWithRetry(() => import('@/views/HabitsPage'))
const CalendarPage = lazyWithRetry(() => import('@/views/CalendarPage'))
const ProfilePage = lazyWithRetry(() => import('@/views/ProfilePage'))
const NotesPage = lazyWithRetry(() => import('@/views/NotesPage'))
const ReviewPage = lazyWithRetry(() => import('@/views/ReviewPage'))
const NotFoundPage = lazyWithRetry(() => import('@/views/NotFoundPage'))

// Premium, on-brand loading feedback component
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] w-full gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-xl bg-primary/20 border border-primary/30 animate-ping" />
        <div className="absolute inset-1 rounded-xl border-t-2 border-r-2 border-primary animate-spin" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
        Synchronizing Focus...
      </span>
    </div>
  )
}

export default function App() {
  useNotificationScheduler() // Activate notification scheduling logic
  
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // Start the background offline synchronization engine when authenticated
  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      import('@/lib/syncEngine').then(({ startSyncEngine }) => {
        startSyncEngine()
      }).catch(() => {})
    }
  }, [hasHydrated, isAuthenticated])


  // Synchronize DOM classes with saved theme store on startup
  useEffect(() => {
    const isDark = useThemeStore.getState().isDark
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Clear all notifications when the app is focused or becomes visible
  useEffect(() => {
    const handleClear = () => {
      if (document.visibilityState === 'visible' || document.hasFocus()) {
        import('@/lib/notifications').then(({ notificationSystem }) => {
          notificationSystem.clearAll()
        })
      }
    }

    window.addEventListener('focus', handleClear)
    document.addEventListener('visibilitychange', handleClear)

    handleClear()

    return () => {
      window.removeEventListener('focus', handleClear)
      document.removeEventListener('visibilitychange', handleClear)
    }
  }, [])

  return (
    <BrowserRouter>
      <PWAUpdater />
      <ReloadPrompt />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route element={<AuthGuard />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/pomodoro" element={<PomodoroPage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

