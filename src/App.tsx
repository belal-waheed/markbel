import { useEffect, useRef, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { AuthProvider, useAuth } from './lib/auth.js'
import { ToastProvider } from './components/Toast.js'
import { PwaUpdateToast } from './components/PwaUpdateToast.js'
import { DatabaseErrorBoundary } from './components/DatabaseErrorBoundary.js'
import LandingPage from './views/LandingPage.js'
import { Loader2 } from 'lucide-react'

// Code-split major views with React.lazy
const LoginPage = lazy(() => import('./views/LoginPage.js'))
const BookmarksPage = lazy(() => import('./views/BookmarksPage.js'))
const SettingsPage = lazy(() => import('./views/SettingsPage.js'))
const ArchivePage = lazy(() => import('./views/ArchivePage.js'))
const SyncDebugPage = lazy(() => import('./views/SyncDebugPage.js'))
const ShareTargetPage = lazy(() => import('./views/ShareTargetPage.js'))

function NativeBridge() {
  const navigate = useNavigate()
  const location = useLocation()
  const hasBootedRef = useRef(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    // Initial native cold-boot routing: start directly in vault (/app)
    if (!hasBootedRef.current) {
      hasBootedRef.current = true
      if (location.pathname === '/' || location.pathname === '') {
        navigate('/app', { replace: true })
      }
    }

    // Configure native status bar to match Studio surface and prevent clipping
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#f6f5f0' }).catch(() => {})
    StatusBar.setStyle({ style: Style.Light }).catch(() => {})

    // Hide splash screen once React is mounted
    SplashScreen.hide().catch(() => {})

    // Hardware back button navigation
    const backHandlerPromise = CapApp.addListener('backButton', () => {
      if (location.pathname === '/app' || location.pathname === '/login') {
        CapApp.exitApp()
      } else {
        navigate(-1)
      }
    })

    // Deep link and app open listener
    const urlHandlerPromise = CapApp.addListener('appUrlOpen', (data) => {
      try {
        const urlObj = new URL(data.url)
        const path = urlObj.pathname + urlObj.search
        if (path) {
          navigate(path)
        }
      } catch (err) {
        console.warn('[NativeBridge] Failed to parse open URL:', err)
      }
    })

    // Check if initial share payload was injected during cold boot
    const initialShare = (window as any).__INITIAL_SHARE_PAYLOAD__
    if (initialShare && (initialShare.text || initialShare.url)) {
      const params = new URLSearchParams()
      if (initialShare.title) params.set('title', initialShare.title)
      if (initialShare.text) params.set('text', initialShare.text)
      if (initialShare.url) params.set('url', initialShare.url)
      delete (window as any).__INITIAL_SHARE_PAYLOAD__
      navigate(`/share?${params.toString()}`)
    }

    // Listen for custom native Android SEND intent events
    const handleNativeShare = (event: any) => {
      const detail = event.detail || {}
      const params = new URLSearchParams()
      if (detail.title) params.set('title', detail.title)
      if (detail.text) params.set('text', detail.text)
      if (detail.url) params.set('url', detail.url)
      navigate(`/share?${params.toString()}`)
    }

    window.addEventListener('markbel:shareIntent', handleNativeShare)

    return () => {
      backHandlerPromise.then((handle) => handle.remove()).catch(() => {})
      urlHandlerPromise.then((handle) => handle.remove()).catch(() => {})
      window.removeEventListener('markbel:shareIntent', handleNativeShare)
    }
  }, [navigate, location])

  return null
}

function PageFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-default)] gap-3 font-sans">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      <span className="text-xs font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">Loading...</span>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()

  if (loading) {
    return <PageFallback />
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <PwaUpdateToast />
        <DatabaseErrorBoundary>
          <Router>
            <NativeBridge />
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/landing" element={<Navigate to="/" replace />} />
                <Route path="/app" element={<BookmarksPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/share" element={<ShareTargetPage />} />
                <Route path="/archive" element={<ArchivePage />} />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sync-debug"
                  element={
                    <ProtectedRoute>
                      <SyncDebugPage />
                    </ProtectedRoute>
                  }
                />
                {/* Silently redirect bad /app/* sub-routes to /app */}
                <Route path="/app/*" element={<Navigate to="/app" replace />} />
                {/* Catch-all unknown routes redirect to landing page */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Router>
        </DatabaseErrorBoundary>
      </ToastProvider>
    </AuthProvider>
  )
}




