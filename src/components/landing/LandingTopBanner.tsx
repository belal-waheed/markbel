import React from 'react'
import { Sparkles } from 'lucide-react'

export interface LandingTopBannerProps {
  onOpenReleaseNotes: () => void
  version?: string
}

export function LandingTopBanner({
  onOpenReleaseNotes,
  version = 'v2.5.8'
}: LandingTopBannerProps) {
  return (
    <div className="bg-[var(--color-bg-element)] border-b border-[var(--color-border-default)] px-4 py-2 sm:py-2.5 text-center text-xs text-[var(--color-text-muted)] font-medium select-none">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 leading-snug">
          <span className="font-semibold text-[var(--color-text-primary)]">
            Markbel {version} is live
          </span>
          <span className="hidden sm:inline text-[var(--color-border-default)]">•</span>
          <span>
            In-Page Spotlight Link Launcher (Alt+O), Dual-Mode Quick-Open HUD (Alt+B) & 0ms Search Catalog
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenReleaseNotes}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1 sm:py-0.5 rounded-full text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 active:scale-95 transition-all border border-[var(--color-accent)]/25 cursor-pointer touch-manipulation min-h-[32px] sm:min-h-0 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
          <span>{version} Notes</span>
        </button>
      </div>
    </div>
  )
}

export default LandingTopBanner
