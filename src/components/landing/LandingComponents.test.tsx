import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import {
  detectPlatform,
  INITIAL_DEMO_BOOKMARKS,
  FAQ_ITEMS,
  ARCHITECTURE_COMPARISONS,
  filterDemoBookmarks,
  toggleBookmarkPin,
  type DemoBookmark
} from './landingConstants.js'
import { LandingTopBanner } from './LandingTopBanner.js'
import { LandingNavbar } from './LandingNavbar.js'
import { HeroSection } from './HeroSection.js'
import { InteractiveDemoSection } from './InteractiveDemoSection.js'
import { FeatureShowcaseSection } from './FeatureShowcaseSection.js'
import { ComparisonSection } from './ComparisonSection.js'
import { PlatformDownloadsSection } from './PlatformDownloadsSection.js'
import { FaqSection } from './FaqSection.js'
import { LandingFooter } from './LandingFooter.js'

function renderCleanHtml(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, '')
}

function findElementInTree(element: any, predicate: (el: any) => boolean): any {
  if (!element || typeof element !== 'object') return null
  if (predicate(element)) return element
  if (element.props && element.props.children) {
    const children = Array.isArray(element.props.children)
      ? element.props.children
      : [element.props.children]
    for (const child of children) {
      const found = findElementInTree(child, predicate)
      if (found) return found
    }
  }
  return null
}

describe('Landing Page Modular Components Suite (Phase 6 Modernization)', () => {
  describe('1. Platform Auto-Detection (detectPlatform)', () => {
    it('detects Android devices accurately from mobile user agent string', () => {
      // Arrange
      const androidUA =
        'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UD1A.230803.041) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'

      // Act
      const platform = detectPlatform(androidUA)

      // Assert
      expect(platform.type).toBe('android')
      expect(platform.name).toBe('Android APK')
      expect(platform.label).toBe('Android Device')
    })

    it('detects iOS devices accurately from iPhone user agent string', () => {
      // Arrange
      const iphoneUA =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'

      // Act
      const platform = detectPlatform(iphoneUA)

      // Assert
      expect(platform.type).toBe('ios')
      expect(platform.name).toBe('Web PWA (iOS)')
      expect(platform.label).toBe('iOS Device')
    })

    it('detects Mozilla Firefox accurately from desktop user agent string', () => {
      // Arrange
      const firefoxUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0'

      // Act
      const platform = detectPlatform(firefoxUA)

      // Assert
      expect(platform.type).toBe('firefox')
      expect(platform.name).toBe('Firefox Add-on')
      expect(platform.label).toBe('Mozilla Firefox')
    })

    it('detects Microsoft Edge accurately from desktop user agent string', () => {
      // Arrange
      const edgeUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.2739.42'

      // Act
      const platform = detectPlatform(edgeUA)

      // Assert
      expect(platform.type).toBe('chrome')
      expect(platform.name).toBe('Browser Extension')
      expect(platform.label).toBe('Chromium Browser')
    })

    it('detects Google Chrome / Chromium accurately from desktop user agent string', () => {
      // Arrange
      const chromeUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

      // Act
      const platform = detectPlatform(chromeUA)

      // Assert
      expect(platform.type).toBe('chrome')
      expect(platform.name).toBe('Browser Extension')
      expect(platform.label).toBe('Chromium Browser')
    })

    it('falls back to desktop Web PWA for generic desktop / Safari agents or empty strings', () => {
      // Arrange
      const safariUA =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

      // Act
      const platformSafari = detectPlatform(safariUA)
      const platformEmpty = detectPlatform('')

      // Assert
      expect(platformSafari.type).toBe('desktop')
      expect(platformSafari.name).toBe('Web PWA')
      expect(platformSafari.label).toBe('Desktop Browser')

      expect(platformEmpty.type).toBe('desktop')
      expect(platformEmpty.name).toBe('Web PWA')
    })
  })

  describe('2. LandingTopBanner Component', () => {
    it('renders the banner markup and triggers onOpenReleaseNotes callback', () => {
      // Arrange
      const onOpenReleaseNotes = vi.fn()
      const jsx = (
        <LandingTopBanner
          onOpenReleaseNotes={onOpenReleaseNotes}
          version="v2.5.9"
        />
      )

      // Act: verify static HTML rendering
      const html = renderCleanHtml(jsx)

      // Assert
      expect(html).toContain('Markbel v2.5.9 is live')
      expect(html).toContain('v2.5.9 Notes')
      expect(html).toContain('Nested App Subroutes')

      // Act: trigger onClick handler from React element tree
      const renderedTree = LandingTopBanner({
        onOpenReleaseNotes,
        version: 'v2.5.9'
      })
      const buttonElement = findElementInTree(
        renderedTree,
        (el) => el.type === 'button' && typeof el.props?.onClick === 'function'
      )
      expect(buttonElement).not.toBeNull()
      buttonElement.props.onClick()

      // Assert callback executed
      expect(onOpenReleaseNotes).toHaveBeenCalledTimes(1)
    })
  })

  describe('3. HeroSection Component', () => {
    it('renders headline, value proposition and triggers onLaunchApp callback', () => {
      // Arrange
      const onLaunchApp = vi.fn()
      const detectedPlatform = {
        type: 'android' as const,
        name: 'Android APK',
        label: 'Android Device'
      }

      const jsx = (
        <HeroSection
          onLaunchApp={onLaunchApp}
          detectedPlatform={detectedPlatform}
        />
      )

      // Act: verify static rendering
      const html = renderCleanHtml(jsx)

      // Assert
      expect(html).toContain('All your links.')
      expect(html).toContain('Zero latency. Everywhere.')
      expect(html).toContain('Offline-First Personal Vault &amp; Media Archiver')
      expect(html).toContain('Get Markbel for Android APK')

      // Act: trigger launch callback
      const renderedTree = HeroSection({
        onLaunchApp,
        detectedPlatform
      })
      const launchButton = findElementInTree(
        renderedTree,
        (el) => el.type === 'button' && typeof el.props?.onClick === 'function'
      )
      expect(launchButton).not.toBeNull()
      launchButton.props.onClick()

      // Assert
      expect(onLaunchApp).toHaveBeenCalledTimes(1)
    })
  })

  describe('4. InteractiveDemoSection Filtering & Pinning Logic', () => {
    const sampleBookmarks: DemoBookmark[] = [
      {
        id: '1',
        title: 'React 19 Server Components',
        url: 'https://react.dev',
        domain: 'react.dev',
        group: 'Dev',
        groupColor: 'blue',
        tags: ['react', 'nextjs'],
        description: 'Deep dive into React 19 Server Components.',
        isPinned: true
      },
      {
        id: '2',
        title: 'Cloudflare D1 Edge SQLite',
        url: 'https://cloudflare.com',
        domain: 'cloudflare.com',
        group: 'Articles',
        groupColor: 'amber',
        tags: ['edge', 'sqlite'],
        description: 'Architecting distributed SQLite databases.',
        isPinned: false
      },
      {
        id: '3',
        title: 'Motion Animation Tutorial',
        url: 'https://youtube.com',
        domain: 'youtube.com',
        group: 'Video',
        groupColor: 'red',
        tags: ['animation', 'framer'],
        description: 'Physics-driven gestures and layouts.',
        isPinned: false
      }
    ]

    it('filters bookmarks strictly by category group', () => {
      // Arrange & Act
      const devOnly = filterDemoBookmarks(sampleBookmarks, 'Dev', '')
      const articlesOnly = filterDemoBookmarks(sampleBookmarks, 'Articles', '')
      const allBookmarks = filterDemoBookmarks(sampleBookmarks, 'All', '')

      // Assert
      expect(devOnly.length).toBe(1)
      expect(devOnly[0].id).toBe('1')

      expect(articlesOnly.length).toBe(1)
      expect(articlesOnly[0].id).toBe('2')

      expect(allBookmarks.length).toBe(3)
    })

    it('filters bookmarks by title, description, and tags with case-insensitivity', () => {
      // Search by title keyword
      const byTitle = filterDemoBookmarks(sampleBookmarks, 'All', 'Components')
      expect(byTitle.length).toBe(1)
      expect(byTitle[0].id).toBe('1')

      // Search by description keyword
      const byDesc = filterDemoBookmarks(sampleBookmarks, 'All', 'distributed')
      expect(byDesc.length).toBe(1)
      expect(byDesc[0].id).toBe('2')

      // Search by tag
      const byTag = filterDemoBookmarks(sampleBookmarks, 'All', 'framer')
      expect(byTag.length).toBe(1)
      expect(byTag[0].id).toBe('3')

      // Search with non-matching query
      const nonMatching = filterDemoBookmarks(sampleBookmarks, 'All', 'nonexistent_query_xyz')
      expect(nonMatching.length).toBe(0)
    })

    it('toggles bookmark pin status deterministically without mutating original array', () => {
      // Arrange
      const initial = sampleBookmarks

      // Act: toggle unpinned to pinned
      const toggled1 = toggleBookmarkPin(initial, '2')

      // Assert
      expect(toggled1.find((b) => b.id === '2')?.isPinned).toBe(true)
      expect(initial.find((b) => b.id === '2')?.isPinned).toBe(false) // immutability

      // Act: toggle pinned to unpinned
      const toggled2 = toggleBookmarkPin(toggled1, '2')
      expect(toggled2.find((b) => b.id === '2')?.isPinned).toBe(false)
    })

    it('renders the InteractiveDemoSection component markup with demo items', () => {
      // Arrange
      const jsx = <InteractiveDemoSection initialBookmarks={sampleBookmarks} />

      // Act
      const html = renderCleanHtml(jsx)

      // Assert
      expect(html).toContain('Markbel Interactive Vault Demo')
      expect(html).toContain('React 19 Server Components')
      expect(html).toContain('Cloudflare D1 Edge SQLite')
    })
  })

  describe('5. FaqSection Accordion Component', () => {
    it('renders FAQ questions and answers accurately', () => {
      // Arrange
      const jsx = <FaqSection items={FAQ_ITEMS} />

      // Act
      const html = renderCleanHtml(jsx)

      // Assert
      expect(html).toContain('Frequently Asked Questions')
      expect(html).toContain('What is Markbel?')
      expect(html).toContain('Is Markbel free and open-source?')
      expect(html).toContain('Cloudflare D1 SQLite')
    })
  })

  describe('6. ComparisonSection & Architecture Matrix', () => {
    it('defines all core technical comparison vectors with Markbel superiority', () => {
      // Arrange
      const features = ARCHITECTURE_COMPARISONS.map((c) => c.feature)

      // Assert
      expect(features).toContain('Data Persistence')
      expect(features).toContain('Synchronization Model')
      expect(features).toContain('Telemetry & Privacy')
      expect(features).toContain('AI Agent & Tool Integration')
      expect(features).toContain('Spotlight Command Bar')
      expect(features).toContain('Open Governance & Freedom')

      // All Markbel capabilities should be fully supported
      const allSupported = ARCHITECTURE_COMPARISONS.every((c) => c.markbel.supported === true)
      expect(allSupported).toBe(true)

      // Traditional cloud should lack local-first guarantees
      const allTraditionalUnsupp = ARCHITECTURE_COMPARISONS.every(
        (c) => c.traditional.supported === false
      )
      expect(allTraditionalUnsupp).toBe(true)
    })

    it('renders the comparison table markup', () => {
      // Arrange
      const jsx = <ComparisonSection comparisons={ARCHITECTURE_COMPARISONS} />

      // Act
      const html = renderCleanHtml(jsx)

      // Assert
      expect(html).toContain('How Markbel Compares')
      expect(html).toContain('Markbel Architecture')
      expect(html).toContain('Traditional Cloud Bookmarkers')
      expect(html).toContain('Offline-First Dexie (IndexedDB)')
    })
  })

  describe('7. PlatformDownloadsSection & Perpetual Release URLs', () => {
    it('enforces permanent latest GitHub release download links across all cards', () => {
      // Arrange
      const detectedPlatform = {
        type: 'chrome' as const,
        name: 'Browser Extension',
        label: 'Chromium Browser'
      }
      const onOpenExtensionModal = vi.fn()
      const onLaunchApp = vi.fn()

      const jsx = (
        <PlatformDownloadsSection
          detectedPlatform={detectedPlatform}
          onOpenExtensionModal={onOpenExtensionModal}
          onLaunchApp={onLaunchApp}
        />
      )

      // Act
      const html = renderCleanHtml(jsx)

      // Assert perpetual URLs (Mandatory Release Governance)
      expect(html).toContain(
        'https://github.com/belal-waheed/markbel/releases/latest/download/Markbel.apk'
      )
      expect(html).toContain(
        'https://github.com/belal-waheed/markbel/releases/latest/download/markbel-firefox-extension.zip'
      )
      expect(html).toContain(
        'https://github.com/belal-waheed/markbel/releases/latest/download/markbel-extension.zip'
      )
      expect(html).toContain('https://github.com/belal-waheed/markbel/releases/latest')
      expect(html).toContain('Browser Extension')
      expect(html).toContain('Android App')
      expect(html).toContain('Web PWA &amp; Guest Vault')
      expect(html).not.toContain('Microsoft Edge Add-ons Store')
      expect(html).not.toContain('molmflphbifkekgnobnflblphdefpjfc')
    })

    it('invokes modal callback with appropriate browser tab identifier', () => {
      // Arrange
      const onOpenExtensionModal = vi.fn()
      const renderedTree = PlatformDownloadsSection({
        detectedPlatform: { type: 'firefox', name: 'Firefox', label: 'Firefox' },
        onOpenExtensionModal,
        onLaunchApp: vi.fn()
      })

      // Act: find button for Firefox setup guide
      const buttons: any[] = []
      function collectButtons(el: any) {
        if (!el || typeof el !== 'object') return
        if (el.type === 'button' && typeof el.props?.onClick === 'function') {
          buttons.push(el)
        }
        if (el.props?.children) {
          const children = Array.isArray(el.props.children)
            ? el.props.children
            : [el.props.children]
          children.forEach(collectButtons)
        }
      }
      collectButtons(renderedTree)

      // Find Firefox setup button and invoke
      const firefoxButton = buttons.find((b: any) =>
        renderCleanHtml(b).includes('Firefox Setup Guide')
      )
      expect(firefoxButton).toBeDefined()
      firefoxButton.props.onClick()

      // Assert
      expect(onOpenExtensionModal).toHaveBeenCalledWith('firefox')
    })
  })

  describe('8. FeatureShowcaseSection & Architectural Pillars', () => {
    it('renders all 4 architectural pillars and Spotlight command launcher preview', () => {
      // Arrange
      const jsx = <FeatureShowcaseSection />

      // Act
      const html = renderCleanHtml(jsx)

      // Assert
      expect(html).toContain('In-Page Spotlight Launcher')
      expect(html).toContain('Pillar 1: Offline-First IndexedDB')
      expect(html).toContain('Pillar 2: Cloudflare Edge Delta Sync')
      expect(html).toContain('Pillar 3: Zero Telemetry &amp; Privacy')
      expect(html).toContain('Pillar 4: Native MCP Studio')
      expect(html).toContain('Alt+O')
      expect(html).toContain('@markbel/mcp')
    })
  })

  describe('9. LandingNavbar & LandingFooter Navigation Integration', () => {
    it('renders LandingNavbar with launch and sign in triggers', () => {
      // Arrange
      const onLaunchApp = vi.fn()
      const onSignIn = vi.fn()
      const jsx = (
        <LandingNavbar
          token={null}
          onLaunchApp={onLaunchApp}
          onSignIn={onSignIn}
        />
      )

      // Act
      const html = renderCleanHtml(jsx)

      // Assert
      expect(html).toContain('Markbel')
      expect(html).toContain('Bookmarks Vault')
      expect(html).toContain('Live Preview')
      expect(html).toContain('Pillars')
      expect(html).toContain('Comparison')
      expect(html).toContain('Clients')
      expect(html).toContain('FAQ')
      expect(html).toContain('Sign In')
      expect(html).toContain('Launch Vault')
    })

    it('renders LandingNavbar in authenticated state with Enter Vault CTA', () => {
      // Arrange
      const jsx = (
        <LandingNavbar
          token="auth_token_xyz"
          onLaunchApp={vi.fn()}
          onSignIn={vi.fn()}
        />
      )

      // Act
      const html = renderCleanHtml(jsx)

      // Assert
      expect(html).toContain('Enter Vault')
    })

    it('renders LandingNavbar for returning guest user with Resume Vault CTA', () => {
      // Arrange
      const jsx = (
        <LandingNavbar
          token={null}
          isReturningUser={true}
          onLaunchApp={vi.fn()}
          onSignIn={vi.fn()}
        />
      )

      // Act
      const html = renderCleanHtml(jsx)

      // Assert
      expect(html).toContain('Resume Vault')
    })

    it('renders LandingFooter with GitHub, Sync Protocol and Release Notes links', () => {
      // Arrange
      const onLaunchApp = vi.fn()
      const onOpenReleaseNotes = vi.fn()
      const onSignIn = vi.fn()
      const jsx = (
        <LandingFooter
          onLaunchApp={onLaunchApp}
          onOpenReleaseNotes={onOpenReleaseNotes}
          onSignIn={onSignIn}
          version="v2.5.9"
        />
      )

      // Act
      const html = renderCleanHtml(jsx)

      // Assert
      expect(html).toContain('Ready to organize your web?')
      expect(html).toContain('Launch Vault Now')
      expect(html).toContain('Star on GitHub')
      expect(html).toContain('MIT Licensed Open Source')
      expect(html).toContain('Sync Protocol')
      expect(html).toContain('v2.5.9 Notes')
    })
  })
})
