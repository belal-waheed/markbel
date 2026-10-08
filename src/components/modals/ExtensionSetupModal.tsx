import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Download,
  Copy,
  Check,
  ExternalLink,
  Puzzle,
  Zap,
  Sliders,
  CheckCircle2,
  FolderArchive,
  ArrowRight,
  Sparkles,
  Pin,
  Terminal,
  Info
} from 'lucide-react'

interface ExtensionSetupModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'chrome' | 'edge' | 'firefox'
}

export const ExtensionSetupModal: React.FC<ExtensionSetupModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'firefox'
}) => {
  const [activeTab, setActiveTab] = useState<'chrome' | 'edge' | 'firefox'>(initialTab)
  const [activeStep, setActiveStep] = useState<number>(1)
  const [copiedUrl, setCopiedUrl] = useState(false)

  React.useEffect(() => {
    if (!isOpen) return
    setActiveTab(initialTab)
    setActiveStep(1)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, initialTab])

  if (!isOpen) return null

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border-default)] flex items-center justify-between bg-gradient-to-r from-[var(--color-bg-surface)] to-[var(--color-bg-elevated)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)]">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                  Install Markbel Extension
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  v2.5.3
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Instant 1-click bookmark saving and smart grouping in your browser
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

        {/* Browser Selector Tabs */}
        <div className="flex border-b border-[var(--color-border-default)] bg-[var(--color-bg-main)] px-6 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('firefox')
              setActiveStep(1)
            }}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'firefox'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <span>Firefox & Dev Edition</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
              Gecko MV3
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('edge')
              setActiveStep(1)
            }}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'edge'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <span>Microsoft Edge</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold">
              1-Click Store
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('chrome')
              setActiveStep(1)
            }}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'chrome'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <span>Google Chrome & Brave</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border-default)]">
              3 Steps
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'edge' ? (
            /* Microsoft Edge 1-Click Guide */
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    Official Microsoft Edge Add-ons Store
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                    Markbel is officially verified and published on Microsoft Edge Add-ons. You do not need developer mode or manual extraction.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <a
                  href="https://microsoftedge.microsoft.com/addons/detail/markbel-%E2%80%94-quick-bookmarks/molmflphbifkekgnobnflblphdefpjfc"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full btn-primary py-3 px-5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Install from Edge Add-ons Store</span>
                </a>
                <p className="text-center text-[11px] text-[var(--color-text-muted)]">
                  Click "Get" on the Edge Store page, and Markbel will instantly install into your toolbar.
                </p>
              </div>
            </div>
          ) : activeTab === 'firefox' ? (
            /* Firefox & Firefox Developer Edition 3-Step Walkthrough */
            <div>
              {/* Stepper Progress Bar */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[
                  { step: 1, title: 'Download & Unzip', icon: Download },
                  { step: 2, title: 'Open Debugger', icon: Sliders },
                  { step: 3, title: 'Load Add-on', icon: Puzzle }
                ].map((s) => (
                  <button
                    key={s.step}
                    onClick={() => setActiveStep(s.step)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2.5 ${
                      activeStep === s.step
                        ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
                        : activeStep > s.step
                        ? 'bg-[var(--color-bg-elevated)] border-[var(--color-border-default)] opacity-90'
                        : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-default)] opacity-50'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                        activeStep === s.step
                          ? 'bg-[var(--color-accent)] text-white'
                          : activeStep > s.step
                          ? 'bg-emerald-500 text-white'
                          : 'bg-[var(--color-bg-element)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      {activeStep > s.step ? '✓' : s.step}
                    </div>
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate hidden sm:inline">
                      {s.title}
                    </span>
                  </button>
                ))}
              </div>

              {/* Step Panels */}
              <AnimatePresence mode="wait">
                {activeStep === 1 && (
                  <motion.div
                    key="firefox-step-1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--color-accent)]">Step 1 of 3</span>
                        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">Gecko MV3 .zip</span>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                        Download Firefox Extension Package
                      </h4>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                        Download the pre-packaged <code className="px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-primary)] font-mono text-[11px]">markbel-firefox-extension.zip</code> file, then extract it into a folder on your computer.
                      </p>

                      <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <a
                          href="https://github.com/belal-waheed/markbel/releases/latest/download/markbel-firefox-extension.zip"
                          target="_blank"
                          rel="noreferrer"
                          className="btn-primary py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download markbel-firefox-extension.zip</span>
                        </a>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--color-bg-element)] border border-[var(--color-border-default)] flex items-start gap-3">
                      <FolderArchive className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                        <strong className="text-[var(--color-text-primary)]">Extraction:</strong> Right-click the downloaded <code className="font-mono text-[11px]">.zip</code> and extract it to a permanent folder such as <code className="font-mono text-[11px]">Documents/markbel-firefox-extension</code>.
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => setActiveStep(2)}
                        className="btn-primary py-2 px-4 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Next: Open Firefox Debugger</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeStep === 2 && (
                  <motion.div
                    key="firefox-step-2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--color-accent)]">Step 2 of 3</span>
                        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">about:debugging</span>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                        Open Internal Add-on Debugger
                      </h4>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                        In a new Firefox tab, paste the debugging URL below into the address bar to access the temporary add-ons manager.
                      </p>

                      {/* Mock Firefox Omnibox */}
                      <div className="mt-4 p-2.5 rounded-lg bg-[var(--color-bg-element)] border border-[var(--color-border-default)] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-mono text-xs text-[var(--color-text-primary)] truncate">
                          <span className="text-[var(--color-text-muted)] select-none">URL:</span>
                          <span className="text-[var(--color-accent)]">about:debugging#/runtime/this-firefox</span>
                        </div>
                        <button
                          onClick={() => handleCopy('about:debugging#/runtime/this-firefox')}
                          className="btn-secondary py-1 px-2.5 text-[11px] font-medium rounded flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {copiedUrl ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy URL</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="mt-3 p-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] flex items-center gap-3">
                        <Info className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                        <span className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                          Click on <strong className="text-[var(--color-text-primary)]">"This Firefox"</strong> in the left sidebar if not automatically selected.
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between pt-2">
                      <button
                        onClick={() => setActiveStep(1)}
                        className="btn-secondary py-2 px-3.5 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setActiveStep(3)}
                        className="btn-primary py-2 px-4 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Next: Load Temporary Add-on</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeStep === 3 && (
                  <motion.div
                    key="firefox-step-3"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--color-accent)]">Step 3 of 3</span>
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Final Step</span>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                        Click "Load Temporary Add-on..." & Select manifest.json
                      </h4>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                        Under Temporary Extensions, click <strong>"Load Temporary Add-on..."</strong>, navigate to your extracted folder, and choose <code className="px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-primary)] font-mono text-[11px]">manifest.json</code>.
                      </p>

                      <div className="mt-4 p-3 rounded-lg bg-[var(--color-bg-element)] border border-[var(--color-border-default)] flex items-center gap-3">
                        <div className="px-3 py-1.5 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5 shadow-xs">
                          <FolderArchive className="w-4 h-4 text-[var(--color-accent)]" />
                          <span>Load Temporary Add-on...</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                          <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                          <span>Select manifest.json</span>
                        </div>
                      </div>

                      {/* Developer Edition Callout */}
                      <div className="mt-4 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/25 text-xs text-[var(--color-text-primary)] flex items-start gap-3">
                        <Terminal className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          <strong className="text-amber-700 dark:text-amber-300">Firefox Developer Edition Persistent Install:</strong>
                          <p className="mt-0.5 text-[var(--color-text-muted)]">
                            To keep Markbel installed permanently across restarts without AMO signing, navigate to <code className="font-mono text-[10px] px-1 py-0.5 bg-[var(--color-bg-element)] rounded">about:config</code>, search for <code className="font-mono text-[10px] px-1 py-0.5 bg-[var(--color-bg-element)] rounded">xpinstall.signatures.required</code>, and toggle it to <strong className="text-amber-700 dark:text-amber-300">false</strong>.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Shortcuts Cheat Sheet */}
                    <div className="p-3.5 rounded-xl bg-[var(--color-bg-element)] border border-[var(--color-border-default)]">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Ready to Use! Keyboard Shortcuts</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between p-2 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                          <span className="text-[var(--color-text-muted)]">Quick Save:</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] font-mono text-[10px] text-[var(--color-text-primary)] border border-[var(--color-border-default)]">
                            Alt+Shift+S
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                          <span className="text-[var(--color-text-muted)]">Open HUD:</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] font-mono text-[10px] text-[var(--color-text-primary)] border border-[var(--color-border-default)]">
                            Alt+B
                          </kbd>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-2">
                      <button
                        onClick={() => setActiveStep(2)}
                        className="btn-secondary py-2 px-3.5 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={onClose}
                        className="btn-primary py-2 px-4 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Got it, I'm all set!</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* Chrome & Brave Interactive 3-Step Walkthrough */
            <div>
              {/* Stepper Progress Bar */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[
                  { step: 1, title: 'Download & Unzip', icon: Download },
                  { step: 2, title: 'Developer Mode', icon: Sliders },
                  { step: 3, title: 'Load & Pin', icon: Puzzle }
                ].map((s) => (
                  <button
                    key={s.step}
                    onClick={() => setActiveStep(s.step)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2.5 ${
                      activeStep === s.step
                        ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
                        : activeStep > s.step
                        ? 'bg-[var(--color-bg-elevated)] border-[var(--color-border-default)] opacity-90'
                        : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-default)] opacity-50'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                        activeStep === s.step
                          ? 'bg-[var(--color-accent)] text-white'
                          : activeStep > s.step
                          ? 'bg-emerald-500 text-white'
                          : 'bg-[var(--color-bg-element)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      {activeStep > s.step ? '✓' : s.step}
                    </div>
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate hidden sm:inline">
                      {s.title}
                    </span>
                  </button>
                ))}
              </div>

              {/* Step Panels */}
              <AnimatePresence mode="wait">
                {activeStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--color-accent)]">Step 1 of 3</span>
                        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">~40 KB .zip</span>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                        Download the Markbel Extension Archive
                      </h4>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                        Download the pre-packaged <code className="px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-primary)] font-mono text-[11px]">markbel-extension.zip</code> file, then extract it onto your computer.
                      </p>

                      <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <a
                          href="https://github.com/belal-waheed/markbel/releases/latest/download/markbel-extension.zip"
                          target="_blank"
                          rel="noreferrer"
                          className="btn-primary py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download markbel-extension.zip</span>
                        </a>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--color-bg-element)] border border-[var(--color-border-default)] flex items-start gap-3">
                      <FolderArchive className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                        <strong className="text-[var(--color-text-primary)]">Pro Tip:</strong> Right-click the downloaded <code className="font-mono text-[11px]">.zip</code> and choose <span className="text-[var(--color-text-primary)] font-medium">"Extract All"</span> to a permanent folder like <code className="font-mono text-[11px]">Documents/markbel-extension</code>. Do not delete this folder after installing!
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => setActiveStep(2)}
                        className="btn-primary py-2 px-4 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Next: Enable Developer Mode</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--color-accent)]">Step 2 of 3</span>
                        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">chrome://extensions</span>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                        Open Extensions & Enable Developer Mode
                      </h4>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                        Open a new browser tab, navigate to the Extensions manager, and toggle the switch labeled <strong>"Developer mode"</strong> in the top-right corner.
                      </p>

                      {/* Mock Chrome Omnibox */}
                      <div className="mt-4 p-2.5 rounded-lg bg-[var(--color-bg-element)] border border-[var(--color-border-default)] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-mono text-xs text-[var(--color-text-primary)] truncate">
                          <span className="text-[var(--color-text-muted)] select-none">URL:</span>
                          <span className="text-[var(--color-accent)]">chrome://extensions</span>
                        </div>
                        <button
                          onClick={() => handleCopy('chrome://extensions')}
                          className="btn-secondary py-1 px-2.5 text-[11px] font-medium rounded flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {copiedUrl ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy URL</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Visual Diagram of Dev Mode Switch */}
                      <div className="mt-3 p-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-[var(--color-accent)]" />
                          <span className="text-xs font-medium text-[var(--color-text-primary)]">
                            Developer mode (Top Right Corner)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <span>TOGGLE ON</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-2">
                      <button
                        onClick={() => setActiveStep(1)}
                        className="btn-secondary py-2 px-3.5 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setActiveStep(3)}
                        className="btn-primary py-2 px-4 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Next: Load Unpacked & Pin</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeStep === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--color-accent)]">Step 3 of 3</span>
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Final Step</span>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                        Click "Load unpacked" & Select Folder
                      </h4>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                        With Developer mode enabled, click the <strong>"Load unpacked"</strong> button in the top-left toolbar, then select the folder you extracted in Step 1.
                      </p>

                      <div className="mt-4 p-3 rounded-lg bg-[var(--color-bg-element)] border border-[var(--color-border-default)] flex items-center gap-3">
                        <div className="px-3 py-1.5 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5 shadow-xs">
                          <FolderArchive className="w-4 h-4 text-[var(--color-accent)]" />
                          <span>Load unpacked</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                          <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                          <span>Select your unzipped folder</span>
                        </div>
                      </div>

                      <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-[var(--color-text-primary)] flex items-start gap-2.5">
                        <Pin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          <strong>Don't forget to Pin!</strong> Click the extensions puzzle icon in your browser's top bar and toggle the <strong className="text-emerald-700 dark:text-emerald-400">Pin</strong> icon next to Markbel.
                        </div>
                      </div>
                    </div>

                    {/* Shortcuts Cheat Sheet */}
                    <div className="p-3.5 rounded-xl bg-[var(--color-bg-element)] border border-[var(--color-border-default)]">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Ready to Use! Keyboard Shortcuts</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between p-2 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                          <span className="text-[var(--color-text-muted)]">Quick Save:</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] font-mono text-[10px] text-[var(--color-text-primary)] border border-[var(--color-border-default)]">
                            Alt+Shift+S
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]">
                          <span className="text-[var(--color-text-muted)]">Open HUD:</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] font-mono text-[10px] text-[var(--color-text-primary)] border border-[var(--color-border-default)]">
                            Alt+B
                          </kbd>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-2">
                      <button
                        onClick={() => setActiveStep(2)}
                        className="btn-secondary py-2 px-3.5 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={onClose}
                        className="btn-primary py-2 px-4 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Got it, I'm all set!</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
