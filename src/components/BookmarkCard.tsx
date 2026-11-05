import React from 'react'
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
  Globe,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import BookmarkImage from './BookmarkImage'
import { getPublicFaviconUrl, isSafeFaviconUrl } from '@/lib/urlSafety'
import { extractInstantMediaMetadata, isLowQualityImage, isVideoStreamUrl } from '@/lib/mediaHeuristics'
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
  isSelected = false,
  selectionMode = false,
  onToggleSelect,
  onDismissReminder,
  onSnoozeReminder,
}) => {
  const instant = extractInstantMediaMetadata(b.url)
  const isPolluted = isLowQualityImage(b.image) || isVideoStreamUrl(b.image)
  let effectiveImage = ''
  if (instant.image) {
    effectiveImage = (!isPolluted && b.image) ? b.image : instant.image
  } else if (!isPolluted && b.image) {
    effectiveImage = b.image
  }

  const hasHeroImage = Boolean(effectiveImage && !isLowQualityImage(effectiveImage) && !isVideoStreamUrl(effectiveImage))
  const domain = getDomain(b.url)
  const safeFavicon = isSafeFaviconUrl(b.favicon) ? b.favicon : undefined
  const faviconUrl = safeFavicon || getPublicFaviconUrl(b.url)

  // Media type pill metadata
  const typeBadge = (() => {
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
  })()

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
          {/* Multiselect Checkbox */}
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

          {/* Micro-thumbnail (when image present) or Favicon tile */}
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
            {b.isBroken && (
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <span className="text-[9px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                  Broken ({b.httpStatus || 404})
                </span>
                <button
                  type="button"
                  onClick={() => window.open(`https://web.archive.org/web/*/${b.url}`, '_blank', 'noopener,noreferrer')}
                  className="text-[9px] font-medium text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/20 transition-colors"
                  title="Open in Wayback Machine"
                >
                  Wayback
                </button>
              </div>
            )}
            {!b.isRead && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shrink-0" title="Unread" />
            )}
          </div>

          <h4 className="font-semibold text-xs sm:text-sm text-[var(--color-text-primary)] truncate flex-1 min-w-0 group-hover:text-[var(--color-accent)] transition-colors">
            {b.title}
          </h4>
        </div>

        {/* Right: Date & Progressive Action Toolbar */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] hidden md:inline mr-1">
            {new Date(b.createdAt).toLocaleDateString()}
          </span>

          <button
            onClick={() => onToggleRead(b)}
            className={`p-1.5 rounded-md transition-colors ${
              b.isRead
                ? 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]'
                : 'text-[var(--color-accent)] hover:bg-[var(--color-brand-subtle)]'
            }`}
            title={b.isRead ? 'Mark as unread' : 'Mark as read'}
          >
            {b.isRead ? <Check className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
          </button>

          {onOpenReader && (
            <button
              type="button"
              onClick={() => onOpenReader(b)}
              className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] rounded-md transition-colors"
              title="Read Offline"
              aria-label="Read Offline"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onTogglePin(b)}
            className={`p-1.5 rounded-md transition-colors ${
              b.isPinned
                ? 'text-amber-500 hover:bg-amber-500/10'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
            }`}
            title={b.isPinned ? 'Unpin' : 'Pin to top'}
          >
            <Pin className={`w-3.5 h-3.5 ${b.isPinned ? 'fill-amber-500' : ''}`} />
          </button>

          <button
            onClick={() => onArchive(b)}
            className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-md transition-colors"
            title="Archive"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onEdit(b)}
            className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-brand-subtle)] rounded-md transition-colors"
            title="Edit"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDelete(b)}
            className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-status-error)] hover:bg-red-500/10 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
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
        className={`studio-card studio-card-hover flex flex-col justify-between group cursor-pointer active:scale-[0.99] transition-all overflow-hidden ${
          b.isRead ? 'opacity-75 hover:opacity-100' : ''
        } ${isSelected ? 'ring-2 ring-[var(--color-accent)]' : ''}`}
      >
        <div>
          {/* 16:9 Image Thumbnail with Smooth Hover Zoom */}
          <div className="relative aspect-video w-full overflow-hidden bg-[var(--color-bg-muted)]">
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

              {/* Pin Indicator & Unread Dot */}
              <div className="flex items-center gap-1.5 pointer-events-auto">
                {!b.isRead && (
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_0_2px_rgba(0,0,0,0.6)]"
                    title="Unread"
                  />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onTogglePin(b)
                  }}
                  className={`p-1.5 rounded-md backdrop-blur-md transition-all active:scale-95 shadow-xs ${
                    b.isPinned
                      ? 'bg-amber-400 text-amber-950 hover:bg-amber-300'
                      : 'bg-black/60 text-white/80 hover:text-white hover:bg-black/80'
                  }`}
                  title={b.isPinned ? 'Unpin' : 'Pin to top'}
                >
                  <Pin className={`w-3.5 h-3.5 ${b.isPinned ? 'fill-amber-950' : ''}`} />
                </button>
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
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleRead(b)
                }}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors border ${
                  b.isRead
                    ? 'bg-transparent border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]'
                    : 'bg-[var(--color-brand-subtle)] border-transparent text-[var(--color-accent)] hover:opacity-90'
                }`}
              >
                {b.isRead ? 'Read' : 'Mark Read'}
              </button>
            </div>

            <h4 className="font-semibold text-xs sm:text-sm text-[var(--color-text-primary)] leading-snug line-clamp-2 group-hover:text-[var(--color-accent)] transition-colors">
              {b.title}
            </h4>
            {b.description && (
              <p className="text-[11px] sm:text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
                {b.description}
              </p>
            )}

            {/* Link Rot / Broken Link Warning Badge */}
            {b.isBroken && (
              <div className="pt-1 flex items-center justify-between gap-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Link Rot ({b.httpStatus || 404})
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => window.open(`https://web.archive.org/web/*/${b.url}`, '_blank', 'noopener,noreferrer')}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 font-semibold transition-colors"
                    title="Open in Wayback Machine"
                  >
                    Wayback
                  </button>
                  {onOpenReader && (
                    <button
                      type="button"
                      onClick={() => onOpenReader(b)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-brand-subtle)] hover:opacity-90 text-[var(--color-accent)] border border-[var(--color-accent)]/20 font-semibold transition-colors"
                      title="Read Saved Content"
                    >
                      Read
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Reminder Badge */}
            {b.remindAt && (
              <div className="pt-1 flex items-center justify-between gap-1.5 text-xs text-amber-600 font-medium">
                <div className="flex items-center gap-1.5 truncate">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    Remind: {new Date(b.remindAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onSnoozeReminder?.(b)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-semibold transition-colors"
                    title="Snooze 1 day"
                  >
                    +1d
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissReminder?.(b)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-muted)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] font-semibold transition-colors"
                    title="Dismiss reminder"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card Footer Progressive Action Toolbar */}
        <div className="px-3 sm:px-3.5 py-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between bg-[var(--color-bg-surface)] gap-1">
          <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] hidden sm:inline">
            {new Date(b.createdAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto justify-around sm:justify-end">
            {onOpenReader && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenReader(b)
                }}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-brand-subtle)] rounded-md p-1.5 transition-colors active:scale-95"
                title="Read Offline"
                aria-label="Read Offline"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onArchive(b)
              }}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-md p-1.5 transition-colors active:scale-95"
              title="Archive"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(b)
              }}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-brand-subtle)] rounded-md p-1.5 transition-colors active:scale-95"
              title="Edit"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(b)
              }}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-status-error)] hover:bg-red-500/10 rounded-md p-1.5 transition-colors active:scale-95"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. EDITORIAL TYPOGRAPHY CARD (When NO Cover Image is Present)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div
      onClick={() => onClick(b.url)}
      className={`studio-card studio-card-hover p-4 sm:p-4.5 flex flex-col justify-between group cursor-pointer active:scale-[0.99] transition-all min-h-[220px] ${
        b.isRead ? 'opacity-75 hover:opacity-100' : ''
      } ${isSelected ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-brand-subtle)]' : ''}`}
    >
      <div>
        {/* Top Header: Favicon, Domain Chip, Category, Pin & Checkbox */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--color-border-subtle)]/70">
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
            <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-bg-muted)] px-2 py-0.5 rounded-full border border-[var(--color-border-subtle)] truncate max-w-[90px]">
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
            <button
              onClick={() => onTogglePin(b)}
              className={`p-1 rounded-md transition-colors ${
                b.isPinned
                  ? 'text-amber-500 hover:bg-amber-500/10'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
              }`}
              title={b.isPinned ? 'Unpin' : 'Pin to top'}
            >
              <Pin className={`w-3.5 h-3.5 ${b.isPinned ? 'fill-amber-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Editorial Headline & Excerpt */}
        <div className="pt-2.5 space-y-1.5">
          <h4 className="font-semibold text-[15px] sm:text-[15.5px] leading-[1.35] text-[var(--color-text-primary)] line-clamp-3 group-hover:text-[var(--color-accent)] transition-colors">
            {b.title}
          </h4>

          {b.description ? (
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">
              {b.description}
            </p>
          ) : (
            <p className="text-xs italic text-[var(--color-text-tertiary)] line-clamp-2">
              No description provided. Click to open destination or read offline.
            </p>
          )}

          {/* Link Rot / Broken Link Warning Badge */}
          {b.isBroken && (
            <div className="pt-2 flex items-center justify-between gap-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Link Rot ({b.httpStatus || 404})
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => window.open(`https://web.archive.org/web/*/${b.url}`, '_blank', 'noopener,noreferrer')}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 font-semibold transition-colors"
                  title="Open in Wayback Machine"
                >
                  Wayback
                </button>
                {onOpenReader && (
                  <button
                    type="button"
                    onClick={() => onOpenReader(b)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-brand-subtle)] hover:opacity-90 text-[var(--color-accent)] border border-[var(--color-accent)]/20 font-semibold transition-colors"
                    title="Read Saved Content"
                  >
                    Read
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Reminder Badge */}
          {b.remindAt && (
            <div className="pt-2 flex items-center justify-between gap-1.5 text-xs text-amber-600 font-medium">
              <div className="flex items-center gap-1.5 truncate">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  Remind: {new Date(b.remindAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onSnoozeReminder?.(b)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-semibold transition-colors"
                  title="Snooze 1 day"
                >
                  +1d
                </button>
                <button
                  type="button"
                  onClick={() => onDismissReminder?.(b)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-muted)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] font-semibold transition-colors"
                  title="Dismiss reminder"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editorial Footer Strip */}
      <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
          {new Date(b.createdAt).toLocaleDateString()}
        </span>

        {/* Progressive Disclosure Action Toolbar */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleRead(b)}
            className={`p-1.5 rounded-md transition-colors ${
              b.isRead
                ? 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]'
                : 'text-[var(--color-accent)] hover:bg-[var(--color-brand-subtle)]'
            }`}
            title={b.isRead ? 'Mark as unread' : 'Mark as read'}
          >
            {b.isRead ? <Check className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
          </button>

          {onOpenReader && (
            <button
              type="button"
              onClick={() => onOpenReader(b)}
              className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-brand-subtle)] rounded-md transition-colors"
              title="Read Offline"
              aria-label="Read Offline"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onArchive(b)}
            className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-md transition-colors"
            title="Archive"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onEdit(b)}
            className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-brand-subtle)] rounded-md transition-colors"
            title="Edit"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDelete(b)}
            className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-status-error)] hover:bg-red-500/10 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
})
