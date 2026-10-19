export interface SearchBookmarkItem {
  id: string;
  title: string;
  url: string;
  description?: string;
  group?: string;
  favicon?: string;
  image?: string;
  isPinned?: boolean;
  createdAt?: string;
}

/**
 * Filters and ranks bookmarks from the search catalog in sub-millisecond execution time.
 * Supports tokenized multi-attribute matching, group filtering, and pinned bonus scoring.
 */
export function filterAndRankBookmarks(
  catalog: SearchBookmarkItem[],
  query: string,
  groupFilter?: string
): SearchBookmarkItem[] {
  if (!catalog || catalog.length === 0) return [];

  // 1. Group Filtering
  let filtered = catalog;
  if (groupFilter && groupFilter.trim().toLowerCase() !== 'all') {
    const targetGroup = groupFilter.trim().toLowerCase();
    filtered = filtered.filter(
      (item) => (item.group || 'Unsorted').trim().toLowerCase() === targetGroup
    );
  }

  const qClean = (query || '').toLowerCase().trim();

  // 2. Empty Query: Pinned first, then sorted by createdAt descending, top 30
  if (!qClean) {
    return [...filtered]
      .sort((a, b) => {
        const pinA = a.isPinned ? 1 : 0;
        const pinB = b.isPinned ? 1 : 0;
        if (pinB !== pinA) return pinB - pinA;

        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;

        return (a.title || '').localeCompare(b.title || '');
      })
      .slice(0, 30);
  }

  // 3. Tokenize Query
  const tokens = qClean.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return filtered.slice(0, 30);
  }

  // 4. Score Each Item
  const scoredItems: { item: SearchBookmarkItem; score: number }[] = [];

  for (const item of filtered) {
    const itemTitle = (item.title || '').toLowerCase();
    const itemUrl = (item.url || '').toLowerCase();
    const itemDesc = (item.description || '').toLowerCase();
    const itemGroup = (item.group || '').toLowerCase();

    let score = 0;
    let hasMatch = false;

    // Exact title match: +100
    if (itemTitle === qClean) {
      score += 100;
      hasMatch = true;
    } else if (itemTitle.startsWith(qClean)) {
      // Title starts with query: +50
      score += 50;
      hasMatch = true;
    }

    // Title contains all tokens: +30
    if (tokens.every((t) => itemTitle.includes(t))) {
      score += 30;
      hasMatch = true;
    }

    // Group matches query: +25
    if (itemGroup && (itemGroup === qClean || tokens.every((t) => itemGroup.includes(t)))) {
      score += 25;
      hasMatch = true;
    }

    // URL / domain contains all tokens: +20
    if (tokens.every((t) => itemUrl.includes(t))) {
      score += 20;
      hasMatch = true;
    }

    // Description contains all tokens: +10
    if (itemDesc && tokens.every((t) => itemDesc.includes(t))) {
      score += 10;
      hasMatch = true;
    }

    // Fallback cross-field match if multi-token query is distributed across fields
    if (!hasMatch && tokens.length > 1) {
      const combined = `${itemTitle} ${itemGroup} ${itemUrl} ${itemDesc}`;
      if (tokens.every((t) => combined.includes(t))) {
        score += 15;
        hasMatch = true;
      }
    }

    // If item matched search terms, apply pinned bonus
    if (hasMatch && item.isPinned) {
      score += 15;
    }

    if (score > 0) {
      scoredItems.push({ item, score });
    }
  }

  // 5. Sort by Score Descending, then createdAt descending
  scoredItems.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const timeA = a.item.createdAt ? new Date(a.item.createdAt).getTime() : 0;
    const timeB = b.item.createdAt ? new Date(b.item.createdAt).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;

    return (a.item.title || '').localeCompare(b.item.title || '');
  });

  return scoredItems.slice(0, 30).map((s) => s.item);
}
