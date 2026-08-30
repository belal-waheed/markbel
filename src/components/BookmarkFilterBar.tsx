import React from "react";
import { Search, X, Pin, Clock, BookOpen, Layers } from "lucide-react";

export type FilterTab = "all" | "unread" | "pinned" | "due";

interface BookmarkFilterBarProps {
  currentTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  counts: {
    all: number;
    unread: number;
    pinned: number;
    due: number;
  };
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export const BookmarkFilterBar: React.FC<BookmarkFilterBarProps> = ({
  currentTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  counts,
  searchInputRef,
}) => {
  const tabs = [
    { id: "all" as FilterTab, label: "All", count: counts.all, icon: Layers },
    { id: "unread" as FilterTab, label: "Unread", count: counts.unread, icon: BookOpen },
    { id: "pinned" as FilterTab, label: "Pinned", count: counts.pinned, icon: Pin },
    { id: "due" as FilterTab, label: "Due Today", count: counts.due, icon: Clock },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 bg-[var(--color-bg-surface)] p-2.5 sm:p-3 rounded-xl border border-[var(--color-border-default)]">
      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                isActive
                  ? "bg-[var(--color-accent)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive
                    ? "bg-white/25 text-white"
                    : "bg-[var(--color-bg-element)] text-[var(--color-text-muted)]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input for Mobile/Desktop */}
      <div className="relative flex-1 sm:max-w-xs">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[var(--color-text-muted)]">
          <Search className="w-3.5 h-3.5" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter bookmarks... (/)"
          className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-1.5 pl-8 pr-7 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focused)] focus:ring-1 focus:ring-[var(--color-border-focused)] transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute inset-y-0 right-0 pr-2 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
