import React from 'react'
import { Clock, Archive, Edit, Trash2, Pin, CheckCircle, Check } from 'lucide-react'
import BookmarkImage from './BookmarkImage'
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
}

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace('www.', '')
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
  onDelete
}) => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COMPACT LIST ROW VIEW
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onClick(b.url)}
        className={`studio-card studio-card-hover p-2.5 sm:p-3 flex items-center justify-between gap-3 group cursor-pointer active:scale-[0.99] transition-all ${
          b.isRead ? "opacity-70 hover:opacity-100" : ""
        }`}
      >
        {/* Left: Compact Square Thumbnail */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg overflow-hidden relative border border-[var(--color-border-default)] bg-[var(--color-bg-element)]">
          <BookmarkImage src={b.image || ''} alt={b.title} aspectRatioClass="aspect-square w-full h-full" />
          {b.isPinned && (
            <div className="absolute top-1 left-1 bg-amber-400 text-amber-950 p-0.5 rounded shadow-xs">
              <Pin className="w-2.5 h-2.5 fill-amber-950" />
            </div>
          )}
        </div>

        {/* Center: Metadata & Text */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-[var(--color-accent)] truncate max-w-[120px]">
              {getDomain(b.url)}
            </span>
            <span className="text-[9px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-element)] px-1.5 py-0.2 rounded border border-[var(--color-border-default)] truncate max-w-[100px]">
              {b.group || "Unsorted"}
            </span>
            {!b.isRead && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" title="Unread" />
            )}
          </div>

          <h4 className="font-semibold text-xs sm:text-sm text-[var(--color-text-primary)] leading-snug line-clamp-1">
            {b.title}
          </h4>

          {b.description ? (
            <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-1">
              {b.description}
            </p>
          ) : b.remindAt ? (
            <div className="flex items-center gap-1 text-[10px] text-amber-600 font-medium">
              <Clock className="w-3 h-3" />
              <span>Remind: {new Date(b.remindAt).toLocaleDateString()}</span>
            </div>
          ) : null}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleRead(b)}
            className={`p-1.5 rounded transition-colors ${
              b.isRead
                ? "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"
                : "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
            }`}
            title={b.isRead ? "Mark as unread" : "Mark as read"}
          >
            {b.isRead ? <Check className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => onTogglePin(b)}
            className={`p-1.5 rounded transition-colors ${
              b.isPinned
                ? "text-amber-500 hover:bg-amber-50"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
            }`}
            title={b.isPinned ? "Unpin" : "Pin to top"}
          >
            <Pin className={`w-3.5 h-3.5 ${b.isPinned ? "fill-amber-500" : ""}`} />
          </button>

          <button
            onClick={() => onArchive(b)}
            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded transition-colors"
            title="Archive"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onEdit(b)}
            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-blue-50 rounded transition-colors"
            title="Edit"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDelete(b)}
            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-status-error)] hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CARD GRID VIEW
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div
      onClick={() => onClick(b.url)}
      className={`studio-card studio-card-hover flex flex-col justify-between group cursor-pointer active:scale-[0.98] transition-all overflow-hidden ${
        b.isRead ? "opacity-70 hover:opacity-100" : ""
      }`}
    >
      <div>
        {/* Image Thumbnail with Overlay Actions */}
        <div className="relative">
          <BookmarkImage src={b.image || ''} alt={b.title} aspectRatioClass="aspect-video" />

          {/* Top Badges & Pin Button */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
            <span className="text-[10px] font-semibold text-white bg-black/75 backdrop-blur-md px-2 py-0.5 rounded shadow-xs truncate max-w-[120px] pointer-events-auto">
              {b.group || "Unsorted"}
            </span>
            <div className="flex items-center gap-1.5 pointer-events-auto">
              {!b.isRead && (
                <span
                  className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_0_2px_rgba(255,255,255,0.9)]"
                  title="Unread"
                />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(b);
                }}
                className={`p-1.5 rounded backdrop-blur-md transition-all active:scale-95 shadow-xs ${
                  b.isPinned
                    ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
                    : "bg-black/60 text-white/80 hover:text-white hover:bg-black/80"
                }`}
                title={b.isPinned ? "Unpin" : "Pin to top"}
              >
                <Pin className={`w-3.5 h-3.5 ${b.isPinned ? "fill-amber-950" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Content details */}
        <div className="p-2.5 sm:p-3.5 space-y-1.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-medium text-[var(--color-text-muted)] truncate">
              {getDomain(b.url)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleRead(b);
              }}
              className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors border ${
                b.isRead
                  ? "bg-transparent border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"
                  : "bg-[var(--color-accent)]/10 border-transparent text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
              }`}
            >
              {b.isRead ? "Read ✓" : "Mark Read"}
            </button>
          </div>

          <h4 className="font-semibold text-xs sm:text-sm text-[var(--color-text-primary)] leading-snug line-clamp-2">
            {b.title}
          </h4>
          {b.description && (
            <p className="text-[11px] sm:text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
              {b.description}
            </p>
          )}

          {/* Reminder Badge */}
          {b.remindAt && (
            <div className="pt-1 flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Remind: {new Date(b.remindAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer actions */}
      <div className="px-2.5 sm:px-3.5 py-2 border-t border-[var(--color-border-default)] flex items-center justify-between bg-[var(--color-bg-surface)] gap-1">
        <span className="text-[10px] text-[var(--color-text-muted)] font-medium hidden sm:inline">
          {new Date(b.createdAt).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto justify-around sm:justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchive(b);
            }}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded p-1.5 transition-colors active:scale-95"
            title="Archive Bookmark"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(b);
            }}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-blue-50 rounded p-1.5 transition-colors active:scale-95"
            title="Edit"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(b);
            }}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-status-error)] hover:bg-red-50 rounded p-1.5 transition-colors active:scale-95"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
})

