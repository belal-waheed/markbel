import React from 'react'
import {
  X,
  Sparkles,
  Layers,
  Smartphone,
  Youtube,
  RefreshCw,
  Download,
  ExternalLink,
  CheckCircle2,
  Tag,
  Trash2,
  Archive,
  CheckSquare
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
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border-default)] flex items-center justify-between bg-gradient-to-r from-[var(--color-bg-surface)] to-[var(--color-bg-elevated)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                  What's New in Markbel v2.4.0
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-accent)] text-white">
                  Latest Release
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                YouTube Playlist Preservation, Android Intent Query Reconstruction & Bulk Multiselect
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-element)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Release Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Feature 1: Bulk Multiselect */}
          <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Bulk Multiselect & Floating Action Bar
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Web & Desktop
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Hover over any bookmark thumbnail to reveal the selection checkbox. Select dozens of bookmarks at once to perform instant bulk actions:
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span>Bulk Delete with confirmation</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <Archive className="w-3 h-3 text-amber-400" />
                  <span>Bulk Archive to archive vault</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckSquare className="w-3 h-3 text-emerald-400" />
                  <span>Bulk Mark as Read / Unread</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 2: Headless Android Share */}
          <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Zero-UI Instant Android Share Sheet
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Android APK
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                When sharing links from Chrome, Twitter, Reddit, or YouTube into Markbel on Android, the capture now runs completely headless in under 50ms without UI flicker, returning you instantly back to your browsing app.
              </p>
            </div>
          </div>

          {/* Feature 3: YouTube Playlists */}
          <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  YouTube Playlists & Deterministic Media Heuristics
                </h3>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Links containing YouTube playlists are now automatically recognized with dedicated <code className="px-1 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-primary)] font-mono text-[11px]">playlist</code> content tagging, sorted into the <code className="px-1 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-primary)] font-mono text-[11px]">YT</code> smart group, and paired with high-resolution thumbnail caching.
              </p>
            </div>
          </div>

          {/* Feature 4: Outbox Compaction */}
          <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Offline Outbox Compaction & Edge Delta Sync
                </h3>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Prevented data loss during network drops by moving IndexedDB mutation cleanup strictly behind verified server HTTP confirmation. Poison pills (&gt;5 retries) are isolated to keep sync flowing smoothly.
              </p>
            </div>
          </div>

          {/* Download Assets Box */}
          <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-accent)]/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                Direct Download Assets (v2.4.0)
              </span>
              <a
                href="https://github.com/belal-waheed/markbel/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-1"
              >
                <span>View on GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href="https://github.com/belal-waheed/markbel/releases/latest/download/Markbel.apk"
                target="_blank"
                rel="noreferrer"
                className="btn-primary py-2.5 px-3.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download Markbel.apk (Android)</span>
              </a>

              <a
                href="https://github.com/belal-waheed/markbel/releases/latest/download/markbel-extension.zip"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary py-2.5 px-3.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download markbel-extension.zip</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] flex justify-end">
          <button
            onClick={onClose}
            className="btn-primary py-2 px-5 text-xs font-semibold rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

