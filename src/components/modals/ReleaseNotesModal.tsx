import React from 'react'
import {
  X,
  Sparkles,
  Search,
  Layers,
  Database,
  Download,
  ExternalLink,
  CheckCircle2,
  BookOpen,
  Command,
  FolderInput
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
                  What's New in Markbel v2.5.18
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-accent)] text-white shrink-0">
                  Latest
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Safe Private Favicons, Cross-Origin Image Streamlining, Negative Cache Storm Prevention, Web Push Notice &amp; Edge Redirects
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
          {/* Feature: Safe Private Favicons, Cross-Origin Streamlining & Edge Redirects */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Safe Private IP Favicons, Cross-Origin Streamlining &amp; Edge Redirects
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  v2.5.18
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Eliminated console 404 errors for private IP/localhost bookmarks via SSRF-gated public favicon resolution, prevented cross-origin CORS console errors by routing remote image persistence directly to the edge proxy, implemented negative-cache failure tracking to eliminate retry storms on broken thumbnails, added multi-hop redirect handling with Referer preservation in the edge media proxy for anime3rb/vid3rb sources, surfaced actionable web push cloud configuration notices, and pruned deprecated legacy scripts.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Private IP Favicon Guard</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Cross-Origin Direct Proxy</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Negative Cache Storm Prevention</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Edge 3xx Redirect Hops</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Web Push Configuration Notice</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature: Cross-Client Deterministic Media Resilience & Self-Healing Sweep */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Cross-Client Deterministic Media Resilience &amp; Self-Healing Sweep
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  v2.5.17
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Implemented zero-network deterministic thumbnail heuristics across all visual presentation layers (BookmarkCard List &amp; Grid views), proactive Repository mutation enrichment for YouTube and GitHub bookmarks, bidirectional browser extension native sync heuristics, and an automatic Dexie self-healing database sweep on application launch.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Card Thumbnail Heuristics</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Repository Media Enrichment</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Browser Sync Heuristics</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Self-Healing Database Sweep</span>
                </span>
              </div>
            </div>
          </div>
          {/* Feature: Full-Stack Hardening & Compound Dexie FTS Tokens */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Full-Stack Hardening &amp; Compound Dexie FTS Tokens
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  v2.5.16
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Upgraded Dexie IndexedDB to schema <code>version(9)</code> with a compound primary key <code>[token+bookmarkId]</code> for robust multi-bookmark token indexing. Hardened Cloudflare D1 SQLite ingestion with atomic <code>ON CONFLICT(id) DO UPDATE</code> upserts to prevent key collisions, fortified edge background link health prober against SSRF/loopback attacks, and enabled persistent MV3 browser bookmark deletion reflection.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Dexie v9 Compound Tokens</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>D1 SQLite UPSERT Sync Guard</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>SSRF Prober Security Guard</span>
                </span>
              </div>
            </div>
          </div>
          {/* Feature: Distraction-Free Offline Reader View */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Distraction-Free Offline Reader View
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Phase 15 Core
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Enjoy articles in an uncluttered reading environment with dynamic typography controls (Sans/Serif toggle, font sizes sm to xl), a top scroll depth progress bar, estimated reading time, and on-demand edge article extraction.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Customizable Typography</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Scroll Depth Progress</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature: Universal Web Command Palette (Cmd+K) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Command className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Universal Web Command Palette (Cmd+K)
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Keyboard First
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Navigate your library at lightning speed. Press <code>Cmd+K</code> or <code>Ctrl+K</code> anywhere to open the command palette. Execute quick actions (Add Bookmark, Trigger Sync, View Unread/Pinned/Archive) and search bookmarks instantly with ranked matching.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Universal Cmd+K / Ctrl+K</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Unified Quick Commands</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature: Batch Move to Group */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Batch Move-to-Group Toolbar Operations
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Organization
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Reorganize your library in bulk. Select multiple bookmarks in list or grid view and move them into any existing custom category in a single transaction with automatic background cloud sync.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Transactional Batch Updates</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Multi-Select Toolbar</span>
                </span>
              </div>
            </div>
          </div>
          {/* Feature 1: Dexie URL Indexing & HUD Duplicate Detection */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Dexie URL Indexing &amp; Extension Duplicate Detection
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Phase 14 Core
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Upgraded Dexie IndexedDB schema to <code>version(7)</code> with an indexed <code>url</code> column. The browser extension HUD now executes sub-millisecond queries to detect if the active tab is already bookmarked in your vault, switching seamlessly into Quick Search mode.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Dexie v7 Indexed URL</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Extension HUD Already-in-Vault Detection</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 2: Edge Hot-Path DDL Removal & Delta Compaction */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Hot-Path DDL Elimination &amp; Delta Log Compaction
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Edge Cloudflare Worker
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Eliminated dynamic <code>CREATE INDEX IF NOT EXISTS</code> calls on the push sync mutation hot path, shifting all index governance to static schema migrations. Added <code>POST /api/sync/compact</code> to prune obsolete historical audit deltas.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>0ms DDL Push Overhead</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>POST /api/sync/compact Endpoint</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 3: Universal Ingest Cleansing & Unified Search Catalog */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Universal Ingest Cleansing &amp; Unified Search Catalog
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Privacy &amp; Discovery
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Universal URL parameter sanitization automatically strips tracking identifiers (<code>si</code>, <code>igsh</code>, <code>fbclid</code>, <code>gbraid</code>, <code>wbraid</code>, <code>utm_*</code>) across modal input, extension saves, agent API, and sync mutations. Web Vault search is now unified with tokenized scoring and ranking.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Tracking Parameter Cleansing</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Unified Tokenized Ranking</span>
                </span>
              </div>
            </div>
          </div>
          {/* Feature 1: Modular Agent Sub-Routers & OpenAPI Decoupling */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Modular Agent Sub-Routers &amp; OpenAPI Decoupling
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Phase 13 Architecture
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Deconstructed monolithic <code>worker/src/routes/agent.ts</code> (943 lines) into modular domain sub-routers under <code>worker/src/routes/agent/</code> (bookmarks, groups, settings, stats, common). Maintains 100% backwards-compatible REST endpoints, atomic D1 SQLite sync_changes mutations, and OpenAPI 3.1 specification contracts.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Bookmarks Sub-Router</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Groups &amp; Rules Sub-Router</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Settings &amp; Preferences Sub-Router</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Vault Stats Sub-Router</span>
                </span>
              </div>
            </div>
          </div>
          {/* Feature 1: Modular Batch Operations & Floating Action Bar */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Modular Batch Operations &amp; Action Bar
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Phase 12 Architecture
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Deconstructed <code>BookmarksPage.tsx</code> by extracting <code>useBookmarkBatchOperations</code>, <code>useBookmarkKeyboardShortcuts</code>, and the floating <code>BookmarkBatchBar</code> component. Enables resilient multiselect, transactional bulk delete, bulk archive, and bulk read toggling with zero UI coupling.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>useBookmarkBatchOperations Hook</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>useBookmarkKeyboardShortcuts Manager</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>BookmarkBatchBar Component</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>23 Subsystem Unit Tests</span>
                </span>
              </div>
            </div>
          </div>
          {/* Feature 1: Nested Subroutes & Clean Architecture */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Nested App Subroutes &amp; Legacy Aliases
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Deep Linking
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Modernized URL routing organizes the application shell and views cleanly under <code>/app</code>, <code>/app/archive</code>, and <code>/app/settings</code> with automatic backwards-compatible redirects for legacy URLs and graceful catch-all fallbacks.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>/app/* Nested Routes</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Transparent 301/302 Aliasing</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 2: URL Query State Reflection */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Live URL Query State Reflection
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Shareable Filter States
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Active group filters (<code>?group=</code>), tab filters (<code>?tab=</code>), and search queries (<code>?q=</code>) are automatically reflected in the browser URL with debounced replace-navigation, enabling bookmarking, sharing, and native browser Back/Forward navigation.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Browser Back/Forward Sync</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Debounced URL Replace</span>
                </span>
              </div>
            </div>
          </div>
          {/* Feature 1: In-Page Spotlight Command Palette (Alt+O) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  In-Page Spotlight Command Palette (Alt+O)
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Universal In-Page HUD
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Floating Shadow DOM command bar over any webpage, in-memory catalog caching, 0ms keystroke search, and zero host CSS interference. Summon your personal bookmark vault instantly from any tab without disrupting your current browsing flow.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Alt+O Global Shortcut</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Shadow DOM Isolation</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>0ms Keystroke Search</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 2: Dual-Mode Popup HUD with Smart Context Switch (Alt+B / Tab) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Dual-Mode Popup HUD with Smart Context Switch (Alt+B / Tab)
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Extension &amp; UX
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Automatic detection of whether the active page is already saved, defaulting to Quick Open or Save mode accordingly. Toggle between modes seamlessly using the <code className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--color-bg-surface)]">Tab</code> key with full keyboard navigation and instant link launch.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Smart Context Detection</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Tab Key Mode Switching</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Instant Link Launcher</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feature 3: Sub-Millisecond Search Catalog Engine */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Sub-Millisecond Search Catalog Engine
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-mono">
                  Search &amp; Performance
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Deterministic multi-attribute weighted ranking across title, group, URL domain, and description with pinned item prioritization. Pre-indexes catalog records in client memory for 0ms sub-millisecond filtering across thousands of bookmarks.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Weighted Multi-Attribute Scoring</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Pinned Item Priority</span>
                </span>
                <span className="px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Zero-Latency In-Memory Index</span>
                </span>
              </div>
            </div>
          </div>

          {/* Download Assets Box */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-accent)]/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                Direct Download Assets
              </span>
              <a
                href="https://github.com/belal-waheed/markbel/releases/latest"
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
                href="https://github.com/belal-waheed/markbel/releases/latest/download/Markbel.apk"
                target="_blank"
                rel="noreferrer"
                className="btn-primary py-2.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs touch-manipulation cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Markbel.apk (Android)</span>
              </a>

              <a
                href="https://github.com/belal-waheed/markbel/releases/latest/download/markbel-firefox-extension.zip"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary py-2.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 border border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 touch-manipulation cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Firefox Extension (.zip)</span>
              </a>

              <a
                href="https://github.com/belal-waheed/markbel/releases/latest/download/markbel-extension.zip"
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
