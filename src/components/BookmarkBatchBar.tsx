import React from "react";
import { CheckCircle, Archive, Trash2 } from "lucide-react";

export interface BookmarkBatchBarProps {
  selectedCount: number;
  onClear: () => void;
  onToggleRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export const BookmarkBatchBar: React.FC<BookmarkBatchBarProps> = ({
  selectedCount,
  onClear,
  onToggleRead,
  onArchive,
  onDelete,
}) => {
  if (selectedCount <= 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions toolbar"
      className="mb-6 sticky top-0 z-20 flex items-center justify-between bg-[var(--color-bg-element)] border border-[var(--color-accent)] rounded-lg p-2 px-4 shadow-lg backdrop-blur-md animate-in slide-in-from-top-2"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-[var(--color-accent)]">
          {selectedCount} Selected
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-[var(--color-text-muted)] hover:text-white transition-colors cursor-pointer"
          aria-label="Clear selection"
        >
          Clear
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleRead}
          className="btn-secondary text-xs px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer"
          aria-label="Toggle read status"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Toggle Read</span>
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="btn-secondary text-xs px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer"
          aria-label="Archive selected bookmarks"
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Archive</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs px-3 py-1.5 rounded flex items-center gap-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20 cursor-pointer"
          aria-label="Delete selected bookmarks"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
};

export default BookmarkBatchBar;
