import React from 'react'
import { Zap, Github, Sparkles } from 'lucide-react'
import MarkbelLogo from '../MarkbelLogo.js'

export interface LandingFooterProps {
  onLaunchApp: () => void
  onOpenReleaseNotes: () => void
  onSignIn: () => void
  version?: string
}

export function LandingFooter({
  onLaunchApp,
  onOpenReleaseNotes,
  onSignIn,
  version = 'v2.5.8'
}: LandingFooterProps) {
  return (
    <>
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
              type="button"
              onClick={onLaunchApp}
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
            <a
              href="https://github.com/belal-waheed/markbel"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
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
            <a
              href="https://github.com/belal-waheed/markbel/releases"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              Releases
            </a>
            <button
              type="button"
              onClick={onOpenReleaseNotes}
              className="hover:underline cursor-pointer text-[var(--color-accent)] font-semibold flex items-center gap-1"
            >
              <span>{version} Notes</span>
              <Sparkles className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="hover:underline cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </>
  )
}

export default LandingFooter
