import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  RefreshCw,
  Sparkles,
  Share2,
  Smartphone,
  Layers,
  Globe,
  Download,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Shield,
  CheckCircle2,
  Github,
  Search,
  LayoutGrid,
  List as ListIcon,
  Tag,
  Pin,
  ExternalLink as LinkIcon,
  Clock,
  Star,
  Play,
  Menu,
  Puzzle,
  X as CloseIcon
} from 'lucide-react'
import MarkbelLogo from '../components/MarkbelLogo.js'
import { useAuth } from '../lib/auth.js'
import { ExtensionSetupModal } from '../components/modals/ExtensionSetupModal'
import { ReleaseNotesModal } from '../components/modals/ReleaseNotesModal'

interface LandingPageProps {
  onLaunchApp?: () => void
  forceShow?: boolean
}

export type PlatformType = 'android' | 'chrome' | 'firefox' | 'ios' | 'desktop'

export interface PlatformInfo {
  type: PlatformType
  name: string
  label: string
}

export function detectPlatform(customUA?: string): PlatformInfo {
  const ua = customUA || (typeof window !== 'undefined' && navigator?.userAgent ? navigator.userAgent : '')
  if (!ua) {
    return { type: 'desktop', name: 'Web PWA', label: 'Web Platform' }
  }

  if (/Android/i.test(ua)) {
    return { type: 'android', name: 'Android APK', label: 'Android Device' }
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return { type: 'ios', name: 'Web PWA (iOS)', label: 'iOS Device' }
  }
  if (/Firefox|FxiOS/i.test(ua)) {
    return { type: 'firefox', name: 'Firefox Add-on', label: 'Mozilla Firefox' }
  }
  if (/Edg\//i.test(ua)) {
    return { type: 'chrome', name: 'Edge Add-on', label: 'Microsoft Edge' }
  }
  if (/Chrome|CriOS/i.test(ua) && !/OPR/i.test(ua)) {
    return { type: 'chrome', name: 'Browser Extension', label: 'Chromium Browser' }
  }
  return { type: 'desktop', name: 'Web PWA', label: 'Desktop Browser' }
}

interface DemoBookmark {
  id: string
  title: string
  url: string
  domain: string
  group: 'Dev' | 'Articles' | 'Video' | 'Design'
  groupColor: string
  tags: string[]
  description: string
  isPinned: boolean
  metric?: string
  metricIcon?: 'star' | 'clock' | 'play'
}

const INITIAL_DEMO_BOOKMARKS: DemoBookmark[] = [
  {
    id: '1',
    title: 'React 19 & Next.js App Router Architecture Guide',
    url: 'https://github.com/facebook/react',
    domain: 'github.com',
    group: 'Dev',
    groupColor: 'blue',
    tags: ['react', 'nextjs', 'typescript'],
    description: 'Deep dive into React 19 Server Components, Actions, and async asset loading patterns.',
    isPinned: true,
    metric: '228k stars',
    metricIcon: 'star'
  },
  {
    id: '2',
    title: 'Building High-Throughput Edge APIs with Cloudflare D1',
    url: 'https://blog.cloudflare.com/d1-database',
    domain: 'blog.cloudflare.com',
    group: 'Articles',
    groupColor: 'amber',
    tags: ['edge', 'sqlite', 'serverless'],
    description: 'Architecting distributed SQLite databases at the edge with zero-latency read replication.',
    isPinned: false,
    metric: '6 min read',
    metricIcon: 'clock'
  },
  {
    id: '3',
    title: 'Framer Motion & GSAP 60fps Micro-Interactions Masterclass',
    url: 'https://youtube.com/watch?v=motion-mastery',
    domain: 'youtube.com',
    group: 'Video',
    groupColor: 'red',
    tags: ['animation', 'framer-motion', 'ui'],
    description: 'Production standards for building fluid, physics-driven web gestures and layout transitions.',
    isPinned: true,
    metric: '18:42 duration',
    metricIcon: 'play'
  },
  {
    id: '4',
    title: 'OKLCH Color Palettes & Tailwind CSS v4 Spatial Tokens',
    url: 'https://designsystems.io/oklch-tokens',
    domain: 'designsystems.io',
    group: 'Design',
    groupColor: 'purple',
    tags: ['design-system', 'tailwind', 'css'],
    description: 'Perceptually uniform color spaces and modern CSS custom property themes for web applications.',
    isPinned: false,
    metric: 'Reference',
    metricIcon: 'clock'
  }
]

const FAQ_ITEMS = [
  {
    question: 'What is Markbel?',
    answer:
      'Markbel is an open-source, offline-first personal bookmark vault and rich media archiver. It combines the zero-latency speed of local IndexedDB storage with seamless Cloudflare D1 SQLite multi-device sync, allowing you to capture, organize, and search links anywhere with zero loading latency.'
  },
  {
    question: 'Is Markbel free and open-source?',
    answer:
      'Yes, 100% free and open source under the MIT License. The entire stack—including the React frontend, Cloudflare Workers edge API, D1 schema, and Android Capacitor wrapper—is publicly available on GitHub.'
  },
  {
    question: 'Do I need to create an account to use it?',
    answer:
      'No account is required. Markbel operates out of the box in Guest Mode using local IndexedDB in your browser. When you decide you want multi-device synchronization, you can create an account, and your local bookmarks automatically migrate to your cloud vault.'
  },
  {
    question: 'How does sync work across multiple devices?',
    answer:
      'Markbel utilizes an append-only delta change log stored in Cloudflare D1 SQLite. When a device mutates a bookmark or tag, the change is recorded locally and queued in an outbox. Once connected, mutations synchronize using deterministic Last-Write-Wins (LWW) conflict resolution.'
  },
  {
    question: 'Is my data private and tracked?',
    answer:
      'Markbel does not include third-party trackers, analytics pixels, or telemetry beacons. In Guest Mode, all data lives strictly on your local disk. In cloud sync mode, your links reside securely in your isolated database partition.'
  },
  {
    question: 'What platforms and clients are supported?',
    answer:
      'Markbel provides three primary clients: a standalone Android APK (with native Android SEND share sheet integration), a Chromium browser extension (Manifest V3), and an installable Progressive Web App (PWA) supporting desktop and mobile browsers.'
  }
]

export default function LandingPage({ onLaunchApp }: LandingPageProps) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const detectedPlatform = useMemo(() => detectPlatform(), [])
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false)
  const [extensionModalTab, setExtensionModalTab] = useState<'chrome' | 'edge' | 'firefox'>('firefox')
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Interactive Product Canvas State
  const [demoViewMode, setDemoViewMode] = useState<'grid' | 'list'>('grid')
  const [demoFilterGroup, setDemoFilterGroup] = useState<string>('All')
  const [demoSearchQuery, setDemoSearchQuery] = useState('')
  const [demoBookmarks, setDemoBookmarks] = useState<DemoBookmark[]>(INITIAL_DEMO_BOOKMARKS)

  const handleLaunch = () => {
    if (onLaunchApp) {
      onLaunchApp()
    } else {
      localStorage.setItem('markbel_guest_initialized', 'true')
      navigate('/app')
    }
  }

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index))
  }

  const togglePinBookmark = (id: string) => {
    setDemoBookmarks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isPinned: !b.isPinned } : b))
    )
  }

  const filteredDemoBookmarks = useMemo(() => {
    return demoBookmarks.filter((b) => {
      const matchesGroup = demoFilterGroup === 'All' || b.group === demoFilterGroup
      const matchesSearch =
        demoSearchQuery.trim() === '' ||
        b.title.toLowerCase().includes(demoSearchQuery.toLowerCase()) ||
        b.description.toLowerCase().includes(demoSearchQuery.toLowerCase()) ||
        b.tags.some((t) => t.toLowerCase().includes(demoSearchQuery.toLowerCase()))
      return matchesGroup && matchesSearch
    })
  }, [demoBookmarks, demoFilterGroup, demoSearchQuery])

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] text-[var(--color-text-primary)] font-sans antialiased selection:bg-[var(--color-accent)]/20 selection:text-inherit">
      {/* Top Banner / Announcement */}
      <div className="bg-[var(--color-bg-element)] border-b border-[var(--color-border-default)] px-4 py-2 sm:py-2.5 text-center text-xs text-[var(--color-text-muted)] font-medium select-none">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 leading-snug">
            <span className="font-semibold text-[var(--color-text-primary)]">Markbel v2.5.2 is live</span>
            <span className="hidden sm:inline text-[var(--color-border-default)]">•</span>
            <span>Cascade Sync, Batch Transactions, Reminder Controls & Firefox MV3.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsReleaseModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1 sm:py-0.5 rounded-full text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 active:scale-95 transition-all border border-[var(--color-accent)]/25 cursor-pointer touch-manipulation min-h-[32px] sm:min-h-0 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
            <span>What's New in v2.5.2</span>
          </button>
        </div>
      </div>

      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[var(--color-bg-main)]/90 backdrop-blur-md border-b border-[var(--color-border-default)] transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <MarkbelLogo size={34} className="shadow-xs" />
            <div className="flex flex-col">
              <span className="font-bold text-base leading-tight tracking-tight text-[var(--color-text-primary)]">
                Markbel
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-text-muted)]">
                Bookmarks Vault
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-[var(--color-text-muted)]">
            <a href="#demo" className="hover:text-[var(--color-text-primary)] transition-colors">
              Live Preview
            </a>
            <a href="#features" className="hover:text-[var(--color-text-primary)] transition-colors">
              Pillars
            </a>
            <a href="#platforms" className="hover:text-[var(--color-text-primary)] transition-colors">
              Clients
            </a>
            <a href="#faq" className="hover:text-[var(--color-text-primary)] transition-colors">
              FAQ
            </a>
            <a
              href="https://github.com/belal-waheed/markbel"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-[var(--color-text-primary)] transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {token ? (
              <button
                onClick={handleLaunch}
                className="btn-primary px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <span>Enter Vault</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login?redirect=/app')}
                  className="hidden sm:inline-flex text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={handleLaunch}
                  className="btn-primary px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>Launch Vault</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-element)] transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <CloseIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-4 space-y-3 overflow-hidden shadow-lg"
            >
              <nav className="flex flex-col space-y-2 text-sm font-semibold">
                <a
                  href="#demo"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-colors"
                >
                  Live Preview
                </a>
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-colors"
                >
                  Architectural Pillars
                </a>
                <a
                  href="#platforms"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-colors"
                >
                  Platforms & Clients
                </a>
                <a
                  href="#faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-colors"
                >
                  FAQ
                </a>
                <a
                  href="https://github.com/belal-waheed/markbel"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] flex items-center gap-2"
                >
                  <Github className="w-4 h-4" />
                  <span>GitHub Repository</span>
                </a>
              </nav>

              <div className="pt-2 border-t border-[var(--color-border-default)] flex gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/login?redirect=/app')
                  }}
                  className="flex-1 btn-secondary py-2.5 text-xs font-semibold rounded-lg text-center"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleLaunch()
                  }}
                  className="flex-1 btn-primary py-2.5 text-xs font-semibold rounded-lg text-center"
                >
                  Launch Vault
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-[var(--color-border-default)] bg-gradient-to-b from-[var(--color-bg-surface)] to-[var(--color-bg-main)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              Offline-First Personal Vault & Media Archiver
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--color-text-primary)] leading-[1.1]"
          >
            All your links.
            <br />
            <span className="text-[var(--color-accent)]">Zero latency. Everywhere.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="mt-6 text-base sm:text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed"
          >
            Markbel is a private, lightning-fast bookmark manager that saves directly to local disk. Bookmarks persist immediately in IndexedDB and synchronize silently across your devices using Cloudflare edge SQLite.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5"
          >
            <button
              onClick={handleLaunch}
              className="w-full sm:w-auto btn-primary px-6 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Launch Vault (No Account Needed)</span>
            </button>

            <a
              href="#platforms"
              className="w-full sm:w-auto btn-secondary px-6 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2.5 shadow-xs transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Client Apps</span>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Interactive Hero Product Canvas */}
      <section id="demo" className="py-14 sm:py-20 max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-xl overflow-hidden"
        >
          {/* Mock Vault Window Top Bar */}
          <div className="px-4 py-3 bg-[var(--color-bg-element)] border-b border-[var(--color-border-default)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <span className="text-xs font-mono font-semibold text-[var(--color-text-muted)] ml-2">
                Markbel Interactive Vault Demo
              </span>
            </div>

            {/* Layout Toggle Controls */}
            <div className="flex items-center gap-1 bg-[var(--color-bg-surface)] p-1 rounded-lg border border-[var(--color-border-default)]">
              <button
                type="button"
                onClick={() => setDemoViewMode('grid')}
                className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                  demoViewMode === 'grid'
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoViewMode('list')}
                className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                  demoViewMode === 'list'
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
                title="List View"
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>

          {/* Interactive Toolbar: Search & Category Chips */}
          <div className="p-4 sm:p-5 border-b border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={demoSearchQuery}
                onChange={(e) => setDemoSearchQuery(e.target.value)}
                placeholder="Live search bookmarks, tags, domains..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {['All', 'Dev', 'Articles', 'Video', 'Design'].map((grp) => (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setDemoFilterGroup(grp)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    demoFilterGroup === grp
                      ? 'bg-[var(--color-accent)] text-white shadow-xs'
                      : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)]'
                  }`}
                >
                  {grp}
                </button>
              ))}
            </div>
          </div>

          {/* Bookmarks Canvas */}
          <div className="p-4 sm:p-6 bg-[var(--color-bg-main)] min-h-[320px]">
            {filteredDemoBookmarks.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
                No matching bookmarks found in preview filter.
              </div>
            ) : demoViewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredDemoBookmarks.map((bookmark) => (
                  <motion.div
                    key={bookmark.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs hover:border-[var(--color-accent)]/50 transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] border border-[var(--color-border-default)] shrink-0">
                            {bookmark.domain}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 shrink-0">
                            {bookmark.group}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => togglePinBookmark(bookmark.id)}
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            bookmark.isPinned
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                          }`}
                          title={bookmark.isPinned ? 'Pinned to top' : 'Pin bookmark'}
                        >
                          <Pin className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </div>

                      <h4 className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors leading-snug">
                        {bookmark.title}
                      </h4>
                      <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                        {bookmark.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[var(--color-border-default)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {bookmark.tags.map((t) => (
                          <span key={t} className="text-[10px] text-[var(--color-text-muted)] font-mono">
                            #{t}
                          </span>
                        ))}
                      </div>

                      {bookmark.metric && (
                        <div className="flex items-center gap-1 font-medium text-[var(--color-text-primary)]">
                          {bookmark.metricIcon === 'star' && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                          {bookmark.metricIcon === 'clock' && <Clock className="w-3 h-3 text-[var(--color-text-muted)]" />}
                          {bookmark.metricIcon === 'play' && <Play className="w-3 h-3 text-red-500 fill-red-500" />}
                          <span>{bookmark.metric}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDemoBookmarks.map((bookmark) => (
                  <motion.div
                    key={bookmark.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex items-center justify-between gap-3 hover:border-[var(--color-accent)]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => togglePinBookmark(bookmark.id)}
                        className={`p-1 rounded cursor-pointer shrink-0 ${
                          bookmark.isPinned ? 'text-amber-500' : 'text-[var(--color-text-muted)]'
                        }`}
                      >
                        <Pin className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                            {bookmark.title}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] shrink-0">
                            {bookmark.group}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">
                          {bookmark.domain}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] shrink-0 font-medium">
                      {bookmark.metric && <span>{bookmark.metric}</span>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* Asymmetric Bento Grid Section: Architectural Pillars */}
      <section id="features" className="py-20 border-t border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--color-bg-element)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-accent)] mb-3">
              <Zap className="w-3.5 h-3.5" />
              <span>Architectural Pillars</span>
            </div>
            <h2 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Engineered for Speed, Privacy & Stability
            </h2>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              Markbel is designed from first principles with local storage and resilient edge synchronization.
            </p>
          </div>

          {/* Asymmetric Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tile 1: Large Local-First Speed Engine (2 cols) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4 }}
              className="md:col-span-2 p-6 sm:p-8 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center border border-[var(--color-accent)]/20 mb-5">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                  Local-First Speed Engine: 0ms Disk Latency
                </h3>
                <p className="mt-2.5 text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed max-w-xl">
                  Never wait on loading spinners. Every bookmark, tag, and search query executes against your local IndexedDB disk instantly. You never have to sign up to organize links.
                </p>
              </div>

              {/* Visual Pipeline Graphic */}
              <div className="mt-6 p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Instant Disk Write (0ms)</span>
                </div>
                <ArrowRight className="hidden sm:block w-4 h-4 text-[var(--color-text-muted)]" />
                <div className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Optimistic Feed Update</span>
                </div>
                <ArrowRight className="hidden sm:block w-4 h-4 text-[var(--color-text-muted)]" />
                <div className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                  <RefreshCw className="w-4 h-4 text-[var(--color-accent)]" />
                  <span>Cloudflare D1 Delta Sync</span>
                </div>
              </div>
            </motion.div>

            {/* Tile 2: Smart Auto-Categorization (1 col) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="p-6 sm:p-8 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 mb-5">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  Compound Auto-Categorization
                </h3>
                <p className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Define multi-constraint rules combining domains, path prefixes, and query parameters. Incoming bookmarks route into targeted groups automatically.
                </p>
              </div>

              <div className="mt-5 p-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] font-mono text-[11px] text-[var(--color-text-muted)] space-y-1">
                <div className="text-[var(--color-text-primary)] font-semibold">Rule: YouTube Playlists</div>
                <div className="text-amber-600 dark:text-amber-400">query: list=* → Group "Video"</div>
              </div>
            </motion.div>

            {/* Tile 3: Universal Capture Suite (1 col) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="p-6 sm:p-8 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 mb-5">
                  <Share2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  Universal Capture Suite
                </h3>
                <p className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Capture links from anywhere: native Android system share sheets, 1-click Chrome/Edge toolbar popups, or the Web Share Target API.
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2 text-xs text-[var(--color-text-primary)] font-semibold">
                <span className="px-2.5 py-1 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                  Android APK
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                  Edge / Chrome
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                  PWA Web
                </span>
              </div>
            </motion.div>

            {/* Tile 4: High-Resolution Media Scraper (2 cols) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="md:col-span-2 p-6 sm:p-8 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20 mb-5">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                  High-Resolution Edge Media Extraction
                </h3>
                <p className="mt-2.5 text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed max-w-xl">
                  Edge-optimized metadata scrapers extract OpenGraph cards, high-definition thumbnails, YouTube metadata, and high-DPI favicons securely without advertising trackers or telemetry.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-[var(--color-text-primary)]">
                <span className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                  YouTube MaxRes Thumbnails
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                  OpenGraph Cards
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                  Edge Image SSRF Shielding
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Platform Download Matrix */}
      <section id="platforms" className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--color-bg-element)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-accent)] mb-3">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Cross-Platform Ecosystem</span>
          </div>
          <h2 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
            One Vault Across All Your Devices
          </h2>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            Capture URLs on mobile, search on desktop, and sync seamlessly in the background.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. Android App (APK) Card */}
          <div
            className={`p-6 rounded-2xl bg-[var(--color-bg-elevated)] border transition-all flex flex-col justify-between ${
              detectedPlatform.type === 'android'
                ? 'border-[var(--color-accent)] shadow-md ring-2 ring-[var(--color-accent)]/20'
                : 'border-[var(--color-border-default)] shadow-xs hover:border-[var(--color-bg-element)] hover:shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-element)] flex items-center justify-center text-[var(--color-text-primary)]">
                  <Smartphone className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                {detectedPlatform.type === 'android' && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--color-accent)] text-white">
                    Detected on Device
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Android App</h3>
              <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">Standalone APK • Capacitor 8</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
                Native Android wrapper featuring direct system SEND share sheet integration, background sync, and offline persistence.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-[var(--color-text-primary)] font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Native Android Share Sheet Target</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Hardware Back Button Navigation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Zero Google Play dependencies</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--color-border-default)]">
              <a
                href="https://github.com/belal-waheed/markbel/releases/latest/download/Markbel.apk"
                target="_blank"
                rel="noreferrer"
                className="w-full btn-primary py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download APK (Markbel.apk)</span>
              </a>
            </div>
          </div>

          {/* 2. Firefox & Firefox Dev Edition Card */}
          <div
            className={`p-6 rounded-2xl bg-[var(--color-bg-elevated)] border transition-all flex flex-col justify-between ${
              detectedPlatform.type === 'firefox'
                ? 'border-[var(--color-accent)] shadow-md ring-2 ring-[var(--color-accent)]/20'
                : 'border-[var(--color-border-default)] shadow-xs hover:border-[var(--color-bg-element)] hover:shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-element)] flex items-center justify-center text-[var(--color-text-primary)]">
                  <Puzzle className="w-6 h-6 text-amber-500" />
                </div>
                {detectedPlatform.type === 'firefox' ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--color-accent)] text-white">
                    Recommended for Your Browser
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
                    Gecko MV3
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Firefox & Dev Edition</h3>
              <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">Gecko • Manifest V3</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
                Dedicated Mozilla Firefox and Firefox Developer Edition add-on with event page MV3 background execution and local debugging.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-[var(--color-text-primary)] font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Firefox MV3 Event Background</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>about:debugging 1-Click Load</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Developer Edition Persistent Ready</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--color-border-default)] flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setExtensionModalTab('firefox')
                  setIsExtensionModalOpen(true)
                }}
                className="w-full btn-primary py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Firefox Setup Guide</span>
              </button>

              <a
                href="https://github.com/belal-waheed/markbel/releases/latest/download/markbel-firefox-extension.zip"
                target="_blank"
                rel="noreferrer"
                className="w-full text-center text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors py-1 flex items-center justify-center gap-1.5 opacity-80 hover:opacity-100"
              >
                <Download className="w-3 h-3" />
                <span>Download markbel-firefox-extension.zip</span>
              </a>
            </div>
          </div>

          {/* 3. Microsoft Edge & Chromium Card */}
          <div
            className={`p-6 rounded-2xl bg-[var(--color-bg-elevated)] border transition-all flex flex-col justify-between ${
              detectedPlatform.type === 'chrome'
                ? 'border-[var(--color-accent)] shadow-md ring-2 ring-[var(--color-accent)]/20'
                : 'border-[var(--color-border-default)] shadow-xs hover:border-[var(--color-bg-element)] hover:shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-element)] flex items-center justify-center text-[var(--color-text-primary)]">
                  <Layers className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                {detectedPlatform.type === 'chrome' && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--color-accent)] text-white">
                    Recommended for Browser
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Edge & Chromium</h3>
              <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">Chromium • Manifest V3</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
                Save the current tab into Markbel with one click. Supports custom tags, instant group assignment, and automatic metadata parsing.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-[var(--color-text-primary)] font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>One-click Toolbar Bookmark Action</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Direct Cloudflare D1 Cloud Sync</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Compatible with Chrome, Brave, and Edge</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--color-border-default)] flex flex-col gap-2.5">
              <a
                href="https://microsoftedge.microsoft.com/addons/detail/markbel-%E2%80%94-quick-bookmarks/molmflphbifkekgnobnflblphdefpjfc"
                target="_blank"
                rel="noreferrer"
                className="w-full btn-primary py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Get on Edge Add-ons (1-Click)</span>
              </a>

              <button
                onClick={() => {
                  setExtensionModalTab('chrome')
                  setIsExtensionModalOpen(true)
                }}
                className="w-full btn-secondary py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 border border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Chrome & Brave Setup Guide</span>
              </button>

              <a
                href="https://github.com/belal-waheed/markbel/releases/latest/download/markbel-extension.zip"
                target="_blank"
                rel="noreferrer"
                className="w-full text-center text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors py-1 flex items-center justify-center gap-1.5 opacity-80 hover:opacity-100"
              >
                <Download className="w-3 h-3" />
                <span>Download markbel-extension.zip</span>
              </a>
            </div>
          </div>

          {/* 4. Web PWA & Guest Vault Card */}
          <div
            className={`p-6 rounded-2xl bg-[var(--color-bg-elevated)] border transition-all flex flex-col justify-between ${
              detectedPlatform.type === 'desktop' || detectedPlatform.type === 'ios'
                ? 'border-[var(--color-accent)] shadow-md ring-2 ring-[var(--color-accent)]/20'
                : 'border-[var(--color-border-default)] shadow-xs hover:border-[var(--color-bg-element)] hover:shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-element)] flex items-center justify-center text-[var(--color-text-primary)]">
                  <Globe className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                {(detectedPlatform.type === 'desktop' || detectedPlatform.type === 'ios') && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--color-accent)] text-white">
                    Instant in Browser
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Web PWA & Guest Vault</h3>
              <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">PWA • Zero Installation</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
                Full-featured progressive web application accessible from any modern browser. Supports home screen installation on iOS and desktop.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-[var(--color-text-primary)] font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Offline IndexedDB Vault</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Web Share Target API Handler</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Installable Desktop Application</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--color-border-default)]">
              <button
                onClick={handleLaunch}
                className="w-full btn-primary py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Launch Web Vault</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive FAQ Accordion */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--color-bg-element)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-accent)] mb-3">
            <Shield className="w-3.5 h-3.5" />
            <span>Questions & Answers</span>
          </div>
          <h2 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            Everything you need to know about Markbel storage, syncing, and privacy.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaqIndex === idx
            return (
              <div
                key={idx}
                className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] overflow-hidden shadow-xs transition-colors"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-semibold text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 text-[var(--color-accent)]' : ''
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 pt-1 text-xs text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border-default)]">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </section>

      {/* Pre-Footer Call to Action */}
      <section className="py-16 bg-[var(--color-bg-element)] border-t border-[var(--color-border-default)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
            Ready to organize your web?
          </h2>
          <p className="mt-3 text-sm text-[var(--color-text-muted)] max-w-xl mx-auto">
            Zero telemetry. Instant offline vault. No registration needed to start organizing your links right now.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleLaunch}
              className="w-full sm:w-auto btn-primary px-6 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Launch Vault Now</span>
            </button>
            <a
              href="https://github.com/belal-waheed/markbel"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto btn-secondary px-6 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs"
            >
              <Github className="w-3.5 h-3.5" />
              <span>Star on GitHub</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-[var(--color-border-default)] bg-[var(--color-bg-main)] text-xs text-[var(--color-text-muted)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <MarkbelLogo size={28} />
            <span className="font-semibold text-sm text-[var(--color-text-primary)]">Markbel</span>
            <span className="text-[var(--color-border-default)]">|</span>
            <span>MIT Licensed Open Source</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 sm:gap-6">
            <a href="https://github.com/belal-waheed/markbel" target="_blank" rel="noreferrer" className="hover:underline">
              GitHub
            </a>
            <a
              href="https://github.com/belal-waheed/markbel/blob/main/docs/architecture/sync-protocol.md"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              Sync Protocol
            </a>
            <a href="https://github.com/belal-waheed/markbel/releases" target="_blank" rel="noreferrer" className="hover:underline">
              Releases
            </a>
            <button
              onClick={() => setIsReleaseModalOpen(true)}
              className="hover:underline cursor-pointer text-[var(--color-accent)] font-semibold flex items-center gap-1"
            >
              <span>v2.5.2 Notes</span>
              <Sparkles className="w-3 h-3" />
            </button>
            <button onClick={() => navigate('/login?redirect=/app')} className="hover:underline cursor-pointer">
              Sign In
            </button>
          </div>
        </div>
      </footer>

      {/* Interactive End-User Modals */}
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
