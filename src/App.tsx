import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { AuthProvider, useAuth } from './lib/auth.js'
import { ToastProvider } from './components/Toast.js'
import LoginPage from './views/LoginPage.js'
import BookmarksPage from './views/BookmarksPage.js'
import SettingsPage from './views/SettingsPage.js'
import ArchivePage from './views/ArchivePage.js'
import SyncDebugPage from './views/SyncDebugPage.js'
import ShareTargetPage from './views/ShareTargetPage.js'
import { Loader2 } from 'lucide-react'

function NativeBridge() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    // Configure cyberpunk native status bar
    StatusBar.setBackgroundColor({ color: '#090d16' }).catch(() => {})
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})

    // Hide splash screen once React is mounted
    SplashScreen.hide().catch(() => {})

    // Hardware back button navigation
    const backHandlerPromise = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (location.pathname !== '/' && location.pathname !== '/login') {
        navigate(-1)
      } else {
        CapApp.exitApp()
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-default)] gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        <span className="text-xs font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">Loading Markbel...</span>
      </div>
    )
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
        <Router>
          <NativeBridge />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<BookmarksPage />} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  )
}


