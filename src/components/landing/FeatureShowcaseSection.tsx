import React from 'react'
import { motion } from 'framer-motion'
import { CURRENT_RELEASE_VERSION } from './landingConstants'
import {
  Zap,
  RefreshCw,
  Shield,
  Layers,
  Search,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Share2
} from 'lucide-react'

export function FeatureShowcaseSection() {
  return (
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
            Markbel is designed from first principles with local storage, resilient edge synchronization, and zero telemetry.
          </p>
        </div>

        {/* Asymmetric Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Spotlight Command Launcher (2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4 }}
            className="md:col-span-2 p-6 sm:p-8 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center border border-[var(--color-accent)]/20">
                  <Search className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 uppercase tracking-wider">
                  New in {CURRENT_RELEASE_VERSION}
                </span>
              </div>
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                In-Page Spotlight Launcher: Command Your Vault From Any Tab
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed max-w-xl">
                Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] text-[var(--color-accent)] font-mono text-[11px] font-bold border border-[var(--color-border-default)]">Alt+O</kbd> (or <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] text-[var(--color-accent)] font-mono text-[11px] font-bold border border-[var(--color-border-default)]">Option+O</kbd> on Mac) on any website to summon an instant, centered command palette. Search thousands of bookmarks in 0ms with keyboard navigation without leaving your active tab.
              </p>
            </div>

            {/* Visual Mock UI: Floating Command Bar Container */}
            <div className="mt-6 p-4 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-2xl space-y-3">
              {/* Search input preview */}
              <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[var(--color-bg-element)] border border-[var(--color-border-default)] text-xs">
                <Search className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                <span className="text-[var(--color-text-primary)] font-medium flex-1">react architecture guide</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] text-[var(--color-accent)] font-mono text-[10px] font-bold border border-[var(--color-border-default)] shadow-xs">
                  Alt+O
                </kbd>
              </div>

              {/* Sample Mock Results */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 shrink-0">
                      Dev
                    </span>
                    <span className="font-semibold text-[var(--color-text-primary)] truncate">
                      React 19 & Next.js App Router Architecture Guide
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)] shrink-0 ml-2">github.com</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--color-bg-element)] text-xs transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                      Articles
                    </span>
                    <span className="text-[var(--color-text-muted)] truncate">
                      Building High-Throughput Edge APIs with Cloudflare D1
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)] shrink-0 ml-2">blog.cloudflare.com</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--color-bg-element)] text-xs transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0">
                      Design
                    </span>
                    <span className="text-[var(--color-text-muted)] truncate">
                      OKLCH Color Palettes & Tailwind CSS v4 Spatial Tokens
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)] shrink-0 ml-2">designsystems.io</span>
                </div>
              </div>

              {/* Bottom Keyboard Hint Row */}
              <div className="pt-2 border-t border-[var(--color-border-default)] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[var(--color-text-muted)]">
                <div className="flex items-center gap-3">
                  <span><kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-element)] border border-[var(--color-border-default)]">↑↓</kbd> Navigate</span>
                  <span><kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-element)] border border-[var(--color-border-default)]">↵</kbd> Open</span>
                  <span><kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-element)] border border-[var(--color-border-default)]">Ctrl+↵</kbd> New Tab</span>
                </div>
                <span><kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-element)] border border-[var(--color-border-default)]">Esc</kbd> Dismiss</span>
              </div>
            </div>
          </motion.div>

          {/* Pillar 4: MCP Studio & AI Agent Hub (1 col) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="p-6 sm:p-8 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 mb-5">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                Pillar 4: Native MCP Studio
              </h3>
              <p className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
                Connect your personal bookmark vault to Claude Desktop, Cursor IDE, Zed, and Antigravity with our official @markbel/mcp Model Context Protocol server.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              <div className="p-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] font-mono text-[11px] text-[var(--color-text-muted)] space-y-1">
                <div className="text-[var(--color-text-primary)] font-semibold flex items-center justify-between">
                  <span>@markbel/mcp Server</span>
                  <span className="text-emerald-500 text-[10px]">Active</span>
                </div>
                <div className="text-[var(--color-accent)] truncate">npx -y @markbel/mcp</div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-[var(--color-text-muted)]">
                <span className="px-2 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">Claude</span>
                <span className="px-2 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">Cursor</span>
                <span className="px-2 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">Zed</span>
                <span className="px-2 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">Antigravity</span>
              </div>
            </div>
          </motion.div>

          {/* Pillar 1: Offline-First IndexedDB (2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="md:col-span-2 p-6 sm:p-8 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center border border-[var(--color-accent)]/20 mb-5">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                Pillar 1: Offline-First IndexedDB (0ms Disk Latency)
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed max-w-xl">
                Never wait on loading spinners. Every bookmark, tag, and search query executes against your local IndexedDB disk instantly. You never have to sign up to organize links.
              </p>
            </div>

            {/* Visual Pipeline Graphic */}
            <div className="mt-6 p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Instant Disk Write (0ms)</span>
              </div>
              <ArrowRight className="hidden sm:block w-4 h-4 text-[var(--color-text-muted)]" />
              <div className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Optimistic Feed Update</span>
              </div>
              <ArrowRight className="hidden sm:block w-4 h-4 text-[var(--color-text-muted)]" />
              <div className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                <RefreshCw className="w-4 h-4 text-[var(--color-accent)]" />
                <span>Local-First Dexie Store</span>
              </div>
            </div>
          </motion.div>

          {/* Pillar 3: Zero Telemetry & Privacy Shield (1 col) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="p-6 sm:p-8 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 mb-5">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                Pillar 3: Zero Telemetry & Privacy
              </h3>
              <p className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
                Zero third-party trackers, zero analytics pixels, and zero telemetry beacons. Guest mode data stays strictly on your machine.
              </p>
            </div>

            <div className="mt-5 space-y-2 text-xs text-[var(--color-text-primary)] font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>No Google Analytics or Mixpanel</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Local-Only Guest Partition</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Edge Image SSRF Shielding</span>
              </div>
            </div>
          </motion.div>

          {/* Pillar 2: Cloudflare Edge Delta Sync (3 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="md:col-span-3 p-6 sm:p-8 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20 mb-5">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                Pillar 2: Cloudflare Edge Delta Sync & LWW Conflict Resolution
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed max-w-2xl">
                Multi-device synchronization powered by an append-only delta change log in Cloudflare D1 distributed SQLite. Mutations queue in a persistent offline outbox and synchronize silently with deterministic Last-Write-Wins (LWW) conflict resolution.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-[var(--color-text-primary)]">
              <span className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                Append-Only Delta Log
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                Deterministic LWW Resolution
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                Offline Outbox Resilient Queue
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                Cloudflare D1 Distributed SQLite
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default FeatureShowcaseSection
