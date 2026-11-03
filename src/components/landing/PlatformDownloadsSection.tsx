import React from 'react'
import {
  Smartphone,
  Globe,
  Download,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Puzzle,
  Zap
} from 'lucide-react'
import type { PlatformInfo } from './landingConstants.js'

export interface PlatformDownloadsSectionProps {
  detectedPlatform: PlatformInfo
  onOpenExtensionModal: (tab: 'chrome' | 'firefox') => void
  onLaunchApp: () => void
  onOpenGuestVault?: () => void
}

export function PlatformDownloadsSection({
  detectedPlatform,
  onOpenExtensionModal,
  onLaunchApp,
  onOpenGuestVault
}: PlatformDownloadsSectionProps) {
  const isExtensionDetected =
    detectedPlatform.type === 'chrome' || detectedPlatform.type === 'firefox'

  return (
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
        {/* 1. Browser Extension Card (Chromium & Firefox MV3) */}
        <div
          className={`p-6 rounded-2xl bg-[var(--color-bg-elevated)] border transition-all flex flex-col justify-between h-full ${
            isExtensionDetected
              ? 'border-[var(--color-accent)] shadow-md ring-2 ring-[var(--color-accent)]/20'
              : 'border-[var(--color-border-default)] shadow-xs hover:border-[var(--color-bg-element)] hover:shadow-sm'
          }`}
        >
          <div>
            {/* Dedicated Top Pill Row */}
            <div className="h-6 mb-3 flex items-center">
              {isExtensionDetected ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-accent)] text-white shadow-xs">
                  Recommended for Your Browser
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--color-bg-element)] text-[var(--color-text-muted)] border border-[var(--color-border-default)] font-semibold">
                  Chromium & Firefox MV3
                </span>
              )}
            </div>

            {/* Platform Icon */}
            <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-element)] flex items-center justify-center text-[var(--color-text-primary)] mb-4">
              <Puzzle className="w-6 h-6 text-[var(--color-accent)]" />
            </div>

            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Browser Extension</h3>
            <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">Chromium & Firefox • Manifest V3</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
              Save the current tab into Markbel with one click, keyboard shortcuts (Alt+O / Alt+B), and in-page link launcher HUD.
            </p>

            <ul className="mt-4 space-y-2 text-xs text-[var(--color-text-primary)] font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="flex items-center gap-1.5 flex-wrap">
                  <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">Alt+O</kbd>
                  <span>In-Page Spotlight Link Launcher</span>
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="flex items-center gap-1.5 flex-wrap">
                  <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">Alt+B</kbd>
                  <span>Dual-Mode Quick-Open HUD</span>
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>0ms Local Dexie Search & Cloud Sync</span>
              </li>
            </ul>
          </div>

          {/* Standardized Bottom Action Area */}
          <div className="mt-auto pt-4 border-t border-[var(--color-border-default)] flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpenExtensionModal('chrome')}
                className="w-full btn-primary h-10 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs hover:shadow transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Chrome & Brave</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenExtensionModal('firefox')}
                className="w-full btn-primary h-10 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs hover:shadow transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Firefox Setup Guide</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://github.com/belal-waheed/markbel/releases/latest/download/markbel-extension.zip"
                target="_blank"
                rel="noreferrer"
                className="w-full btn-secondary h-10 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-[var(--color-border-default)] hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-all shadow-xs"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Chromium ZIP</span>
              </a>
              <a
                href="https://github.com/belal-waheed/markbel/releases/latest/download/markbel-firefox-extension.zip"
                target="_blank"
                rel="noreferrer"
                className="w-full btn-secondary h-10 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-[var(--color-border-default)] hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-all shadow-xs"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Firefox ZIP</span>
              </a>
            </div>
          </div>
        </div>

        {/* 2. Android App (APK) Card */}
        <div
          className={`p-6 rounded-2xl bg-[var(--color-bg-elevated)] border transition-all flex flex-col justify-between h-full ${
            detectedPlatform.type === 'android'
              ? 'border-[var(--color-accent)] shadow-md ring-2 ring-[var(--color-accent)]/20'
              : 'border-[var(--color-border-default)] shadow-xs hover:border-[var(--color-bg-element)] hover:shadow-sm'
          }`}
        >
          <div>
            {/* Dedicated Top Pill Row */}
            <div className="h-6 mb-3 flex items-center">
              {detectedPlatform.type === 'android' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-accent)] text-white shadow-xs">
                  Detected on Device
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--color-bg-element)] text-[var(--color-text-muted)] border border-[var(--color-border-default)] font-semibold">
                  Standalone APK
                </span>
              )}
            </div>

            {/* Platform Icon */}
            <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-element)] flex items-center justify-center text-[var(--color-text-primary)] mb-4">
              <Smartphone className="w-6 h-6 text-[var(--color-accent)]" />
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

          {/* Standardized 2-Tier Bottom Action Area */}
          <div className="mt-auto pt-4 border-t border-[var(--color-border-default)] flex flex-col gap-2">
            <a
              href="https://github.com/belal-waheed/markbel/releases/latest/download/Markbel.apk"
              target="_blank"
              rel="noreferrer"
              className="w-full btn-primary h-10 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download APK (Markbel.apk)</span>
            </a>
            <a
              href="https://github.com/belal-waheed/markbel/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="w-full btn-secondary h-10 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 border border-[var(--color-border-default)] hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-all shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View GitHub Release</span>
            </a>
          </div>
        </div>

        {/* 3. Web PWA & Guest Vault Card */}
        <div
          className={`p-6 rounded-2xl bg-[var(--color-bg-elevated)] border transition-all flex flex-col justify-between h-full ${
            detectedPlatform.type === 'desktop' || detectedPlatform.type === 'ios'
              ? 'border-[var(--color-accent)] shadow-md ring-2 ring-[var(--color-accent)]/20'
              : 'border-[var(--color-border-default)] shadow-xs hover:border-[var(--color-bg-element)] hover:shadow-sm'
          }`}
        >
          <div>
            {/* Dedicated Top Pill Row */}
            <div className="h-6 mb-3 flex items-center">
              {detectedPlatform.type === 'desktop' || detectedPlatform.type === 'ios' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-accent)] text-white shadow-xs">
                  Instant in Browser
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--color-bg-element)] text-[var(--color-text-muted)] border border-[var(--color-border-default)] font-semibold">
                  Web PWA
                </span>
              )}
            </div>

            {/* Platform Icon */}
            <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-element)] flex items-center justify-center text-[var(--color-text-primary)] mb-4">
              <Globe className="w-6 h-6 text-[var(--color-accent)]" />
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

          {/* Standardized 2-Tier Bottom Action Area */}
          <div className="mt-auto pt-4 border-t border-[var(--color-border-default)] flex flex-col gap-2">
            <button
              type="button"
              onClick={onLaunchApp}
              className="w-full btn-primary h-10 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Launch Web Vault</span>
            </button>
            <button
              type="button"
              onClick={onOpenGuestVault || onLaunchApp}
              className="w-full btn-secondary h-10 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 border border-[var(--color-border-default)] hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-all cursor-pointer shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Explore Guest Vault</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PlatformDownloadsSection
