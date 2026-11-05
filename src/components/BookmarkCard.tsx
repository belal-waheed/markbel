import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Clock,
  Archive,
  Edit,
  Trash2,
  Pin,
  CheckCircle,
  Check,
  ListVideo,
  BookOpen,
  Code2,
  Share2,
  ExternalLink,
  AlertTriangle,
  Tv,
  FastForward,
  RotateCcw,
  MoreHorizontal,
} from 'lucide-react'
import BookmarkImage from './BookmarkImage'
import { getPublicFaviconUrl, isSafeFaviconUrl } from '@/lib/urlSafety'
import { extractInstantMediaMetadata, isLowQualityImage, isVideoStreamUrl } from '@/lib/mediaHeuristics'
import { parseSeriesProgression, formatEpisodicBadge } from '../lib/seriesProgression'
import { LocalBookmark } from '../db/db'
import { ViewMode } from './BookmarkFilterBar'

interface BookmarkCardProps {
  bookmark: LocalBookmark
  viewMode?: ViewMode
  onClick: (url: string) => void
  onTogglePin: (b: LocalBookmark) => void
  onToggleRead: (b: LocalBookmark) => void
  onArchive: (b: LocalBookmark) => void
  onEdit: (b: LocalBookmark) => void
  onDelete: (b: LocalBookmark) => void
  onOpenReader?: (b: LocalBookmark) => void
  onAdvanceSeries?: (b: LocalBookmark) => void
  onRollbackSeries?: (b: LocalBookmark) => void
  isSelected?: boolean
  selectionMode?: boolean
  onToggleSelect?: (b: LocalBookmark, multi: boolean) => void
  onDismissReminder?: (b: LocalBookmark) => void
  onSnoozeReminder?: (b: LocalBookmark) => void
}

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export const BookmarkCard: React.FC<BookmarkCardProps> = React.memo(({
  bookmark: b,
  viewMode = 'grid',
  onClick,
  onTogglePin,
  onToggleRead,
  onArchive,
  onEdit,
  onDelete,
  onOpenReader,
  onAdvanceSeries,
  onRollbackSeries,
  isSelected = false,
  selectionMode = false,
  onToggleSelect,
  onDismissReminder,
  onSnoozeReminder,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const [menuCoords, setMenuCoords] = useState<{ top: number; right: number } | null>(null)

  const seriesInfo = useMemo(() => {
    if (b.seriesEpisode) {
      return {
        seriesKey: b.seriesKey || '',
        seriesTitle: b.title,
        episode: b.seriesEpisode,
        season: b.seriesSeason,
        sourceType: (b.contentType === 'article' ? 'manga' : 'generic') as any,
        nextEpisodeUrl: parseSeriesProgression(b.url, b.title)?.nextEpisodeUrl,
      }
    }
    return parseSeriesProgression(b.url, b.title)
  }, [b.url, b.title, b.seriesEpisode, b.seriesSeason, b.seriesKey, b.contentType])

  const instant = useMemo(() => extractInstantMediaMetadata(b.url), [b.url])

  const effectiveImage = useMemo(() => {
    const isPolluted = isLowQualityImage(b.image) || isVideoStreamUrl(b.image)
    if (instant.image) {
      return (!isPolluted && b.image) ? b.image : instant.image
    } else if (!isPolluted && b.image) {
      return b.image
    }
    return ''
  }, [b.image, instant.image])

  const hasHeroImage = useMemo(
    () => Boolean(effectiveImage && !isLowQualityImage(effectiveImage) && !isVideoStreamUrl(effectiveImage)),
    [effectiveImage]
  )

  const domain = useMemo(() => getDomain(b.url), [b.url])

  const faviconUrl = useMemo(() => {
    const safeFavicon = isSafeFaviconUrl(b.favicon) ? b.favicon : undefined
    return safeFavicon || getPublicFaviconUrl(b.url)
  }, [b.favicon, b.url])

  // Media type pill metadata
  const typeBadge = useMemo(() => {
    if (b.contentType === 'playlist') {
      return { label: 'Playlist', icon: ListVideo, color: 'text-rose-400 bg-rose-500/20 border-rose-500/30' }
    }
    if (b.contentType === 'video' || b.url.includes('youtube.com') || b.url.includes('youtu.be')) {
      return { label: 'Video', icon: ListVideo, color: 'text-red-400 bg-red-500/20 border-red-500/30' }
    }
    if (b.url.includes('github.com')) {
      return { label: 'Code', icon: Code2, color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' }
    }
    if (b.url.includes('x.com') || b.url.includes('twitter.com') || b.url.includes('instagram.com')) {
      return { label: 'Social', icon: Share2, color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' }
    }
    if (b.contentType === 'article') {
      return { label: 'Article', icon: BookOpen, color: 'text-blue-400 bg-blue-500/20 border-blue-500/30' }
    }
    return null
  }, [b.contentType, b.url])

  // Toggle Action Sheet Menu
  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isMenuOpen && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const opensUpward = spaceBelow < 280
      setMenuCoords({
        top: opensUpward ? rect.top - 6 : rect.bottom + 6,
        right: Math.max(12, window.innerWidth - rect.right),
      })
      setIsMenuOpen(true)
    } else {
      setIsMenuOpen(false)
    }
  }, [isMenuOpen])

  // Close Menu on Click Outside / Scroll / Escape
  useEffect(() => {
    if (!isMenuOpen) return

    const handlePointerDown = () => setIsMenuOpen(false)
    const handleScroll = () => setIsMenuOpen(false)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  // Shared Action Sheet / Dropdown Menu Items
  const menuContent = useMemo(() => (
    <div className="space-y-0.5 text-xs">
      {/* Open Destination */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsMenuOpen(false)
          onClick(b.url)
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors cursor-pointer text-left"
      >
        <ExternalLink className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
        <span>Open in New Tab</span>
      </button>

      {/* Read Offline */}
      {onOpenReader && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsMenuOpen(false)
            onOpenReader(b)
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors cursor-pointer text-left"
          aria-label="Read Offline"
        >
          <BookOpen className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
          <span>Read Offline</span>
        </button>
      )}

      {/* Toggle Read */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsMenuOpen(false)
          onToggleRead(b)
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors cursor-pointer text-left"
      >
        {b.isRead ? (
          <>
            <CheckCircle className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
            <span>Mark as Unread</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
            <span>Mark as Read</span>
          </>
        )}
      </button>

      {/* Toggle Pin */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsMenuOpen(false)
          onTogglePin(b)
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors cursor-pointer text-left"
      >
        <Pin className={`w-4 h-4 shrink-0 ${b.isPinned ? 'fill-amber-500 text-amber-500' : 'text-[var(--color-text-tertiary)]'}`} />
        <span>{b.isPinned ? 'Unpin Bookmark' : 'Pin to Top'}</span>
      </button>

      {/* Series Next / Rollback */}
      {seriesInfo && onAdvanceSeries && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsMenuOpen(false)
            onAdvanceSeries(b)
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 font-semibold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer text-left"
        >
          <FastForward className="w-4 h-4 shrink-0" />
          <span>Advance Series (+1)</span>
        </button>
      )}

      {b.seriesHistory && b.seriesHistory.length > 0 && onRollbackSeries && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsMenuOpen(false)
            onRollbackSeries(b)
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 font-medium text-zinc-400 hover:bg-zinc-500/10 rounded-lg transition-colors cursor-pointer text-left"
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span>Rollback Series ({b.seriesHistory.length} in history)</span>
        </button>
      )}

      {/* Reminder Controls */}
      {b.remindAt && onSnoozeReminder && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsMenuOpen(false)
            onSnoozeReminder(b)
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 font-medium text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer text-left"
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>Snooze Reminder (+1d)</span>
        </button>
      )}

      {b.remindAt && onDismissReminder && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsMenuOpen(false)
            onDismissReminder(b)
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors cursor-pointer text-left"
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>Dismiss Reminder</span>
        </button>
      )}

      {/* Wayback Machine */}
      {b.isBroken && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsMenuOpen(false)
            window.open(`https://web.archive.org/web/*/${b.url}`, '_blank', 'noopener,noreferrer')
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 font-medium text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer text-left"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>View on Wayback Machine</span>
        </button>
      )}

      <div className="my-1 border-t border-[var(--color-border-subtle)]" />

      {/* Edit Bookmark */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsMenuOpen(false)
          onEdit(b)
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors cursor-pointer text-left"
      >
        <Edit className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
        <span>Edit Bookmark</span>
      </button>

      {/* Archive Bookmark */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsMenuOpen(false)
          onArchive(b)
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors cursor-pointer text-left"
      >
        <Archive className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
        <span>Archive Bookmark</span>
      </button>

      {/* Delete Bookmark */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsMenuOpen(false)
          onDelete(b)
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 font-medium text-[var(--color-status-error)] hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer text-left"
      >
        <Trash2 className="w-4 h-4 shrink-0" />
        <span>Delete Bookmark</span>
      </button>
    </div>
  ), [b, seriesInfo, onOpenReader, onToggleRead, onTogglePin, onAdvanceSeries, onRollbackSeries, onSnoozeReminder, onDismissReminder, onEdit, onArchive, onDelete, onClick])

  // Action Sheet Portal for Mobile & Anchored Popover for Desktop
  const actionSheetPortal = useMemo(() => {
    if (typeof document === 'undefined' || !isMenuOpen) return null

    const opensUpward = menuCoords ? (window.innerHeight - menuCoords.top < 280) : false

    return createPortal(
      <div
        className="fixed inset-0 z-50 pointer-events-auto"
        onClick={(e) => {
          e.stopPropagation()
          setIsMenuOpen(false)
        }}
      >
        {/* Mobile Native Bottom Action Sheet */}
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs sm:hidden animate-in fade-in duration-150 flex flex-col justify-end">
          <div
            className="bg-[var(--color-bg-surface)] border-t border-[var(--color-border-default)] rounded-t-2xl p-4 pb-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-2 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--color-border-strong)] rounded-full mx-auto mb-2" />
            <div className="flex items-center gap-2.5 px-2 pb-2.5 mb-1 border-b border-[var(--color-border-subtle)]">
              <img
                src={faviconUrl}
                alt=""
                className="w-4 h-4 object-contain shrink-0"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = 'none'
                }}
              />
              <div className="min-w-0 flex-1">
                <h5 className="text-xs font-bold text-[var(--color-text-primary)] truncate">{b.title}</h5>
                <span className="text-[10px] font-mono text-[var(--color-text-secondary)] truncate block">{domain}</span>
              </div>
            </div>
            {menuContent}
          </div>
        </div>

        {/* Desktop Anchored Popover Menu */}
        <div
          className="hidden sm:block fixed z-50 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl shadow-xl p-1.5 min-w-[210px] animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: menuCoords ? `${menuCoords.top}px` : undefined,
            right: menuCoords ? `${menuCoords.right}px` : undefined,
            transform: opensUpward ? 'translateY(-100%)' : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {menuContent}
        </div>
      </div>,
      document.body
    )
  }, [isMenuOpen, menuCoords, faviconUrl, b.title, domain, menuContent])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. COMPACT LIST ROW VIEW
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onClick(b.url)}
        className={`studio-card studio-card-hover p-2 sm:px-3 sm:py-2.5 flex items-center justify-between gap-3 group cursor-pointer active:scale-[0.99] transition-all min-h-[48px] ${
          b.isRead ? 'opacity-70 hover:opacity-100' : ''
        } ${isSelected ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-brand-subtle)]' : ''}`}
      >
        {/* Left: Checkbox & Micro-Thumbnail / Favicon */}
        <div className="flex items-center gap-2.5 shrink-0">
          {(selectionMode || isSelected) ? (
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center border transition-all cursor-pointer z-10 shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                if (onToggleSelect) onToggleSelect(b, e.shiftKey)
              }}
            >
              <div
                className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                  isSelected
                    ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-bg-surface)] border-[var(--color-border-strong)] text-transparent hover:border-[var(--color-accent)]'
                }`}
              >
                <Check className="w-3 h-3" />
              </div>
            </div>
          ) : (
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                if (onToggleSelect) onToggleSelect(b, e.shiftKey)
              }}
            >
              <div className="w-4 h-4 rounded flex items-center justify-center border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] text-transparent hover:border-[var(--color-accent)]">
                <Check className="w-3 h-3" />
              </div>
            </div>
          )}

          {/* Micro-thumbnail or Favicon tile */}
          {hasHeroImage ? (
            <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-lg overflow-hidden relative border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]">
              <BookmarkImage
                src={effectiveImage}
                fallbackSrc={faviconUrl}
                alt={b.title}
                aspectRatioClass="aspect-square w-full h-full"
              />
              {b.isPinned && (
                <div className="absolute top-0.5 left-0.5 bg-amber-400 text-amber-950 p-0.5 rounded shadow-xs z-10">
                  <Pin className="w-2 h-2 fill-amber-950" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-lg flex items-center justify-center border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] relative">
              <img
                src={faviconUrl}
                alt=""
                className="w-4 h-4 object-contain"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = 'none'
                }}
              />
              {b.isPinned && (
                <div className="absolute -top-1 -left-1 bg-amber-400 text-amber-950 p-0.5 rounded-full shadow-xs z-10">
                  <Pin className="w-2 h-2 fill-amber-950" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center: Metadata Chips & Title */}
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <span className="text-[10px] font-mono font-medium text-[var(--color-text-secondary)] truncate max-w-[110px]">
              {domain}
            </span>
            <span className="text-[9px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-bg-muted)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] truncate max-w-[90px]">
              {b.group || 'Unsorted'}
            </span>
            {b.readingTime ? (
              <span className="text-[9px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-bg-muted)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] flex items-center gap-0.5 shrink-0 font-mono">
                <Clock className="w-2.5 h-2.5" />
                {b.readingTime}m
              </span>
            ) : null}
            {typeBadge && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border flex items-center gap-1 shrink-0 ${typeBadge.color}`}>
                <typeBadge.icon className="w-2.5 h-2.5" />
                {typeBadge.label}
              </span>
            )}
            {seriesInfo && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 flex items-center gap-1 shrink-0">
                <Tv className="w-2.5 h-2.5" />
                {formatEpisodicBadge(seriesInfo)}
              </span>
            )}
            {!b.isRead && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shrink-0" title="Unread" />
            )}
          </div>

          <h4 className="font-semibold text-xs sm:text-sm text-[var(--color-text-primary)] truncate flex-1 min-w-0 group-hover:text-[var(--color-accent)] transition-colors">
            {b.title}
          </h4>
        </div>

        {/* Right: Date, Fast-Forward Series & Clean 3-Dots Action Button */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] hidden md:inline mr-1">
            {new Date(b.createdAt).toLocaleDateString()}
          </span>

          {seriesInfo && onAdvanceSeries && (
            <button
              type="button"
              onClick={() => onAdvanceSeries(b)}
              className="px-2 py-1 rounded text-[10px] font-bold text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 flex items-center gap-1 transition-all active:scale-95"
              title="Advance to next episode (+1)"
            >
              <FastForward className="w-3 h-3" />
              <span className="hidden sm:inline">+1</span>
            </button>
          )}

          {/* Clean 3-Dots Action Sheet Button */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={toggleMenu}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] active:scale-95 transition-all cursor-pointer"
            title="More actions"
            aria-label={`More actions for ${b.title}`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {actionSheetPortal}
      </div>
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. HERO MEDIA CARD (When High-Res Hero Image is Present)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (hasHeroImage) {
    return (
      <div
        onClick={() => onClick(b.url)}
        className={`studio-card studio-card-hover flex flex-col justify-between group cursor-pointer active:scale-[0.99] transition-all rounded-xl relative ${
          b.isRead ? 'opacity-75 hover:opacity-100' : ''
        } ${isSelected ? 'ring-2 ring-[var(--color-accent)]' : ''}`}
      >
        <div>
          {/* 16:9 Image Thumbnail with Smooth Hover Zoom */}
          <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-[var(--color-bg-muted)]">
            <div className="w-full h-full transition-transform duration-300 ease-out group-hover:scale-[1.03]">
              <BookmarkImage
                src={effectiveImage}
                fallbackSrc={faviconUrl}
                alt={b.title}
                aspectRatioClass="aspect-video w-full h-full"
              />
            </div>

            {/* Subtle Gradient Scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

            {/* Multiselect Checkbox Overlay */}
            {(selectionMode || isSelected) ? (
              <div
                className="absolute top-2.5 left-2.5 z-20 cursor-pointer pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onToggleSelect) onToggleSelect(b, e.shiftKey)
                }}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border shadow-sm transition-all ${
                    isSelected
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white scale-105'
                      : 'bg-black/50 border-white/60 backdrop-blur-md text-transparent hover:bg-black/70'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </div>
              </div>
            ) : (
              <div
                className="absolute top-2.5 left-2.5 z-20 cursor-pointer pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onToggleSelect) onToggleSelect(b, e.shiftKey)
                }}
              >
                <div className="w-5 h-5 rounded-md flex items-center justify-center border border-white/60 bg-black/50 backdrop-blur-md text-transparent hover:bg-black/70 shadow-sm">
                  <Check className="w-3.5 h-3.5" />
                </div>
              </div>
            )}

            {/* Top Overlay Badges */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
              <div className={`flex items-center gap-1.5 transition-all ${selectionMode || isSelected ? 'ml-7' : 'group-hover:ml-7'}`}>
                {typeBadge ? (
                  <span className="text-[10px] font-semibold text-white bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md shadow-xs border border-white/10 flex items-center gap-1">
                    <typeBadge.icon className="w-3 h-3 text-[var(--color-accent)]" />
                    {typeBadge.label}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-white bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md shadow-xs border border-white/10 truncate max-w-[110px]">
                    {b.group || 'Unsorted'}
                  </span>
                )}
                {b.readingTime ? (
                  <span className="text-[10px] font-mono text-white/90 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded-md shadow-xs border border-white/10 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[var(--color-accent)]" />
                    {b.readingTime}m
                  </span>
                ) : null}
              </div>

              {/* Pin Indicator & Unread Cyan Dot */}
              <div className="flex items-center gap-1.5 pointer-events-auto">
                {!b.isRead && (
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_0_2px_rgba(0,0,0,0.6)]"
                    title="Unread"
                  />
                )}
                {b.isPinned && (
                  <div
                    className="p-1.5 rounded-md backdrop-blur-md bg-amber-400 text-amber-950 shadow-xs"
                    title="Pinned"
                  >
                    <Pin className="w-3.5 h-3.5 fill-amber-950" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card Body Details */}
          <div className="p-3 sm:p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-1 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <img
                  src={faviconUrl}
                  alt=""
                  className="w-3.5 h-3.5 object-contain shrink-0"
                  onError={(e) => {
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
                <span className="font-mono text-[10px] text-[var(--color-text-secondary)] truncate">
                  {domain}
                </span>
                <span className="text-[9px] text-[var(--color-text-tertiary)] bg-[var(--color-bg-muted)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] truncate max-w-[80px]">
                  {b.group || 'Unsorted'}
                </span>
              </div>

              {/* Series Compact Pill with direct +1 Advance button */}
              {seriesInfo && (
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1">
                    <Tv className="w-3 h-3" />
                    {formatEpisodicBadge(seriesInfo)}
                  </span>
                  {onAdvanceSeries && (
                    <button
                      type="button"
                      onClick={() => onAdvanceSeries(b)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-0.5 transition-all active:scale-95"
                      title="Advance to next episode (+1)"
                    >
                      <FastForward className="w-3 h-3" />
                      <span>+1</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <h4 className="font-semibold text-xs sm:text-sm text-[var(--color-text-primary)] leading-snug line-clamp-2 group-hover:text-[var(--color-accent)] transition-colors">
              {b.title}
            </h4>
            {b.description && (
              <p className="text-[11px] sm:text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
                {b.description}
              </p>
            )}

            {/* Link Rot Indicator */}
            {b.isBroken && (
              <div className="pt-0.5 flex items-center gap-1.5 text-xs">
                <span className="text-[10px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Link Rot ({b.httpStatus || 404})
                </span>
              </div>
            )}

            {/* Reminder Badge */}
            {b.remindAt && (
              <div className="pt-0.5 flex items-center gap-1.5 text-[11px] text-amber-600 font-medium">
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  Remind: {new Date(b.remindAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Clean Editorial Footer with Date & 3-Dots Action Button */}
        <div className="px-3 sm:px-3.5 py-1.5 border-t border-[var(--color-border-subtle)] flex items-center justify-between bg-[var(--color-bg-surface)] rounded-b-xl gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
              {new Date(b.createdAt).toLocaleDateString()}
            </span>
            {!b.isRead && (
              <span className="text-[9px] font-semibold text-[var(--color-accent)] bg-[var(--color-brand-subtle)] px-1.5 py-0.2 rounded border border-[var(--color-accent)]/20">
                Unread
              </span>
            )}
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={toggleMenu}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] active:scale-95 transition-all cursor-pointer"
              title="More actions"
              aria-label={`More actions for ${b.title}`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {actionSheetPortal}
      </div>
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. EDITORIAL TYPOGRAPHY CARD (When NO Cover Image is Present)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div
      onClick={() => onClick(b.url)}
      className={`studio-card studio-card-hover p-3.5 sm:p-4 flex flex-col justify-between group cursor-pointer active:scale-[0.99] transition-all rounded-xl relative min-h-[170px] ${
        b.isRead ? 'opacity-75 hover:opacity-100' : ''
      } ${isSelected ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-brand-subtle)]' : ''}`}
    >
      <div>
        {/* Top Header: Favicon, Domain Chip, Category, Pin & Checkbox */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-border-subtle)]/70">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Multiselect Checkbox */}
            {(selectionMode || isSelected) ? (
              <div
                className="w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer z-10 shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onToggleSelect) onToggleSelect(b, e.shiftKey)
                }}
              >
                <div
                  className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] text-transparent'
                  }`}
                >
                  <Check className="w-2.5 h-2.5" />
                </div>
              </div>
            ) : (
              <div
                className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onToggleSelect) onToggleSelect(b, e.shiftKey)
                }}
              >
                <div className="w-3.5 h-3.5 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] text-transparent hover:border-[var(--color-accent)] flex items-center justify-center">
                  <Check className="w-2.5 h-2.5" />
                </div>
              </div>
            )}

            <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center overflow-hidden">
              <img
                src={faviconUrl}
                alt=""
                className="w-3.5 h-3.5 object-contain"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = 'none'
                }}
              />
            </div>
            <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] truncate max-w-[120px]">
              {domain}
            </span>
            <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-bg-muted)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] truncate max-w-[90px]">
              {b.group || 'Unsorted'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {b.readingTime ? (
              <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] flex items-center gap-1">
                <Clock className="w-3 h-3 text-[var(--color-accent)]" />
                {b.readingTime}m
              </span>
            ) : null}
            {!b.isRead && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" title="Unread" />
            )}
            {b.isPinned && (
              <div className="p-1 text-amber-500" title="Pinned">
                <Pin className="w-3.5 h-3.5 fill-amber-500" />
              </div>
            )}
          </div>
        </div>

        {/* Editorial Headline & Excerpt */}
        <div className="pt-2 space-y-1.5">
          <h4 className="font-semibold text-[14px] sm:text-[15px] leading-snug text-[var(--color-text-primary)] line-clamp-3 group-hover:text-[var(--color-accent)] transition-colors">
            {b.title}
          </h4>

          {b.description ? (
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
              {b.description}
            </p>
          ) : (
            <p className="text-xs italic text-[var(--color-text-tertiary)] line-clamp-1">
              No description provided.
            </p>
          )}

          {/* Series Compact Pill with direct +1 Advance button */}
          {seriesInfo && (
            <div className="pt-1 flex items-center gap-1 text-xs" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1">
                <Tv className="w-3 h-3" />
                {formatEpisodicBadge(seriesInfo)}
              </span>
              {onAdvanceSeries && (
                <button
                  type="button"
                  onClick={() => onAdvanceSeries(b)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-0.5 transition-all active:scale-95"
                  title="Advance to next episode (+1)"
                >
                  <FastForward className="w-3 h-3" />
                  <span>+1</span>
                </button>
              )}
            </div>
          )}

          {/* Link Rot Warning Badge */}
          {b.isBroken && (
            <div className="pt-1 flex items-center gap-1.5 text-xs">
              <span className="text-[10px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Link Rot ({b.httpStatus || 404})
              </span>
            </div>
          )}

          {/* Reminder Badge */}
          {b.remindAt && (
            <div className="pt-1 flex items-center gap-1.5 text-[11px] text-amber-600 font-medium">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">
                Remind: {new Date(b.remindAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Clean Editorial Footer Strip with Date & 3-Dots Action Button */}
      <div className="pt-2 mt-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
            {new Date(b.createdAt).toLocaleDateString()}
          </span>
          {!b.isRead && (
            <span className="text-[9px] font-semibold text-[var(--color-accent)] bg-[var(--color-brand-subtle)] px-1.5 py-0.2 rounded border border-[var(--color-accent)]/20">
              Unread
            </span>
          )}
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={toggleMenu}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] active:scale-95 transition-all cursor-pointer"
            title="More actions"
            aria-label={`More actions for ${b.title}`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionSheetPortal}
    </div>
  )
})
