import React from 'react'
import { motion } from 'framer-motion'
import { Zap, Download } from 'lucide-react'
import type { PlatformInfo } from './landingConstants.js'

export interface HeroSectionProps {
  onLaunchApp: () => void
  detectedPlatform?: PlatformInfo
}

export function HeroSection({ onLaunchApp, detectedPlatform }: HeroSectionProps) {
  return (
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
            type="button"
            onClick={onLaunchApp}
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
            <span>
              {detectedPlatform && detectedPlatform.type !== 'desktop'
                ? `Get Markbel for ${detectedPlatform.name}`
                : 'Download Client Apps'}
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  )
}

export default HeroSection
