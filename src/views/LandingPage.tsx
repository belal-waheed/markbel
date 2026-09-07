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
  Github
} from 'lucide-react'
import MarkbelLogo from '../components/MarkbelLogo.js'
import { useAuth } from '../lib/auth.js'

interface LandingPageProps {
  onLaunchApp?: () => void
  forceShow?: boolean
}

type PlatformType = 'android' | 'chrome' | 'ios' | 'desktop'

interface PlatformInfo {
  type: PlatformType
  name: string
  label: string
}

function detectPlatform(): PlatformInfo {
  if (typeof window === 'undefined' || !navigator?.userAgent) {
    return { type: 'desktop', name: 'Web PWA', label: 'Web Platform' }
  }

  const ua = navigator.userAgent

  if (/Android/i.test(ua)) {
    return { type: 'android', name: 'Android APK', label: 'Android Device' }
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return { type: 'ios', name: 'Web PWA (iOS)', label: 'iOS Device' }
  }
  if (/Chrome|CriOS/i.test(ua) && !/Edg|OPR/i.test(ua)) {
    return { type: 'chrome', name: 'Chrome Extension', label: 'Chromium Browser' }
  }
  return { type: 'desktop', name: 'Web PWA', label: 'Desktop Browser' }
}

const FAQ_ITEMS = [
  {
    question: 'What is Markbel?',
    answer:
      'Markbel is an open-source, offline-first personal bookmark vault and rich media archiver. It combines the zero-latency speed of local IndexedDB storage with seamless Cloudflare D1 SQLite multi-device sync, allowing you to capture, organize, and search links anywhere.'
  },
  {
    question: 'Is Markbel free and open-source?',
    answer:
      'Yes, 100% free and open source under the MIT License. The entire stack—including the React frontend, Cloudflare Workers API, D1 migrations, and Android Capacitor wrapper—is publicly available on GitHub.'
  },
  {
    question: 'Do I need to create an account to use it?',
    answer:
      'No account is required. Markbel operates out of the box in Guest Mode using Dexie.js IndexedDB in your browser. When you decide you want multi-device synchronization, you can create an account, and your local bookmarks migrate to your cloud vault automatically.'
  },
  {
    question: 'How does sync work across multiple devices?',
    answer:
      'Markbel utilizes an append-only delta change log stored in Cloudflare D1 SQLite. When a device mutates a bookmark or tag, the change is recorded locally and queued in an outbox. Once connected, mutations synchronize using deterministic Last-Write-Wins (LWW) conflict resolution.'
  },
  {
    question: 'Is my data private and tracked?',
    answer:
      'Markbel does not include third-party trackers, analytics pixels, or telemetry beacons. In Guest Mode, all data lives strictly on your local disk. In cloud sync mode, your links reside securely in your isolated D1 database partition.'
  },
  {
    question: 'What platforms and clients are supported?',
    answer:
      'Markbel provides three primary clients: a standalone Android APK (with native Android SEND share sheet integration), a Chromium browser extension (Manifest V3), and an installable Progressive Web App (PWA) supporting desktop and mobile browsers.'
  }
]

export default function LandingPage({ onLaunchApp, forceShow }: LandingPageProps) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const detectedPlatform = useMemo(() => detectPlatform(), [])
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

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

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] text-[var(--color-text-primary)] font-sans antialiased selection:bg-[var(--color-accent)] selection:text-white">
      {/* Top Banner / Announcement */}
      <div className="bg-[var(--color-bg-element)] border-b border-[var(--color-border-default)] px-4 py-2 text-center text-xs text-[var(--color-text-muted)] font-medium">
        <span>Markbel v2.1.0 is live with Cloudflare D1 Edge Delta Sync and Android Share Target.</span>
        <a
          href="https://github.com/belal-waheed/markbel/releases/latest"
          target="_blank"
          rel="noreferrer"
          className="ml-2 inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
        >
          View Release <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[var(--color-bg-main)]/90 backdrop-blur-md border-b border-[var(--color-border-default)] transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <MarkbelLogo size={36} className="shadow-xs border border-[var(--color-border-default)]" />
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight tracking-tight text-[var(--color-text-primary)]">
                Markbel
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-text-muted)]">
                Bookmarks Vault
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--color-text-muted)]">
            <a href="#features" className="hover:text-[var(--color-text-primary)] transition-colors">
              Features
            </a>
            <a href="#platforms" className="hover:text-[var(--color-text-primary)] transition-colors">
              Platforms
            </a>
            <a href="#faq" className="hover:text-[var(--color-text-primary)] transition-colors">
              FAQ
            </a>
            <a
              href="https://github.com/belal-waheed/markbel"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {token ? (
              <button
                onClick={handleLaunch}
                className="btn-primary px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs"
              >
                <span>Enter Vault</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login?redirect=/app')}
                  className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-2.5 py-1.5 rounded transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={handleLaunch}
                  className="btn-primary px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs"
                >
                  <span>Launch Vault</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-[var(--color-border-default)] bg-gradient-to-b from-[var(--color-bg-surface)] to-[var(--color-bg-main)]">
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
            Markbel is a high-speed, privacy-conscious bookmark manager. Store links directly in a local IndexedDB vault, synchronize mutations across devices via Cloudflare D1 SQLite, and extract media metadata with zero tracking.
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

          {/* Quick Value Metrics */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 text-left"
          >
            <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs">
              <div className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">0ms</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1 font-medium">Local-first Dexie vault</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs">
              <div className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">100%</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1 font-medium">Offline capable operations</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs">
              <div className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">D1</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1 font-medium">Cloudflare Edge SQLite sync</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs">
              <div className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">MIT</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1 font-medium">Open source & self-hostable</div>
            </div>
          </motion.div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Android APK Card */}
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
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-status-success)] shrink-0" />
                  <span>Native Android Share Sheet Target</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-status-success)] shrink-0" />
                  <span>Hardware Back Button Navigation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-status-success)] shrink-0" />
                  <span>Zero Google Play dependencies</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--color-border-default)]">
              <a
                href="https://github.com/belal-waheed/markbel/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="w-full btn-primary py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download APK (GitHub)</span>
              </a>
            </div>
          </div>

          {/* Chrome Extension Card */}
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
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Browser Extension</h3>
              <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">Chromium • Manifest V3</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
                Save the current tab into Markbel with one click. Supports custom tags, instant group assignment, and automatic metadata parsing.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-[var(--color-text-primary)] font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-status-success)] shrink-0" />
                  <span>One-click Toolbar Bookmark Action</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-status-success)] shrink-0" />
                  <span>Direct Cloudflare D1 Cloud Sync</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-status-success)] shrink-0" />
                  <span>Compatible with Chrome, Brave, and Edge</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--color-border-default)]">
              <a
                href="https://github.com/belal-waheed/markbel/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="w-full btn-secondary py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Get Extension (.zip)</span>
              </a>
            </div>
          </div>

          {/* Web PWA Card */}
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
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Web PWA</h3>
              <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">PWA • Zero Installation</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
                Full-featured progressive web application accessible from any modern browser. Supports home screen installation on iOS and desktop.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-[var(--color-text-primary)] font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-status-success)] shrink-0" />
                  <span>Offline Dexie.js IndexedDB Vault</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-status-success)] shrink-0" />
                  <span>Web Share Target API Handler</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-status-success)] shrink-0" />
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

      {/* Feature Highlights Grid */}
      <section id="features" className="py-20 border-t border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--color-bg-element)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-accent)] mb-3">
              <Zap className="w-3.5 h-3.5" />
              <span>Architectural Pillars</span>
            </div>
            <h2 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Engineered for Speed and Privacy
            </h2>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              Markbel is built from first principles with a local-first reactive model.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-[var(--color-accent)] flex items-center justify-center shrink-0 border border-blue-100">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Instant Local Vault (Guest Mode)
                </h3>
                <p className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Operates immediately with Dexie.js IndexedDB. Bookmarks, groups, and search filters work instantly with zero network roundtrips. You never have to sign up to organize links.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Resilient Multi-Device Delta Sync
                </h3>
                <p className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Edge Cloudflare D1 SQLite database tracks granular mutation deltas in an append-only change log. Synchronization uses deterministic Last-Write-Wins (LWW) conflict resolution with automatic offline replay.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Multi-Platform Rich Media Scraper
                </h3>
                <p className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Edge-optimized metadata extraction retrieves OpenGraph cards, high-definition thumbnails, YouTube video & Shorts metadata, TikTok details, and Twitter/X summaries in the background.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
                <Share2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Native Android & Web Share Targets
                </h3>
                <p className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Share links directly from any browser, YouTube, or Reddit app straight into Markbel via standard Android SEND intents or the PWA Web Share Target specification without opening the main UI.
                </p>
              </div>
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

          <div className="flex items-center gap-6">
            <a href="https://github.com/belal-waheed/markbel" target="_blank" rel="noreferrer" className="hover:underline">
              GitHub Repository
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
            <button onClick={() => navigate('/login?redirect=/app')} className="hover:underline cursor-pointer">
              Sign In
            </button>
          </div>

          <div>
            <span>Part of the Obel Suite</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
