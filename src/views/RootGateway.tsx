import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../lib/auth.js'
import BookmarksPage from './BookmarksPage.js'
import LandingPage from './LandingPage.js'
import { Loader2 } from 'lucide-react'

export default function RootGateway() {
  const [searchParams] = useSearchParams()
  const forceLanding = searchParams.get('landing') === 'true'
  const { token, loading } = useAuth()

  const [guestLaunched, setGuestLaunched] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('markbel_guest_initialized') === 'true'
  })

  // Prevent flash of content during token verification
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-main)] gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        <span className="text-xs font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
          Loading Markbel...
        </span>
      </div>
    )
  }

  // Explicit landing parameter override (e.g. /?landing=true)
  if (forceLanding) {
    return (
      <LandingPage
        forceShow
        onLaunchApp={() => {
          localStorage.setItem('markbel_guest_initialized', 'true')
          setGuestLaunched(true)
        }}
      />
    )
  }

  // Native Android/Capacitor environment always goes straight to Bookmarks Vault
  if (Capacitor.isNativePlatform()) {
    return <BookmarksPage />
  }

  // Authenticated user always goes directly to Bookmarks Vault
  if (token) {
    return <BookmarksPage />
  }

  // Returning guest who already launched or organized bookmarks
  if (guestLaunched) {
    return <BookmarksPage />
  }

  // First-time web visitor sees the brand landing page
  return (
    <LandingPage
      onLaunchApp={() => {
        localStorage.setItem('markbel_guest_initialized', 'true')
        setGuestLaunched(true)
      }}
    />
  )
}
