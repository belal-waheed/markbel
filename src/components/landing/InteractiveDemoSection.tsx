import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Pin,
  Star,
  Clock,
  Play
} from 'lucide-react'
import {
  INITIAL_DEMO_BOOKMARKS,
  type DemoBookmark,
  filterDemoBookmarks,
  toggleBookmarkPin
} from './landingConstants.js'

export interface InteractiveDemoSectionProps {
  initialBookmarks?: DemoBookmark[]
}

const CATEGORY_CHIPS = ['All', 'Dev', 'Articles', 'Video', 'Design'] as const

export function InteractiveDemoSection({
  initialBookmarks = INITIAL_DEMO_BOOKMARKS
}: InteractiveDemoSectionProps) {
  const [demoViewMode, setDemoViewMode] = useState<'grid' | 'list'>('grid')
  const [demoFilterGroup, setDemoFilterGroup] = useState<string>('All')
  const [demoSearchQuery, setDemoSearchQuery] = useState('')
  const [demoBookmarks, setDemoBookmarks] = useState<DemoBookmark[]>(initialBookmarks)

  const handleTogglePin = (id: string) => {
    setDemoBookmarks((prev) => toggleBookmarkPin(prev, id))
  }

  const filteredDemoBookmarks = useMemo(() => {
    return filterDemoBookmarks(demoBookmarks, demoFilterGroup, demoSearchQuery)
  }, [demoBookmarks, demoFilterGroup, demoSearchQuery])

  return (
    <section id="demo" className="py-14 sm:py-20 max-w-5xl mx-auto px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-xl overflow-hidden"
      >
        {/* Mock Vault Window Top Bar */}
        <div className="px-4 py-3 bg-[var(--color-bg-element)] border-b border-[var(--color-border-default)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <span className="text-xs font-mono font-semibold text-[var(--color-text-muted)] ml-2">
              Markbel Interactive Vault Demo
            </span>
          </div>

          {/* Layout Toggle Controls */}
          <div className="flex items-center gap-1 bg-[var(--color-bg-surface)] p-1 rounded-lg border border-[var(--color-border-default)]">
            <button
              type="button"
              onClick={() => setDemoViewMode('grid')}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                demoViewMode === 'grid'
                  ? 'bg-[var(--color-accent)] text-white shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
              title="Grid View"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setDemoViewMode('list')}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                demoViewMode === 'list'
                  ? 'bg-[var(--color-accent)] text-white shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
              title="List View"
              aria-label="List view"
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>

        {/* Interactive Toolbar: Search & Category Chips */}
        <div className="p-4 sm:p-5 border-b border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={demoSearchQuery}
              onChange={(e) => setDemoSearchQuery(e.target.value)}
              placeholder="Live search bookmarks, tags, domains..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_CHIPS.map((grp) => (
              <button
                key={grp}
                type="button"
                onClick={() => setDemoFilterGroup(grp)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  demoFilterGroup === grp
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)]'
                }`}
              >
                {grp}
              </button>
            ))}
          </div>
        </div>

        {/* Bookmarks Canvas */}
        <div className="p-4 sm:p-6 bg-[var(--color-bg-main)] min-h-[320px]">
          {filteredDemoBookmarks.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
              No matching bookmarks found in preview filter.
            </div>
          ) : demoViewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredDemoBookmarks.map((bookmark) => (
                <motion.div
                  key={bookmark.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs hover:border-[var(--color-accent)]/50 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] border border-[var(--color-border-default)] shrink-0">
                          {bookmark.domain}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 shrink-0">
                          {bookmark.group}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePin(bookmark.id)}
                        className={`p-1 rounded cursor-pointer transition-colors ${
                          bookmark.isPinned
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                        }`}
                        title={bookmark.isPinned ? 'Pinned to top' : 'Pin bookmark'}
                        aria-label={bookmark.isPinned ? 'Unpin bookmark' : 'Pin bookmark'}
                      >
                        <Pin className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>

                    <h4 className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors leading-snug">
                      {bookmark.title}
                    </h4>
                    <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                      {bookmark.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--color-border-default)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {bookmark.tags.map((t) => (
                        <span key={t} className="text-[10px] text-[var(--color-text-muted)] font-mono">
                          #{t}
                        </span>
                      ))}
                    </div>

                    {bookmark.metric && (
                      <div className="flex items-center gap-1 font-medium text-[var(--color-text-primary)]">
                        {bookmark.metricIcon === 'star' && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                        {bookmark.metricIcon === 'clock' && <Clock className="w-3 h-3 text-[var(--color-text-muted)]" />}
                        {bookmark.metricIcon === 'play' && <Play className="w-3 h-3 text-red-500 fill-red-500" />}
                        <span>{bookmark.metric}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDemoBookmarks.map((bookmark) => (
                <motion.div
                  key={bookmark.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs flex items-center justify-between gap-3 hover:border-[var(--color-accent)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePin(bookmark.id)}
                      className={`p-1 rounded cursor-pointer shrink-0 ${
                        bookmark.isPinned ? 'text-amber-500' : 'text-[var(--color-text-muted)]'
                      }`}
                      aria-label={bookmark.isPinned ? 'Unpin bookmark' : 'Pin bookmark'}
                    >
                      <Pin className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                          {bookmark.title}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] shrink-0">
                          {bookmark.group}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">
                        {bookmark.domain}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] shrink-0 font-medium">
                    {bookmark.metric && <span>{bookmark.metric}</span>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </section>
  )
}

export default InteractiveDemoSection
