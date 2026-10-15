import React from 'react'
import {
  X,
  Sparkles,
  ShieldCheck,
  Database,
  Image as ImageIcon,
  Globe,
  Wifi,
  Download,
  ExternalLink,
  CheckCircle2
} from 'lucide-react'

interface ReleaseNotesModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({ isOpen, onClose }) => {
  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col my-auto max-h-[88vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[var(--color-border-default)] flex items-center justify-between bg-gradient-to-r from-[var(--color-bg-surface)] to-[var(--color-bg-elevated)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)] shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)]">
                  What's New in Markbel v2.5.7
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-accent)] text-white shrink-0">
                  Latest
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Dexie v5 Schema Convergence, Deterministic Image FSM, Edge Proxy Negative Caching &amp; Network Diagnostics
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-element)] transition-colors cursor-pointer touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Release Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          {/* Feature 1: Dexie v5 Convergence & Transaction Hygiene */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Dexie v5 Schema Convergence &amp; Transaction Hygiene
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  IndexedDB &amp; Storage
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Unified explicit schema declaration across version 5 to converge all client databases regardless of migration history, registered automatic <code className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--color-bg-surface)]">versionchange</code> connection release, and enforced ambient transaction isolation on read bootstrap queries.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Explicit v5 Schema</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Auto versionchange Close</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Isolated Read Queries</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 2: Deterministic 4-Stage Image Fallback FSM */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Deterministic 4-Stage Image Fallback FSM
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Media &amp; UI Resilience
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Deterministic finite state machine (DIRECT &rarr; PROXY &rarr; FAVICON &rarr; PLACEHOLDER) with instant pre-check for expired Instagram/Facebook CDN links (<code className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--color-bg-surface)]">oe</code> hex timestamp), <code className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--color-bg-surface)]">no-referrer</code> hotlink bypass, and offline short-circuiting.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>4-Stage Fallback FSM</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Expired CDN Pre-Check</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Zero Offline Socket Storms</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 3: Hardened Edge Image Proxy */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Hardened Edge Image Proxy
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Cloudflare Workers
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Fast-fails signed CDN URLs past expiration with HTTP 410 Gone, prevents edge cache poisoning by serving HTTP 404 with negative caching on upstream errors, applies platform referer headers, and enforces strict Content Security Policy sandboxing.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                  <span>410 Gone Fast-Fail</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                  <span>404 Negative Caching</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                  <span>Strict CSP Sandboxing</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 4: Manifest share_target Enctype Compliance */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Manifest share_target Enctype Compliance
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  PWA Standards
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Declared explicit <code className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--color-bg-surface)]">enctype: "application/x-www-form-urlencoded"</code> across both public and build-time web app manifests for full W3C Web Share Target compliance on Android.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>W3C Web Share Target</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Explicit Enctype</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Android PWA Intent Integration</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 5: Extension Network Diagnostics */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Extension Network Diagnostics
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Extension &amp; Connectivity
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                In-extension network timeout interception that diagnoses Telecom Egypt (WE/Vodafone) 188.114.x IP blocks and provides direct, actionable instructions to enable Chrome Secure DNS (Google Public DNS) to restore connectivity.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>Timeout Diagnostics</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>Telecom Egypt DNS Guidance</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>Proactive Health Banners</span>
                </span>
              </div>
            </div>
          </div>

          {/* Download Assets Box */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-accent)]/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                Direct Download Assets (v2.5.7)
              </span>
              <a
                href="https://github.com/belal-waheed/markbel/releases/tag/v2.5.7"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-1 touch-manipulation"
              >
                <span>View on GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <a
                href="https://github.com/belal-waheed/markbel/releases/download/v2.5.7/Markbel.apk"
                target="_blank"
                rel="noreferrer"
                className="btn-primary py-2.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs touch-manipulation cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Markbel.apk (Android)</span>
              </a>

              <a
                href="https://github.com/belal-waheed/markbel/releases/download/v2.5.7/markbel-firefox-extension.zip"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary py-2.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 border border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 touch-manipulation cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Firefox Extension (.zip)</span>
              </a>

              <a
                href="https://github.com/belal-waheed/markbel/releases/download/v2.5.7/markbel-extension.zip"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary py-2.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 touch-manipulation cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Chromium Extension (.zip)</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary w-full sm:w-auto py-2.5 sm:py-2 px-5 text-xs font-semibold rounded-lg cursor-pointer touch-manipulation text-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
