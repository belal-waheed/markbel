export const STORAGE_KEY = 'markbel_pinned_categories';

export interface CategoryGroupItem {
  name: string;
  count: number;
  isPinned: boolean;
}

export interface ResolvedHomeCategories {
  visible: CategoryGroupItem[];
  overflow: CategoryGroupItem[];
  pinnedNames: Set<string>;
}

/**
 * Reads user-pinned homepage category names from localStorage.
 * Handles SSR/missing window, empty values, and malformed JSON safely.
 */
export function getPinnedCategories(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Persists an array of pinned category names as unique trimmed strings to localStorage.
 */
export function setPinnedCategories(categories: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const unique = Array.from(
      new Set(
        categories
          .filter((c): c is string => typeof c === 'string')
          .map((c) => c.trim())
          .filter((c) => c.length > 0)
      )
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  } catch {
    // Gracefully handle storage quota or private-browsing restrictions
  }
}

/**
 * Toggles the pinned state of a category name and returns the updated array.
 */
export function togglePinnedCategory(categoryName: string): string[] {
  const trimmed = typeof categoryName === 'string' ? categoryName.trim() : '';
  if (!trimmed) {
    return getPinnedCategories();
  }

  const current = getPinnedCategories();
  const exists = current.includes(trimmed);
  const next = exists
    ? current.filter((c) => c !== trimmed)
    : [...current, trimmed];

  setPinnedCategories(next);
  return next;
}

/**
 * Resolves homepage category groups into visible and overflow lists.
 * - Pinned groups are prioritized first (in order of user pinning).
 * - Unpinned groups follow, ordered descending by bookmark count (most populated first).
 * - Splits into `visible` (up to `maxVisible`) and `overflow` lists.
 */
export function resolveHomeCategories(
  groups: { name: string; count: number }[],
  maxVisible = 6,
  pinnedCategories?: string[]
): ResolvedHomeCategories {
  const pinnedList = pinnedCategories !== undefined ? pinnedCategories : getPinnedCategories();
  const pinnedNames = new Set(pinnedList);

  const pinnedOrderMap = new Map<string, number>();
  pinnedList.forEach((name, idx) => {
    pinnedOrderMap.set(name, idx);
  });

  const decorated: CategoryGroupItem[] = (groups || []).map((g) => ({
    name: g.name,
    count: typeof g.count === 'number' ? g.count : 0,
    isPinned: pinnedNames.has(g.name),
  }));

  const pinnedItems = decorated
    .filter((item) => item.isPinned)
    .sort((a, b) => {
      const orderA = pinnedOrderMap.get(a.name) ?? 999999;
      const orderB = pinnedOrderMap.get(b.name) ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

  const unpinnedItems = decorated
    .filter((item) => !item.isPinned)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

  const allSorted = [...pinnedItems, ...unpinnedItems];
  const safeLimit = Math.max(0, maxVisible);
  const visible = allSorted.slice(0, safeLimit);
  const overflow = allSorted.slice(safeLimit);

  return {
    visible,
    overflow,
    pinnedNames,
  };
}
