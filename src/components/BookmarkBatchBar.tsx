import React, { useState, useRef, useEffect } from "react";
import { CheckCircle, Archive, Trash2, FolderInput } from "lucide-react";

export interface BookmarkBatchBarProps {
  selectedCount: number;
  onClear: () => void;
  onToggleRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
  groups?: string[];
  onMoveGroup?: (targetGroup: string) => void;
}

export const BookmarkBatchBar: React.FC<BookmarkBatchBarProps> = ({
  selectedCount,
  onClear,
  onToggleRead,
  onArchive,
  onDelete,
  groups = [],
  onMoveGroup,
}) => {
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isMoveOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsMoveOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMoveOpen]);

  if (selectedCount <= 0) return null;

  const availableGroups = Array.from(new Set(groups.length > 0 ? groups : ["Unsorted"]));

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions toolbar"
      className="mb-6 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 bg-[var(--color-bg-surface)] border border-[var(--color-accent)]/40 rounded-xl p-2.5 px-4 shadow-xl backdrop-blur-md animate-in slide-in-from-top-2 duration-200"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-[var(--color-accent)] bg-[var(--color-brand-subtle)] px-2.5 py-1 rounded-md border border-[var(--color-accent)]/20">
          {selectedCount} Selected
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          aria-label="Clear selection"
        >
          Clear
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {onMoveGroup && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsMoveOpen((prev) => !prev)}
              className="btn-secondary text-xs px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer"
              aria-label="Move selected bookmarks to group"
              aria-expanded={isMoveOpen}
            >
              <FolderInput className="w-3.5 h-3.5" />
              <span>Move to Group</span>
            </button>
            {isMoveOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl shadow-xl py-1 z-30 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider border-b border-[var(--color-border-default)]">
                  Select Group
                </div>
                {availableGroups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setIsMoveOpen(false);
                      onMoveGroup(g);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors truncate block cursor-pointer"
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
