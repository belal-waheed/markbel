import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Layers,
  Folder,
  Pin,
  ChevronDown,
  SlidersHorizontal,
  Plus,
  X,
} from "lucide-react";
import { resolveHomeCategories } from "../lib/homeCategories";

export interface CategoryPillBarProps {
  groups: { name: string; count: number }[];
  activeGroup: string | null;
  onSelectGroup: (group: string | null) => void;
  pinnedCategoryNames: string[];
  onTogglePin: (groupName: string) => void;
  totalCount: number;
  onOpenNewGroup?: () => void;
}

export const CategoryPillBar: React.FC<CategoryPillBarProps> = ({
  groups,
  activeGroup,
  onSelectGroup,
  pinnedCategoryNames,
  onTogglePin,
  totalCount,
  onOpenNewGroup,
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside or Escape key
  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsPopoverOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPopoverOpen]);

  // Resolve visible (top 6: pinned first, then by count) vs overflow
  const { visible, overflow, pinnedNames } = useMemo(() => {
    return resolveHomeCategories(groups, 6, pinnedCategoryNames);
  }, [groups, pinnedCategoryNames]);

  const isOverflowActive = useMemo(() => {
    if (!activeGroup) return false;
    return overflow.some((item) => item.name === activeGroup);
  }, [activeGroup, overflow]);

  // Combined sorted list for the Manage Popover: pinned first, then alphabetical
  const allSortedForPopover = useMemo(() => {
    return [...groups].sort((a, b) => {
      const aPinned = pinnedNames.has(a.name);
      const bPinned = pinnedNames.has(b.name);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [groups, pinnedNames]);

  return (
    <div className="relative mb-5 flex items-center justify-between gap-2">
      {/* Scrollable Pills Rail */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 touch-manipulation">
        {/* All Bookmarks Pill */}
        <button
          type="button"
          onClick={() => onSelectGroup(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-95 shrink-0 cursor-pointer ${
            activeGroup === null
              ? "bg-[var(--color-accent)] text-white shadow-xs"
              : "bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)]"
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>All</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeGroup === null
                ? "bg-white/25 text-white"
                : "bg-[var(--color-bg-element)] text-[var(--color-text-muted)]"
            }`}
          >
            {totalCount}
          </span>
        </button>

        {/* Visible Category Pills */}
        {visible.map((cat) => {
          const isActive = activeGroup === cat.name;
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => onSelectGroup(isActive ? null : cat.name)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all active:scale-95 shrink-0 cursor-pointer ${
                isActive
                  ? "bg-[var(--color-accent)] text-white shadow-xs font-semibold"
                  : "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)]"
              }`}
            >
              {cat.isPinned ? (
                <Pin className="w-3 h-3 opacity-80 shrink-0 rotate-45 fill-current" />
              ) : (
                <Folder className="w-3 h-3 opacity-60 shrink-0" />
              )}
              <span className="truncate max-w-[120px] sm:max-w-[160px]">
                {cat.name}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive
                    ? "bg-white/25 text-white"
                    : "bg-[var(--color-bg-element)] text-[var(--color-text-muted)]"
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Manage / More Popover Trigger Anchor */}
      <div className="relative shrink-0" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setIsPopoverOpen((prev) => !prev)}
          aria-expanded={isPopoverOpen}
          aria-label="Manage categories"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-all active:scale-95 shrink-0 cursor-pointer ${
            isPopoverOpen || isOverflowActive
              ? "bg-[var(--color-bg-hover)] border-[var(--color-accent)] text-[var(--color-accent)]"
              : "bg-[var(--color-bg-surface)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span>{overflow.length > 0 ? `More (${overflow.length})` : "Manage"}</span>
          <ChevronDown
            className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
              isPopoverOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown Popover */}
        {isPopoverOpen && (
          <div
            role="dialog"
            aria-label="Manage Categories"
            className="absolute right-0 top-full mt-1.5 z-40 w-72 max-w-[calc(100vw-2rem)] bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl shadow-xl p-2.5 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between px-2 pb-2 mb-1.5 border-b border-[var(--color-border-default)]">
              <div>
                <span className="text-xs font-bold text-[var(--color-text-primary)] block">
                  Categories
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  Pin to homepage or tap to view
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPopoverOpen(false)}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-md hover:bg-[var(--color-bg-hover)] transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Category List */}
            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-0.5">
              {allSortedForPopover.length === 0 ? (
                <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">
                  No categories found.
                </div>
              ) : (
                allSortedForPopover.map((group) => {
                  const isPinned = pinnedNames.has(group.name);
                  const isActive = activeGroup === group.name;

                  return (
                    <div
                      key={group.name}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${
                        isActive
                          ? "bg-[var(--color-bg-element)] text-[var(--color-text-primary)] font-semibold"
                          : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                      }`}
                    >
                      {/* Select Category Button */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectGroup(isActive ? null : group.name);
                          setIsPopoverOpen(false);
                        }}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <Folder className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 opacity-70" />
                        <span className="truncate flex-1">{group.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--color-bg-element)] text-[var(--color-text-muted)] shrink-0">
                          {group.count}
                        </span>
                      </button>

                      {/* 1-Click Pin / Unpin Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(group.name);
                        }}
                        title={isPinned ? "Unpin from homepage" : "Pin to homepage"}
                        className={`p-1.5 rounded-md ml-1 transition-colors active:scale-95 ${
                          isPinned
                            ? "text-[var(--color-accent)] bg-[var(--color-bg-element)] hover:bg-[var(--color-bg-hover)]"
                            : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                        }`}
                      >
                        <Pin
                          className={`w-3.5 h-3.5 ${
                            isPinned ? "fill-current" : ""
                          }`}
                        />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Optional New Group Action */}
            {onOpenNewGroup && (
              <div className="pt-2 mt-1.5 border-t border-[var(--color-border-default)]">
                <button
                  type="button"
                  onClick={() => {
                    setIsPopoverOpen(false);
                    onOpenNewGroup();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Group</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
