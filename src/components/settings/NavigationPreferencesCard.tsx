import React from "react";
import {
  Eye,
  EyeOff,
  LayoutGrid,
  Pin,
  SlidersHorizontal,
} from "lucide-react";
import { NavigationPreferences } from "../../lib/navigationPreferences.js";
import { COLOR_OPTIONS } from "./settingsConstants.js";

interface NavigationPreferencesCardProps {
  navPrefs: NavigationPreferences;
  availableGroups: string[];
  groupCounts: Record<string, number>;
  groupColorMap: Record<string, string>;
  onUpdateNavPrefs: (updates: Partial<NavigationPreferences>, msg?: string) => void;
  onToggleVisibility: (groupName: string) => void;
  onTogglePin: (groupName: string) => void;
}

export default function NavigationPreferencesCard({
  navPrefs,
  availableGroups,
  groupCounts,
  groupColorMap,
  onUpdateNavPrefs,
  onToggleVisibility,
  onTogglePin,
}: NavigationPreferencesCardProps) {
  return (
    <section id="navigation" className="studio-card p-4 sm:p-6 relative space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[var(--color-accent)]/10 border border-[var(--color-border-default)] text-[var(--color-accent)] flex items-center justify-center font-bold rounded">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Navigation & Sidebar Preferences
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Configure default startup view, auto-hide empty groups, and sidebar ordering
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 px-2 py-0.5 rounded">
          Saved Automatically
        </span>
      </div>

      {/* Startup View Control */}
      <div className="p-4 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-[var(--color-accent)]" />
            <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
              Default Startup View
            </h4>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Specify which tab or group is displayed when opening Markbel.
          </p>
        </div>

        <select
          value={navPrefs.defaultView}
          onChange={(e) => {
            onUpdateNavPrefs(
              { defaultView: e.target.value },
              `Default view set to "${e.target.selectedOptions[0]?.text || e.target.value}"`
            );
          }}
          className="input-field text-xs px-3 py-2 rounded-md sm:w-60 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium cursor-pointer"
        >
          <optgroup label="Standard Views">
            <option value="all">All Bookmarks</option>
            <option value="unread">Unread Only</option>
            <option value="pinned">Pinned Only</option>
            <option value="due">Due Reminders</option>
          </optgroup>
          {availableGroups.length > 0 && (
            <optgroup label="Groups">
              {availableGroups.map((g) => (
                <option key={g} value={`group:${g}`}>
                  Group: {g}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Global Switches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hide Empty Groups */}
        <div className="p-4 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)] flex items-start justify-between gap-4">
          <div className="space-y-1 pr-2">
            <span className="text-xs font-bold text-[var(--color-text-primary)] block">
              Auto-hide Empty Groups
            </span>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Automatically collapse 0-count groups in the sidebar unless explicitly pinned to top.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={navPrefs.hideEmptyGroups}
            onClick={() => {
              const nextVal = !navPrefs.hideEmptyGroups;
              onUpdateNavPrefs(
                { hideEmptyGroups: nextVal },
                nextVal ? "Auto-hide empty groups enabled" : "Empty groups will remain visible"
              );
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              navPrefs.hideEmptyGroups ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-default)]"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                navPrefs.hideEmptyGroups ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Mobile Category Scroller */}
        <div className="p-4 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)] flex items-start justify-between gap-4">
          <div className="space-y-1 pr-2">
            <span className="text-xs font-bold text-[var(--color-text-primary)] block">
              Mobile Category Scroller
            </span>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Show category filter chips at the top of the mobile feed (when sidebar is hidden).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={navPrefs.showMobileCategoryScroller}
            onClick={() => {
              const nextVal = !navPrefs.showMobileCategoryScroller;
              onUpdateNavPrefs(
                { showMobileCategoryScroller: nextVal },
                nextVal ? "Mobile category scroller enabled" : "Mobile category scroller hidden"
              );
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              navPrefs.showMobileCategoryScroller ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-default)]"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                navPrefs.showMobileCategoryScroller ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Group Visibility & Pinning Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
              Sidebar Groups & Pinning Matrix
            </h4>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Control individual group visibility and pin priority in the sidebar navigation
            </p>
          </div>
          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            {availableGroups.length} group{availableGroups.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="border border-[var(--color-border-default)] rounded-lg overflow-hidden bg-[var(--color-bg-surface)]">
          {availableGroups.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--color-text-muted)]">
              No groups created yet.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border-default)]">
              {availableGroups.map((groupName) => {
                const count = groupCounts[groupName] || 0;
                const isPinned = navPrefs.pinnedGroupNames.includes(groupName);
                const isHidden = navPrefs.hiddenGroupNames.includes(groupName);
                const isAutoEmpty = navPrefs.hideEmptyGroups && count === 0 && !isPinned;
                const color = groupColorMap[groupName.toLowerCase()] || "blue";

                return (
                  <div
                    key={groupName}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-[var(--color-bg-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          COLOR_OPTIONS.find((c) => c.name === color)?.bg || "bg-blue-500"
                        }`}
                      />
                      <div className="truncate">
                        <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate block">
                          {groupName}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          {count} bookmark{count === 1 ? "" : "s"}
                          {isAutoEmpty && !isHidden && (
                            <span className="text-[10px] text-amber-500 font-medium ml-1.5">
                              (auto-hidden empty)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Visibility Button */}
                      <button
                        type="button"
                        onClick={() => onToggleVisibility(groupName)}
                        className={`min-h-[44px] min-w-[44px] sm:min-w-0 px-3 py-2 flex items-center justify-center sm:justify-start gap-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          isHidden
                            ? "bg-[var(--color-bg-element)] text-[var(--color-text-muted)] border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]"
                            : "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] border-[var(--color-border-default)] hover:border-[var(--color-accent)]"
                        }`}
                        title={isHidden ? "Unhide group" : "Hide group from sidebar"}
                      >
                        {isHidden ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 opacity-60" />
                            <span className="hidden sm:inline">Hidden</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                            <span className="hidden sm:inline">Visible</span>
                          </>
                        )}
                      </button>

                      {/* Pin Button */}
                      <button
                        type="button"
                        onClick={() => onTogglePin(groupName)}
                        className={`min-h-[44px] min-w-[44px] sm:min-w-0 px-3 py-2 flex items-center justify-center sm:justify-start gap-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          isPinned
                            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/30 font-semibold"
                            : "bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]"
                        }`}
                        title={isPinned ? "Unpin group" : "Pin group to top of sidebar"}
                      >
                        <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-current" : ""}`} />
                        <span className="hidden sm:inline">
                          {isPinned ? "Pinned" : "Pin"}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
