import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Search,
  Plus,
  RefreshCw,
  CheckCircle,
  Pin,
  Archive,
  Settings,
  Folder,
  ExternalLink,
  BookOpen,
  ArrowRight
} from 'lucide-react'
import { LocalBookmark } from '../../db/db'
import { filterAndRankBookmarks } from '../../lib/searchCatalog'
import { useModalBackNavigation } from '../../lib/useModalBackNavigation'

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  bookmarks: LocalBookmark[]
  groups?: string[]
  onOpenAddModal: () => void
  onTriggerSync: () => void
  onSelectGroup: (group: string | null) => void
  onNavigateSettings?: () => void
  onOpenBookmark?: (bookmark: LocalBookmark) => void
  onOpenReader?: (bookmark: LocalBookmark) => void
}

interface CommandItem {
  id: string
  type: 'command'
  title: string
  subtitle?: string
  shortcut?: string
  icon: React.ReactNode
  action: () => void
}

interface BookmarkItem {
  id: string
  type: 'bookmark'
  bookmark: LocalBookmark
}

type PaletteItem = CommandItem | BookmarkItem

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  bookmarks,
  groups = [],
  onOpenAddModal,
  onTriggerSync,
  onSelectGroup,
  onNavigateSettings,
  onOpenBookmark,
  onOpenReader
}) => {
  useModalBackNavigation([
    {
      isOpen,
      close: onClose
    }
  ])

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-focus on open & reset state
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Build commands list
  const baseCommands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      {
        id: 'cmd-add',
        type: 'command',
        title: 'Add Bookmark',
        subtitle: 'Save a new URL or web snippet',
        shortcut: 'N',
        icon: <Plus className="w-4 h-4 text-[var(--color-accent)]" />,
        action: () => {
          onClose()
          onOpenAddModal()
        }
      },
      {
        id: 'cmd-sync',
        type: 'command',
        title: 'Trigger Sync',
        subtitle: 'Force bidirectional sync with Cloudflare D1',
        shortcut: 'Sync',
        icon: <RefreshCw className="w-4 h-4 text-emerald-500" />,
        action: () => {
          onClose()
          onTriggerSync()
        }
      },
      {
        id: 'cmd-unread',
        type: 'command',
        title: 'View Unread',
        subtitle: 'Filter bookmarks needing reading attention',
        icon: <CheckCircle className="w-4 h-4 text-sky-400" />,
        action: () => {
          onClose()
          onSelectGroup('__unread__')
        }
      },
      {
        id: 'cmd-pinned',
        type: 'command',
        title: 'View Pinned',
        subtitle: 'Jump to high-priority pinned bookmarks',
        icon: <Pin className="w-4 h-4 text-amber-400" />,
        action: () => {
          onClose()
          onSelectGroup('__pinned__')
        }
      },
      {
        id: 'cmd-archive',
        type: 'command',
        title: 'View Archive',
        subtitle: 'Access archived read bookmarks',
        icon: <Archive className="w-4 h-4 text-purple-400" />,
        action: () => {
          onClose()
          onSelectGroup('__archived__')
        }
      }
    ]

    if (onNavigateSettings) {
      list.push({
        id: 'cmd-settings',
        type: 'command',
        title: 'View Settings',
        subtitle: 'API tokens, agent credentials, and export options',
        shortcut: 'S',
        icon: <Settings className="w-4 h-4 text-slate-400" />,
        action: () => {
          onClose()
          onNavigateSettings()
        }
      })
    }

    // Add jump to group commands
    const uniqueGroups = Array.from(new Set(groups)).filter(Boolean)
    uniqueGroups.forEach((g) => {
      list.push({
        id: `cmd-group-${g}`,
        type: 'command',
        title: `Jump to Group: ${g}`,
        subtitle: `Filter bookmarks by ${g}`,
        icon: <Folder className="w-4 h-4 text-blue-400" />,
        action: () => {
          onClose()
          onSelectGroup(g === 'All' ? null : g)
        }
      })
    })

    return list
  }, [groups, onOpenAddModal, onTriggerSync, onSelectGroup, onNavigateSettings, onClose])

  // Filter commands by query
  const matchingCommands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return baseCommands
    return baseCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q))
    )
  }, [baseCommands, query])

  // Matched Bookmarks via filterAndRankBookmarks
  const matchedBookmarks = useMemo(() => {
    const q = query.trim()
    const results = filterAndRankBookmarks(bookmarks, q, undefined, 8)
    return results.map<BookmarkItem>((b) => ({
      id: `bm-${b.id}`,
      type: 'bookmark',
      bookmark: b
    }))
  }, [bookmarks, query])

  // Combined selectable items list
  const allItems = useMemo<PaletteItem[]>(() => {
    return [...matchingCommands, ...matchedBookmarks]
  }, [matchingCommands, matchedBookmarks])

  // Reset active index when items change
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [activeIndex])

  // Key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (allItems.length > 0) {
        setActiveIndex((prev) => (prev + 1) % allItems.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (allItems.length > 0) {
        setActiveIndex((prev) => (prev - 1 + allItems.length) % allItems.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = allItems[activeIndex]
      if (selected) {
        executeItem(selected)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const executeItem = (item: PaletteItem) => {
    if (item.type === 'command') {
      item.action()
    } else if (item.type === 'bookmark') {
      onClose()
      if (onOpenBookmark) {
        onOpenBookmark(item.bookmark)
      } else {
        window.open(item.bookmark.url, '_blank', 'noopener,noreferrer')
      }
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center p-3 pt-[10vh] sm:pt-[14vh] overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Universal Command Palette"
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="p-3 sm:p-4 border-b border-[var(--color-border-default)] flex items-center gap-3 bg-[var(--color-bg-surface)]">
          <Search className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search bookmarks..."
            className="w-full bg-transparent text-sm sm:text-base text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none"
            aria-label="Search commands and bookmarks"
          />
          <kbd className="hidden sm:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] border border-[var(--color-border-default)]">
            ESC
          </kbd>
        </div>

        {/* Scrollable Results List */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2 space-y-3"
          tabIndex={-1}
        >
          {allItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--color-text-muted)]">
              No matching commands or bookmarks found for "{query}".
            </div>
          ) : (
            <>
              {/* Section 1: Quick Commands */}
              {matchingCommands.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Quick Commands
                  </div>
                  {matchingCommands.map((cmd) => {
                    const itemIndex = allItems.findIndex((it) => it.id === cmd.id)
                    const isSelected = itemIndex === activeIndex

                    return (
                      <div
                        key={cmd.id}
                        data-index={itemIndex}
                        onClick={() => executeItem(cmd)}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        className={`px-3 py-2 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                            : 'hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)]'
                        }`}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-[var(--color-bg-element)] border border-[var(--color-border-default)] flex items-center justify-center shrink-0">
                            {cmd.icon}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm font-semibold block truncate">
                              {cmd.title}
                            </span>
                            {cmd.subtitle && (
                              <span className="text-[10px] text-[var(--color-text-muted)] block truncate">
                                {cmd.subtitle}
                              </span>
                            )}
                          </div>
                        </div>

                        {cmd.shortcut && (
                          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] border border-[var(--color-border-default)] shrink-0">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Section 2: Bookmarks */}
              {matchedBookmarks.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Bookmarks ({matchedBookmarks.length})
                  </div>
                  {matchedBookmarks.map((bmItem) => {
                    const itemIndex = allItems.findIndex((it) => it.id === bmItem.id)
                    const isSelected = itemIndex === activeIndex
                    const b = bmItem.bookmark

                    const domain = (() => {
                      try {
                        return new URL(b.url).hostname.replace(/^www\./, '')
                      } catch {
                        return b.url
                      }
                    })()

                    return (
                      <div
                        key={bmItem.id}
                        data-index={itemIndex}
                        onClick={() => executeItem(bmItem)}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        className={`px-3 py-2 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                            : 'hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)]'
                        }`}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {b.favicon ? (
                            <img
                              src={b.favicon}
                              alt=""
                              className="w-5 h-5 rounded shrink-0 object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="w-5 h-5 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] text-[10px] flex items-center justify-center shrink-0">
                              {b.title?.[0]?.toUpperCase() || 'B'}
                            </div>
                          )}

                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm font-medium text-[var(--color-text-primary)] block truncate">
                              {b.title || b.url}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                              <span className="truncate">{domain}</span>
                              <span className="px-1.5 py-0.2 rounded bg-[var(--color-bg-element)] text-[var(--color-text-muted)] border border-[var(--color-border-default)] shrink-0">
                                {b.group || 'Unsorted'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {onOpenReader && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onClose()
                                onOpenReader(b)
                              }}
                              className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors"
                              title="Read offline"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2 border-t border-[var(--color-border-default)] bg-[var(--color-bg-surface)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-[var(--color-bg-element)] px-1 py-0.5 rounded border border-[var(--color-border-default)] mr-1">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span>
              <kbd className="font-mono bg-[var(--color-bg-element)] px-1 py-0.5 rounded border border-[var(--color-border-default)] mr-1">
                ↵
              </kbd>
              Execute
            </span>
          </div>
          <span>Markbel Universal Palette</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
