/**
 * BackupManager.tsx — Drop-in replacement for the inline backup buttons in ProfilePage.
 *
 * Features:
 * - Export with full metadata (all 7 stores)
 * - Import with validation → preview dialog → confirmation → rehydration
 * - File input reset on every open (so re-selecting the same file works)
 * - No alert() / confirm() — uses in-component state for all feedback
 * - requiresReload path handled gracefully with a visible prompt
 */

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  FileJson,
  Info,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  createBackup,
  downloadBackup,
  parseBackupFile,
  validateBackup,
  applyBackup,
  type ObelBackup,
  type ValidationResult,
} from '@/lib/backup'
import dayjs from 'dayjs'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | 'idle'
  | 'parsing'
  | 'preview'       // Show validation result & metadata before confirming
  | 'restoring'
  | 'success'
  | 'error'

interface State {
  phase: Phase
  validation: ValidationResult | null
  parsedBackup: ObelBackup | null
  restoredKeys: string[]
  requiresReload: boolean
  errorMessage: string
}

const INITIAL_STATE: State = {
  phase: 'idle',
  validation: null,
  parsedBackup: null,
  restoredKeys: [],
  requiresReload: false,
  errorMessage: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BackupManager() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>(INITIAL_STATE)

  // ── Export ──────────────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const backup = await createBackup()
      downloadBackup(backup)
    } finally {
      setIsExporting(false)
    }
  }

  // ── Import flow ─────────────────────────────────────────────────────────────

  const openFilePicker = () => {
    // Reset value so onChange fires even if the same file is selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setState({ ...INITIAL_STATE, phase: 'parsing' })

    try {
      const raw = await parseBackupFile(file)
      const validation = validateBackup(raw)

      setState({
        ...INITIAL_STATE,
        phase: 'preview',
        validation,
        parsedBackup: validation.valid ? (raw as ObelBackup) : null,
      })
    } catch (err) {
      setState({
        ...INITIAL_STATE,
        phase: 'error',
        errorMessage: err instanceof Error ? err.message : 'Unknown error reading file.',
      })
    }
  }

  const handleConfirmRestore = async () => {
    if (!state.parsedBackup) return
    setState((s) => ({ ...s, phase: 'restoring' }))

    try {
      const result = await applyBackup(state.parsedBackup)

      if (!result.success) {
        setState((s) => ({
          ...s,
          phase: 'error',
          errorMessage: result.error ?? 'Restore failed.',
        }))
        return
      }

      setState((s) => ({
        ...s,
        phase: 'success',
        restoredKeys: result.restoredKeys,
        requiresReload: result.requiresReload,
      }))
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: 'error',
        errorMessage: err instanceof Error ? err.message : 'Unexpected error during restore.',
      }))
    }
  }

  const reset = () => setState(INITIAL_STATE)

  // ── Render ──────────────────────────────────────────────────────────────────

  const { phase, validation, restoredKeys, requiresReload, errorMessage } = state

  return (
    <Card className="p-6 md:p-8 border-border/40 bg-card/40 backdrop-blur-xl rounded-3xl overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileSelected}
        aria-label="Select Obel backup file"
      />

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center mb-6">
        <div className="space-y-1.5 max-w-lg">
          <h4 className="font-bold text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Local-First Architecture
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            All your tasks, notes, habits, and metrics live privately in your browser. 
            Export regular backups to prevent data loss when clearing browser storage. 
            Backups include all 7 data stores.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="gap-2 h-12 rounded-xl px-6 font-bold shadow-lg shadow-primary/20"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export Backup
          </Button>
          <Button
            variant="outline"
            onClick={openFilePicker}
            disabled={phase === 'parsing' || phase === 'restoring'}
            className="gap-2 h-12 rounded-xl px-6 font-bold border-border/50"
          >
            {phase === 'parsing' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Restore
          </Button>
        </div>
      </div>

      {/* ── Feedback panels ── */}
      <AnimatePresence mode="wait">

        {/* PARSING */}
        {phase === 'parsing' && (
          <FeedbackPanel key="parsing" variant="info">
            <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
            <span className="font-medium text-sm">Reading and validating backup file...</span>
          </FeedbackPanel>
        )}

        {/* PREVIEW */}
        {phase === 'preview' && validation && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* Errors → cannot proceed */}
            {!validation.valid && (
              <FeedbackPanel variant="error">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <p className="font-bold text-sm text-destructive">Backup file is invalid</p>
                  {validation.errors.map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{e}</p>
                  ))}
                </div>
              </FeedbackPanel>
            )}

            {/* Valid preview */}
            {validation.valid && validation.preview && (
              <div className="border border-border/50 rounded-2xl overflow-hidden bg-background/40">
                {/* Meta header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-muted/20">
                  <FileJson className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">
                      {validation.preview.userEmail ?? 'Obel Backup'}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      Created {dayjs(validation.preview.createdAt).format('MMM D, YYYY [at] HH:mm')}
                      {' · '}v{validation.preview.version}
                    </p>
                  </div>
                </div>

                {/* Data counts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border/30">
                  {[
                    { label: 'Tasks',       value: validation.preview.counts.tasks },
                    { label: 'Habits',      value: validation.preview.counts.habits },
                    { label: 'Notes',       value: validation.preview.counts.notes },
                    { label: 'Coffee Logs', value: validation.preview.counts.coffeeLogs },
                  ].map((item) => (
                    <div key={item.label} className="px-4 py-3 text-center">
                      <p className="text-xl font-black text-foreground">{item.value}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <FeedbackPanel variant="warning">
                <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  {validation.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{w}</p>
                  ))}
                </div>
              </FeedbackPanel>
            )}

            {/* Destructive warning */}
            {validation.valid && (
              <FeedbackPanel variant="warning">
                <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                <p className="text-xs text-muted-foreground flex-1">
                  <span className="font-bold text-foreground">This will overwrite your current data.</span>
                  {' '}Your existing tasks, notes, and habits will be replaced by the backup.
                  Consider exporting a fresh backup first.
                </p>
              </FeedbackPanel>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={reset} className="h-9 px-4 rounded-xl font-bold">
                Cancel
              </Button>
              {validation.valid && (
                <Button
                  size="sm"
                  onClick={handleConfirmRestore}
                  className="h-9 px-5 rounded-xl font-bold gap-2 bg-destructive/90 hover:bg-destructive text-destructive-foreground shadow-lg"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Confirm Restore
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* RESTORING */}
        {phase === 'restoring' && (
          <FeedbackPanel key="restoring" variant="info">
            <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
            <span className="font-medium text-sm">Restoring your data and syncing stores...</span>
          </FeedbackPanel>
        )}

        {/* SUCCESS */}
        {phase === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            <FeedbackPanel variant="success">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  Restore complete — {restoredKeys.length} store{restoredKeys.length !== 1 ? 's' : ''} restored
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {restoredKeys.join(', ')}
                </p>
              </div>
            </FeedbackPanel>

            {requiresReload ? (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                <RefreshCw className="w-5 h-5 text-orange-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-orange-600 dark:text-orange-400">Reload required</p>
                  <p className="text-xs text-muted-foreground">
                    Store rehydration failed. A page reload is needed to apply the restored data.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="gap-2 h-9 px-4 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white border-none shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reload Now
                </Button>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={reset} className="h-9 px-4 rounded-xl font-bold gap-1.5">
                  <X className="w-3.5 h-3.5" />
                  Dismiss
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ERROR */}
        {phase === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <FeedbackPanel variant="error">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="font-bold text-sm text-destructive">Restore failed</p>
                <p className="text-xs text-muted-foreground">{errorMessage}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-8 px-3 rounded-lg font-bold text-xs mt-1 -ml-1"
                >
                  Try again
                </Button>
              </div>
            </FeedbackPanel>
          </motion.div>
        )}

      </AnimatePresence>
    </Card>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────

const variantStyles = {
  info:    'bg-primary/5 border-primary/20',
  success: 'bg-emerald-500/10 border-emerald-500/20',
  warning: 'bg-orange-500/10 border-orange-500/20',
  error:   'bg-destructive/10 border-destructive/20',
}

function FeedbackPanel({
  children,
  variant = 'info',
}: {
  children: React.ReactNode
  variant?: keyof typeof variantStyles
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`flex items-start gap-3 p-4 rounded-2xl border ${variantStyles[variant]}`}
    >
      {children}
    </motion.div>
  )
}
