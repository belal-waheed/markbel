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
  articleContent?: string;
  isBroken?: boolean;
  httpStatus?: number;
}

export type SearchScope = 'all' | 'titles' | 'articles';

export interface FullTextSearchResult<T extends SearchBookmarkItem = SearchBookmarkItem> {
  item: T;
  snippet?: string;
  score: number;
}

/**
 * Extracts a concise snippet (~120-160 chars) highlighting matching context
 * from article content or description.
 */
export function extractHighlightSnippet(
  content: string | undefined | null,
  tokens: string[],
  maxLength: number = 140
): string | undefined {
  if (!content) return undefined;
  const clean = content.replace(/\s+/g, ' ').trim();
  if (!clean) return undefined;
  if (tokens.length === 0) {
    return clean.length > maxLength ? clean.slice(0, maxLength - 3) + '...' : clean;
  }

  const lower = clean.toLowerCase();
  let firstIdx = -1;

  for (const token of tokens) {
    const idx = lower.indexOf(token.toLowerCase());
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  if (firstIdx === -1) {
    return clean.length > maxLength ? clean.slice(0, maxLength - 3) + '...' : clean;
  }

  const start = Math.max(0, firstIdx - 35);
  const end = Math.min(clean.length, firstIdx + (maxLength - 35));
  let snippet = clean.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < clean.length) snippet = snippet + '...';
  return snippet;
}

/**
 * Searches and ranks bookmarks with full-text deep search support across title, url, group,
 * description, and extracted article body.
 */
export function searchCatalogFullText<T extends SearchBookmarkItem = SearchBookmarkItem>(
  catalog: T[],
  query: string,
  scope: SearchScope = 'all',
  groupFilter?: string,
  limit: number = 30
): FullTextSearchResult<T>[] {
  if (!catalog || catalog.length === 0) return [];

  const applyLimit = (items: FullTextSearchResult<T>[]): FullTextSearchResult<T>[] => {
    return limit <= 0 ? items : items.slice(0, limit);
  };

  // 1. Group Filtering
  let filtered = catalog;
  if (groupFilter && groupFilter.trim().toLowerCase() !== 'all') {
    const targetGroup = groupFilter.trim().toLowerCase();
    filtered = filtered.filter(
      (item) => (item.group || 'Unsorted').trim().toLowerCase() === targetGroup
    );
  }

  const qClean = (query || '').toLowerCase().trim();

  // 2. Empty Query
  if (!qClean) {
    const sorted = [...filtered].sort((a, b) => {
      const pinA = a.isPinned ? 1 : 0;
      const pinB = b.isPinned ? 1 : 0;
      if (pinB !== pinA) return pinB - pinA;

      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;

      return (a.title || '').localeCompare(b.title || '');
    });
    return applyLimit(sorted.map((item) => ({ item, score: 0 })));
  }

  // 3. Tokenize Query
  const tokens = qClean.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return applyLimit(filtered.map((item) => ({ item, score: 0 })));
  }

  // 4. Score Each Item
  const scoredItems: FullTextSearchResult<T>[] = [];

  for (const item of filtered) {
    const itemTitle = (item.title || '').toLowerCase();
    const itemUrl = (item.url || '').toLowerCase();
    const itemDesc = (item.description || '').toLowerCase();
    const itemGroup = (item.group || '').toLowerCase();
    const itemArticle = (item.articleContent || '').toLowerCase();

    let score = 0;
    let hasMatch = false;

    if (scope === 'titles') {
      // Titles & URLs scope only
      if (itemTitle === qClean) {
        score += 100;
        hasMatch = true;
      } else if (itemTitle.startsWith(qClean)) {
        score += 50;
        hasMatch = true;
      }

      if (tokens.every((t) => itemTitle.includes(t))) {
        score += 30;
        hasMatch = true;
      }

      if (tokens.every((t) => itemUrl.includes(t))) {
        score += 20;
        hasMatch = true;
      }
    } else if (scope === 'articles') {
      // Full Article Body scope
      if (itemArticle && tokens.every((t) => itemArticle.includes(t))) {
        score += 50;
        hasMatch = true;
      } else if (itemDesc && tokens.every((t) => itemDesc.includes(t))) {
        score += 30;
        hasMatch = true;
      }
    } else {
      // All Scope: Titles, URLs, Groups, Descriptions & Full Articles
      if (itemTitle === qClean) {
        score += 100;
        hasMatch = true;
      } else if (itemTitle.startsWith(qClean)) {
        score += 50;
        hasMatch = true;
      }

      if (tokens.every((t) => itemTitle.includes(t))) {
        score += 30;
        hasMatch = true;
      }

      if (itemGroup && (itemGroup === qClean || tokens.every((t) => itemGroup.includes(t)))) {
        score += 25;
        hasMatch = true;
      }

      if (tokens.every((t) => itemUrl.includes(t))) {
        score += 20;
        hasMatch = true;
      }

      if (itemDesc && tokens.every((t) => itemDesc.includes(t))) {
        score += 10;
        hasMatch = true;
      }

      if (itemArticle && tokens.every((t) => itemArticle.includes(t))) {
        score += 15;
        hasMatch = true;
      }

      // Fallback cross-field match if multi-token query is distributed across fields
      if (!hasMatch && tokens.length > 1) {
        const combined = `${itemTitle} ${itemGroup} ${itemUrl} ${itemDesc} ${itemArticle}`;
        if (tokens.every((t) => combined.includes(t))) {
          score += 15;
          hasMatch = true;
        }
      }
    }

    if (hasMatch && item.isPinned) {
      score += 15;
    }

    if (score > 0) {
      const snippet = extractHighlightSnippet(item.articleContent || item.description, tokens);
      scoredItems.push({ item, score, snippet });
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

  return applyLimit(scoredItems);
}

/**
 * Backwards-compatible filter and rank bookmarks helper.
 */
export function filterAndRankBookmarks<T extends SearchBookmarkItem = SearchBookmarkItem>(
  catalog: T[],
  query: string,
  groupFilter?: string,
  limit: number = 30,
  scope: SearchScope = 'all'
): T[] {
  const results = searchCatalogFullText(catalog, query, scope, groupFilter, limit);
  return results.map((r) => r.item);
}
