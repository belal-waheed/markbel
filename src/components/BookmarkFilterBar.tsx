import React from 'react'
import {
  Search,
  X,
  Pin,
  Clock,
  BookOpen,
  Layers,
  LayoutGrid,
  List,
  ListVideo,
  Code2,
  ArrowUpDown,
  Command,
} from 'lucide-react'

export type FilterTab = 'all' | 'unread' | 'pinned' | 'due' | 'videos' | 'articles' | 'code'
export type ViewMode = 'grid' | 'list'
export type SortOption = 'newest' | 'oldest' | 'alpha' | 'readtime'

interface BookmarkFilterBarProps {
  currentTab: FilterTab
  onTabChange: (tab: FilterTab) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  viewMode: ViewMode
  onViewModeChange: (m: ViewMode) => void
  counts: {
    all: number
    unread: number
    pinned: number
    due: number
    videos?: number
    articles?: number
    code?: number
  }
  searchInputRef: React.RefObject<HTMLInputElement | null>
  sortOption?: SortOption
  onSortChange?: (sort: SortOption) => void
}

export const BookmarkFilterBar: React.FC<BookmarkFilterBarProps> = ({
  currentTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  counts,
  searchInputRef,
  sortOption = 'newest',
  onSortChange,
}) => {
  const tabs = [
    { id: 'all' as FilterTab, label: 'All', count: counts.all, icon: Layers },
    { id: 'unread' as FilterTab, label: 'Unread', count: counts.unread, icon: BookOpen },
    { id: 'pinned' as FilterTab, label: 'Pinned', count: counts.pinned, icon: Pin },
    { id: 'due' as FilterTab, label: 'Due & Overdue', count: counts.due, icon: Clock },
  ]

  const mediaFilters = [
    { id: 'videos' as FilterTab, label: 'Videos', count: counts.videos, icon: ListVideo },
    { id: 'articles' as FilterTab, label: 'Articles', count: counts.articles, icon: BookOpen },
    { id: 'code' as FilterTab, label: 'Code', count: counts.code, icon: Code2 },
  ]

  return (
    <div className="flex flex-col gap-3 mb-6 bg-[var(--color-bg-surface)] p-3 sm:p-3.5 rounded-xl border border-[var(--color-border-subtle)] shadow-xs">
      {/* Top Row: Central Command Omnibox + Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Full-Width Search Input with Shortcut Badges */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search vault, tags, domains, or full-text notes..."
            className="w-full bg-[var(--color-bg-muted)]/70 hover:bg-[var(--color-bg-muted)] border border-[var(--color-border-subtle)] focus:border-[var(--color-border-focus)] rounded-lg py-2 pl-9 pr-16 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] transition-all font-sans"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none gap-1">
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-[var(--color-text-tertiary)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded shadow-2xs">
                <Command className="w-2.5 h-2.5" />K
              </kbd>
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono font-medium text-[var(--color-text-tertiary)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded shadow-2xs">
                /
              </kbd>
            </div>
          )}
        </div>

        {/* Right Action Tools: Sort Dropdown & View Mode Switcher */}
        <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
          {/* Sort Selector */}
          {onSortChange && (
            <div className="flex items-center gap-1.5 bg-[var(--color-bg-muted)] px-2 py-1 rounded-lg border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-secondary)]">
              <ArrowUpDown className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] shrink-0" />
              <select
                value={sortOption}
                onChange={(e) => onSortChange(e.target.value as SortOption)}
                className="bg-transparent border-none text-xs text-[var(--color-text-primary)] focus:outline-none cursor-pointer pr-1"
                aria-label="Sort bookmarks"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="alpha">Title A-Z</option>
                <option value="readtime">Read Time</option>
              </select>
            </div>
          )}

          {/* View Mode Toggle: Grid | List */}
          <div className="flex items-center bg-[var(--color-bg-muted)] p-0.5 rounded-lg border border-[var(--color-border-subtle)] shrink-0">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xs'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
              }`}
              title="Grid View (Visual Cards)"
              aria-label="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xs'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
              }`}
              title="Compact List View (Dense Rows)"
              aria-label="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Quick Segmented Filter Tabs & Media Pills */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar pb-0.5">
        {/* Core Filter Tabs */}
        <div className="flex items-center gap-1 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-[var(--color-bg-muted)] text-[var(--color-text-tertiary)]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Media Quick Filter Pills */}
        <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-[var(--color-border-subtle)] shrink-0">
          {mediaFilters.map((pill) => {
            const Icon = pill.icon
            const isActive = currentTab === pill.id
            return (
              <button
                key={pill.id}
                onClick={() => onTabChange(pill.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--color-brand-subtle)] text-[var(--color-accent)] font-semibold border border-[var(--color-accent)]/30'
                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] border border-transparent'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{pill.label}</span>
                {typeof pill.count === 'number' && pill.count > 0 && (
                  <span className="text-[9px] font-mono opacity-70">({pill.count})</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default BookmarkFilterBar
