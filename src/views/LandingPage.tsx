import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.js'
import { ExtensionSetupModal } from '../components/modals/ExtensionSetupModal'
import { ReleaseNotesModal } from '../components/modals/ReleaseNotesModal'

// Modular Feature Components
import {
  detectPlatform,
  type PlatformType,
  type PlatformInfo,
  type DemoBookmark,
  INITIAL_DEMO_BOOKMARKS,
  FAQ_ITEMS,
  CURRENT_RELEASE_VERSION
} from '../components/landing/landingConstants.js'
import LandingTopBanner from '../components/landing/LandingTopBanner.js'
import LandingNavbar from '../components/landing/LandingNavbar.js'
import HeroSection from '../components/landing/HeroSection.js'
import InteractiveDemoSection from '../components/landing/InteractiveDemoSection.js'
import FeatureShowcaseSection from '../components/landing/FeatureShowcaseSection.js'
import ComparisonSection from '../components/landing/ComparisonSection.js'
import PlatformDownloadsSection from '../components/landing/PlatformDownloadsSection.js'
import FaqSection from '../components/landing/FaqSection.js'
import LandingFooter from '../components/landing/LandingFooter.js'

// Backward compatibility re-exports
export type { PlatformType, PlatformInfo, DemoBookmark }
export { detectPlatform, INITIAL_DEMO_BOOKMARKS, FAQ_ITEMS }

export interface LandingPageProps {
  onLaunchApp?: () => void
  forceShow?: boolean
}

export default function LandingPage({ onLaunchApp }: LandingPageProps) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const detectedPlatform = useMemo(() => detectPlatform(), [])
  const isReturningUser = Boolean(
    token || (typeof window !== 'undefined' && localStorage.getItem('markbel_guest_initialized') === 'true')
  )

  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false)
  const [extensionModalTab, setExtensionModalTab] = useState<'chrome' | 'firefox'>('chrome')
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false)

  const handleLaunch = () => {
    if (onLaunchApp) {
      onLaunchApp()
    } else {
      localStorage.setItem('markbel_guest_initialized', 'true')
      navigate('/app')
    }
  }

  const handleSignIn = () => {
    navigate('/login?redirect=/app')
  }

  const handleOpenGuestVault = () => {
    localStorage.setItem('markbel_guest_initialized', 'true')
    navigate('/app')
  }

  const handleOpenExtensionModal = (tab: 'chrome' | 'firefox') => {
    setExtensionModalTab(tab)
    setIsExtensionModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] text-[var(--color-text-primary)] font-sans antialiased selection:bg-[var(--color-accent)]/20 selection:text-inherit">
      {/* Top Banner / Announcement */}
      <LandingTopBanner
        version={CURRENT_RELEASE_VERSION}
        onOpenReleaseNotes={() => setIsReleaseModalOpen(true)}
      />

      {/* Sticky Navigation Bar */}
      <LandingNavbar
        token={token}
        isReturningUser={isReturningUser}
        onLaunchApp={handleLaunch}
        onSignIn={handleSignIn}
      />

      {/* Hero Section */}
      <HeroSection
        onLaunchApp={handleLaunch}
        detectedPlatform={detectedPlatform}
        isReturningUser={isReturningUser}
      />

      {/* Interactive Product Canvas */}
      <InteractiveDemoSection />

      {/* Bento Grid: 4 Architectural Pillars */}
      <FeatureShowcaseSection />

      {/* Side-by-Side Comparison Matrix */}
      <ComparisonSection />

      {/* Cross-Platform Ecosystem Download Cards */}
      <PlatformDownloadsSection
        detectedPlatform={detectedPlatform}
        onOpenExtensionModal={handleOpenExtensionModal}
        onLaunchApp={handleLaunch}
        onOpenGuestVault={handleOpenGuestVault}
      />

      {/* Interactive FAQ Accordion */}
      <FaqSection />

      {/* Pre-Footer & Global Footer */}
      <LandingFooter
        version={CURRENT_RELEASE_VERSION}
        onLaunchApp={handleLaunch}
        onOpenReleaseNotes={() => setIsReleaseModalOpen(true)}
        onSignIn={handleSignIn}
      />

      {/* Interactive Modals */}
      <ExtensionSetupModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
        initialTab={extensionModalTab}
      />
      <ReleaseNotesModal
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
      />
    </div>
  )
}
