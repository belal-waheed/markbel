import React from 'react'
import {
  X,
  Sparkles,
  Layers,
  FlaskConical,
  Tag,
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
                  What's New in Markbel v2.5.2
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-accent)] text-white shrink-0">
                  Latest
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Cascade Sync Engine, Batch Transactions, Reminder Controls, QStash Alert Deduplication & Firefox MV3
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
          {/* Feature 1: Cascade Sync Engine & Batch Transactions */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Cascade Sync Engine & Atomic Batch Transactions
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Sync & Storage
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Renaming or deleting a group now seamlessly cascades bookmark assignments across IndexedDB and Cloudflare D1 with automatic version bumping and outbox synchronization. Bulk actions execute in single atomic transactions.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>D1 & IndexedDB Cascade Synchronization</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Atomic bulkUpdate & bulkDelete Transactions</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 2: Reminder Controls & Smart Alert Deduplication */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Reminder Controls & Smart Alert Deduplication
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Notifications
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Directly snooze (+1 day) or dismiss reminders from cards without opening the edit modal. Cloudflare QStash reminder cron records dispatch timestamps in D1, permanently eliminating repeated alert notifications.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Quick Snooze (+1d) & Dismiss Controls</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>D1 notified_at Cron Deduplication</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 3: Reactive Archive Vault & Modal Input Safety */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Reactive Archive Vault & Modal Input Safety
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  UI & Reactivity
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Archive Vault now reactively synchronizes via Dexie live queries and triggers immediate background sync upon unarchiving or deleting. Add Bookmark modal protects active user typing from background preview overwrites.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Reactive Archive useLiveQuery</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Input Race Condition Elimination</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 4: Firefox & Firefox Developer Edition Target */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Firefox & Firefox Dev Edition Extension Target
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Browser Extensions
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Dedicated Gecko Manifest V3 packaging with event background scripts for Mozilla Firefox and Developer Edition, including interactive about:debugging load guide.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>Gecko MV3 Event Page Compliance</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>Firefox Dev Edition Persistent Ready</span>
                </span>
              </div>
            </div>
          </div>

          {/* Download Assets Box */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-accent)]/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                Direct Download Assets (v2.5.2)
              </span>
              <a
                href="https://github.com/belal-waheed/markbel/releases/tag/v2.5.2"
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
                href="https://github.com/belal-waheed/markbel/releases/download/v2.5.2/Markbel.apk"
                target="_blank"
                rel="noreferrer"
                className="btn-primary py-2.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs touch-manipulation cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Markbel.apk (Android)</span>
              </a>

              <a
                href="https://github.com/belal-waheed/markbel/releases/download/v2.5.2/markbel-firefox-extension.zip"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary py-2.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 border border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 touch-manipulation cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Firefox Extension (.zip)</span>
              </a>

              <a
                href="https://github.com/belal-waheed/markbel/releases/download/v2.5.2/markbel-extension.zip"
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


