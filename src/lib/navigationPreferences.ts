import { getPinnedCategories, setPinnedCategories } from "./homeCategories";

export const STORAGE_KEY = "markbel_nav_preferences";

export interface NavigationPreferences {
  defaultView: "all" | "unread" | "pinned" | "due" | string; // e.g. 'all', 'unread', 'pinned', 'due', 'group:YT'
  hideEmptyGroups: boolean; // default: true
  hiddenGroupNames: string[]; // default: []
  pinnedGroupNames: string[]; // default: []
  showMobileCategoryScroller: boolean; // default: true
}

export const DEFAULT_NAVIGATION_PREFERENCES: NavigationPreferences = {
  defaultView: "all",
  hideEmptyGroups: true,
  hiddenGroupNames: [],
  pinnedGroupNames: [],
  showMobileCategoryScroller: true,
};

/**
 * Reads user navigation and workspace preferences from localStorage.
 * Handles SSR/missing window, empty values, and malformed JSON safely.
 */
export function getNavigationPreferences(): NavigationPreferences {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_NAVIGATION_PREFERENCES };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Migrate legacy pinned categories if present
      const legacyPinned = getPinnedCategories();
      if (legacyPinned && legacyPinned.length > 0) {
        return {
          ...DEFAULT_NAVIGATION_PREFERENCES,
          pinnedGroupNames: legacyPinned,
        };
      }
      return { ...DEFAULT_NAVIGATION_PREFERENCES };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_NAVIGATION_PREFERENCES };
    }

    const defaultView =
      typeof parsed.defaultView === "string" && parsed.defaultView.trim()
        ? parsed.defaultView.trim()
        : DEFAULT_NAVIGATION_PREFERENCES.defaultView;

    const hideEmptyGroups =
      typeof parsed.hideEmptyGroups === "boolean"
        ? parsed.hideEmptyGroups
        : DEFAULT_NAVIGATION_PREFERENCES.hideEmptyGroups;

    const showMobileCategoryScroller =
      typeof parsed.showMobileCategoryScroller === "boolean"
        ? parsed.showMobileCategoryScroller
        : DEFAULT_NAVIGATION_PREFERENCES.showMobileCategoryScroller;

    const hiddenGroupNames = Array.isArray(parsed.hiddenGroupNames)
      ? Array.from(
          new Set(
            parsed.hiddenGroupNames
              .filter((item: unknown): item is string => typeof item === "string")
              .map((item: string) => item.trim())
              .filter((item: string) => item.length > 0)
          )
        )
      : [];

    let pinnedGroupNames = Array.isArray(parsed.pinnedGroupNames)
      ? Array.from(
          new Set(
            parsed.pinnedGroupNames
              .filter((item: unknown): item is string => typeof item === "string")
              .map((item: string) => item.trim())
              .filter((item: string) => item.length > 0)
          )
        )
      : [];

    // Fallback if pinnedGroupNames is empty in prefs but present in legacy storage
    if (pinnedGroupNames.length === 0) {
      const legacyPinned = getPinnedCategories();
      if (legacyPinned && legacyPinned.length > 0) {
        pinnedGroupNames = legacyPinned;
      }
    }

    return {
      defaultView,
      hideEmptyGroups,
      hiddenGroupNames,
      pinnedGroupNames,
      showMobileCategoryScroller,
    };
  } catch {
    return { ...DEFAULT_NAVIGATION_PREFERENCES };
  }
}

/**
 * Merges partial preferences and persists them to localStorage.
 */
export function setNavigationPreferences(
  updates: Partial<NavigationPreferences>
): NavigationPreferences {
  const current = getNavigationPreferences();
  const merged: NavigationPreferences = {
    ...current,
    ...updates,
  };

  if (updates.hiddenGroupNames) {
    merged.hiddenGroupNames = Array.from(
      new Set(
        updates.hiddenGroupNames
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    );
  }

  if (updates.pinnedGroupNames) {
    merged.pinnedGroupNames = Array.from(
      new Set(
        updates.pinnedGroupNames
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    );
    // Keep legacy storage key in sync
    setPinnedCategories(merged.pinnedGroupNames);
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(
        new CustomEvent("markbel_nav_preferences_changed", { detail: merged })
      );
    } catch {
      // Gracefully handle storage quota or private-browsing restrictions
    }
  }

  return merged;
}

/**
 * Toggles visibility of a specific group (in or out of hiddenGroupNames).
 */
export function toggleGroupVisibility(name: string): NavigationPreferences {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    return getNavigationPreferences();
  }

  const current = getNavigationPreferences();
  const exists = current.hiddenGroupNames.includes(trimmed);
  const nextHidden = exists
    ? current.hiddenGroupNames.filter((g) => g !== trimmed)
    : [...current.hiddenGroupNames, trimmed];

  return setNavigationPreferences({ hiddenGroupNames: nextHidden });
}

/**
 * Toggles pinned state of a specific group (in or out of pinnedGroupNames).
 */
export function toggleGroupPin(name: string): NavigationPreferences {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    return getNavigationPreferences();
  }

  const current = getNavigationPreferences();
  const exists = current.pinnedGroupNames.includes(trimmed);
  const nextPinned = exists
    ? current.pinnedGroupNames.filter((g) => g !== trimmed)
    : [...current.pinnedGroupNames, trimmed];

  return setNavigationPreferences({ pinnedGroupNames: nextPinned });
}

export interface VisibleGroupItem {
  name: string;
  count: number;
  isPinned: boolean;
}

export interface HiddenGroupItem {
  name: string;
  count: number;
  isPinned: boolean;
  isAutoHiddenEmpty: boolean;
}

export interface FilteredSortedGroups {
  visibleGroups: VisibleGroupItem[];
  hiddenGroups: HiddenGroupItem[];
}

/**
 * Categorizes and sorts groups into visible and hidden arrays based on preferences.
 * - Group is hidden if explicitly in `hiddenGroupNames` OR if `hideEmptyGroups` is true and count === 0 (unless pinned).
 * - Pinned groups are sorted to the top of `visibleGroups`.
 * - Visible groups: pinned first (alphabetical), then unpinned (alphabetical).
 * - Hidden groups: alphabetical.
 */
export function filterAndSortGroups(
  groups: { name: string; count: number }[],
  prefs: NavigationPreferences
): FilteredSortedGroups {
  const safeGroups = Array.isArray(groups) ? groups : [];
  const hiddenNamesSet = new Set(prefs.hiddenGroupNames || []);
  const pinnedNamesSet = new Set(prefs.pinnedGroupNames || []);

  const visibleGroups: VisibleGroupItem[] = [];
  const hiddenGroups: HiddenGroupItem[] = [];

  for (const group of safeGroups) {
    const isPinned = pinnedNamesSet.has(group.name);
    const isExplicitlyHidden = hiddenNamesSet.has(group.name);
    const isAutoHiddenEmpty = Boolean(
      prefs.hideEmptyGroups && group.count === 0 && !isPinned
    );

    const isHidden = isExplicitlyHidden || isAutoHiddenEmpty;

    if (isHidden) {
      hiddenGroups.push({
        name: group.name,
        count: group.count,
        isPinned,
        isAutoHiddenEmpty,
      });
    } else {
      visibleGroups.push({
        name: group.name,
        count: group.count,
        isPinned,
      });
    }
  }

  // Sort visible groups: pinned first (alphabetical), then non-pinned (alphabetical)
  visibleGroups.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.name.localeCompare(b.name);
  });

  // Sort hidden groups: alphabetical
  hiddenGroups.sort((a, b) => a.name.localeCompare(b.name));

  return {
    visibleGroups,
    hiddenGroups,
  };
}
