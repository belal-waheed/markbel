import { describe, it, expect } from 'vitest';
import {
  filterAndRankBookmarks,
  searchCatalogFullText,
  extractHighlightSnippet,
  safeParseTimestamp,
  SearchBookmarkItem,
} from './searchCatalog';
import { extractArticleTokens } from '../db/db';

describe('searchCatalog - filterAndRankBookmarks', () => {
  const sampleCatalog: SearchBookmarkItem[] = [
    {
      id: '1',
      title: 'React Documentation',
      url: 'https://react.dev',
      description: 'The library for web and native user interfaces',
      group: 'Dev',
      isPinned: false,
      createdAt: '2026-01-01T10:00:00Z',
    },
    {
      id: '2',
      title: 'Pinned Article About Design',
      url: 'https://designsystems.com',
      description: 'Design systems architecture and tokens',
      group: 'Design',
      isPinned: true,
      createdAt: '2026-01-02T10:00:00Z',
    },
    {
      id: '3',
      title: 'Older Unpinned Bookmark',
      url: 'https://example.com/old',
      description: 'Ancient notes',
      group: 'Unsorted',
      isPinned: false,
      createdAt: '2025-12-01T10:00:00Z',
    },
    {
      id: '4',
      title: 'Newest Unpinned Bookmark',
      url: 'https://example.com/new',
      description: 'Fresh notes',
      group: 'Unsorted',
      isPinned: false,
      createdAt: '2026-03-01T10:00:00Z',
    },
    {
      id: '5',
      title: 'YouTube - Building React Hooks from Scratch',
      url: 'https://youtube.com/watch?v=123',
      description: 'Deep dive into hooks implementation',
      group: 'YT',
      isPinned: false,
      createdAt: '2026-02-01T10:00:00Z',
    },
    {
      id: '6',
      title: 'Advanced Web Architecture',
      url: 'https://arch.io',
      description: 'Explaining react hooks and state management',
      group: 'Dev',
      isPinned: false,
      createdAt: '2026-02-15T10:00:00Z',
    },
    {
      id: '7',
      title: 'Pinned React Tutorial',
      url: 'https://react-tutorial.io',
      description: 'Step by step tutorial',
      group: 'Dev',
      isPinned: true,
      createdAt: '2026-02-10T10:00:00Z',
    },
  ];

  it('empty query returns pinned items first, ordered by createdAt descending', () => {
    const results = filterAndRankBookmarks(sampleCatalog, '');
    expect(results.length).toBe(sampleCatalog.length);

    // Pinned items must come first
    expect(results[0].isPinned).toBe(true);
    expect(results[1].isPinned).toBe(true);

    // Newer pinned item (id: 7 from Feb 2026) before older pinned (id: 2 from Jan 2026)
    expect(results[0].id).toBe('7');
    expect(results[1].id).toBe('2');

    // After pinned items, unpinned should be ordered by createdAt descending
    expect(results[2].id).toBe('4'); // 2026-03-01
  });

  it('title matches rank higher than description matches', () => {
    // Both items match "hooks", but item 5 has "hooks" in title, item 6 only in description
    const results = filterAndRankBookmarks(sampleCatalog, 'hooks');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].id).toBe('5'); // Title match
    expect(results[1].id).toBe('6'); // Description match
  });

  it('group filtering works accurately', () => {
    const devResults = filterAndRankBookmarks(sampleCatalog, '', 'Dev');
    expect(devResults.every((item) => item.group === 'Dev')).toBe(true);
    expect(devResults.length).toBe(3);

    // Case-insensitivity check
    const ytResults = filterAndRankBookmarks(sampleCatalog, '', 'yt');
    expect(ytResults.length).toBe(1);
    expect(ytResults[0].id).toBe('5');

    // 'All' filter returns all groups
    const allResults = filterAndRankBookmarks(sampleCatalog, '', 'All');
    expect(allResults.length).toBe(sampleCatalog.length);
  });

  it('multi-token queries correctly match across tokens', () => {
    const results = filterAndRankBookmarks(sampleCatalog, 'react hooks');
    expect(results.length).toBeGreaterThanOrEqual(2);
    // Item 5 has both tokens in title ("YouTube - Building React Hooks from Scratch")
    expect(results[0].id).toBe('5');
    // Item 6 has "react" and "hooks" in description
    expect(results[1].id).toBe('6');
  });

  it('pinned items receive score bonus over unpinned with similar matches', () => {
    const customCatalog: SearchBookmarkItem[] = [
      { id: 'unpinned', title: 'React Documentation', url: 'https://react.dev', isPinned: false },
      { id: 'pinned', title: 'React Tutorial', url: 'https://react-tutorial.dev', isPinned: true },
    ];
    const results = filterAndRankBookmarks(customCatalog, 'React');
    expect(results[0].id).toBe('pinned');
    expect(results[1].id).toBe('unpinned');
  });

  it('exact title match gets the highest score', () => {
    const customCatalog: SearchBookmarkItem[] = [
      { id: 'a', title: 'React', url: 'https://react.dev' },
      { id: 'b', title: 'React Documentation', url: 'https://react.dev/docs' },
    ];
    const results = filterAndRankBookmarks(customCatalog, 'react');
    expect(results[0].id).toBe('a');
  });

  it('returns maximum 30 items', () => {
    const largeCatalog: SearchBookmarkItem[] = Array.from({ length: 50 }, (_, i) => ({
      id: `item-${i}`,
      title: `Bookmark ${i}`,
      url: `https://example.com/${i}`,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
    }));
    const results = filterAndRankBookmarks(largeCatalog, '');
    expect(results.length).toBe(30);
  });

  it('returns all items without slicing when limit <= 0', () => {
    // Arrange
    const largeCatalog: SearchBookmarkItem[] = Array.from({ length: 45 }, (_, i) => ({
      id: `item-${i}`,
      title: `Cloudflare Article ${i}`,
      url: `https://cloudflare.com/${i}`,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
    }));

    // Act
    const allEmptyResults = filterAndRankBookmarks(largeCatalog, '', undefined, 0);
    const allQueryResults = filterAndRankBookmarks(largeCatalog, 'cloudflare', undefined, 0);

    // Assert
    expect(allEmptyResults.length).toBe(45);
    expect(allQueryResults.length).toBe(45);
  });

  it('matches non-contiguous multi-word tokens in title and across fields', () => {
    // Arrange
    // sampleCatalog has item 5: title "YouTube - Building React Hooks from Scratch"
    // and item 6: title "Advanced Web Architecture", description "Explaining react hooks and state management"

    // Act: Non-contiguous words in item 5 title ("building" and "scratch")
    const nonContiguousTitle = filterAndRankBookmarks(sampleCatalog, 'building scratch');
    expect(nonContiguousTitle.length).toBeGreaterThanOrEqual(1);
    expect(nonContiguousTitle[0].id).toBe('5');

    // Act: Tokens spread across title ("Advanced") and description ("hooks")
    const crossFieldMatches = filterAndRankBookmarks(sampleCatalog, 'advanced hooks');
    expect(crossFieldMatches.some((item) => item.id === '6')).toBe(true);
  });

  it('unmatching items are filtered out even if pinned', () => {
    const customCatalog: SearchBookmarkItem[] = [
      { id: 'unrelated-pinned', title: 'Cooking Recipes', url: 'https://food.com', isPinned: true },
      { id: 'matching', title: 'React Guide', url: 'https://react.dev' },
    ];
    const results = filterAndRankBookmarks(customCatalog, 'react');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('matching');
  });

  describe('searchCatalogFullText & Scope Filtering', () => {
    const fullTextCatalog: SearchBookmarkItem[] = [
      {
        id: 'article-1',
        title: 'Introduction to Physics',
        url: 'https://science.org/physics',
        description: 'General introductory concepts',
        articleContent: 'The fundamental phenomenon of quantum entanglement describes particles interacting across spacetime.',
      },
      {
        id: 'article-2',
        title: 'Quantum Computing Overview',
        url: 'https://tech.io/quantum',
        description: 'Next gen computers',
        articleContent: 'Classical computers use bits, quantum machines utilize qubits.',
      },
      {
        id: 'article-3',
        title: 'Web Performance Optimization',
        url: 'https://web.dev/fast',
        description: 'Rendering latency and memory management',
      },
    ];

    it('matches terms inside full article body even if absent from title and description', () => {
      // Act
      const results = searchCatalogFullText(fullTextCatalog, 'entanglement', 'all');

      // Assert
      expect(results.length).toBe(1);
      expect(results[0].item.id).toBe('article-1');
      expect(results[0].snippet).toBeDefined();
      expect(results[0].snippet?.toLowerCase()).toContain('entanglement');
    });

    it('scope="titles" restricts matches strictly to title and url', () => {
      // Act: 'entanglement' is only in articleContent
      const titleResults = searchCatalogFullText(fullTextCatalog, 'entanglement', 'titles');
      expect(titleResults.length).toBe(0);

      // Act: 'quantum' is in title of article-2
      const matchedTitle = searchCatalogFullText(fullTextCatalog, 'quantum', 'titles');
      expect(matchedTitle.length).toBe(1);
      expect(matchedTitle[0].item.id).toBe('article-2');
    });

    it('scope="articles" targets articleContent and descriptions', () => {
      // Act
      const results = searchCatalogFullText(fullTextCatalog, 'qubits', 'articles');
      expect(results.length).toBe(1);
      expect(results[0].item.id).toBe('article-2');
    });

    it('extractHighlightSnippet produces contextual ellipses around matched terms', () => {
      const longText = 'Before the match ' + 'padding '.repeat(10) + 'CRITICAL_TERM' + ' padding'.repeat(10) + ' after the match';
      const snippet = extractHighlightSnippet(longText, ['critical_term'], 60);

      expect(snippet).toBeDefined();
      expect(snippet).toContain('CRITICAL_TERM');
      expect(snippet?.startsWith('...')).toBe(true);
      expect(snippet?.endsWith('...')).toBe(true);
    });

    it('extractArticleTokens normalizes words and removes punctuation', () => {
      const text = 'Hello, World! Dexie-js v8 article full-text indexing, 2026.';
      const tokens = extractArticleTokens(text);

      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
      expect(tokens).toContain('dexie');
      expect(tokens).toContain('indexing');
      expect(tokens).toContain('2026');
      expect(tokens.every((t) => t.length >= 2)).toBe(true);
    });
  });

  describe('safeParseTimestamp & 5-Tier Sorting', () => {
    it('safeParseTimestamp handles ISO strings, SQLite format, numeric timestamps, and fallbacks', () => {
      expect(safeParseTimestamp('2026-03-01T10:00:00Z')).toBe(new Date('2026-03-01T10:00:00Z').getTime());
      expect(safeParseTimestamp('2026-03-01 10:00:00')).toBeGreaterThan(0);
      expect(safeParseTimestamp(1700000000000)).toBe(1700000000000);
      expect(safeParseTimestamp('1700000000000')).toBe(1700000000000);
      expect(safeParseTimestamp(null)).toBe(0);
      expect(safeParseTimestamp(undefined)).toBe(0);
      expect(safeParseTimestamp('invalid-date-string-xyz')).toBe(0);
    });

    it('sorts bookmarks with sortOption="oldest"', () => {
      const results = filterAndRankBookmarks(sampleCatalog, '', undefined, 10, 'all', 'oldest');
      // Pinned items first, but oldest pinned first
      expect(results[0].isPinned).toBe(true);
      expect(results[0].id).toBe('2'); // 2026-01-02 before 2026-02-10
      expect(results[1].id).toBe('7');

      // Unpinned: oldest first
      expect(results[2].id).toBe('3'); // 2025-12-01
    });

    it('sorts bookmarks with sortOption="alphabetical"', () => {
      const results = filterAndRankBookmarks(sampleCatalog, '', undefined, 10, 'all', 'alphabetical');
      // Pinned items first, sorted A-Z
      expect(results[0].isPinned).toBe(true);
      expect(results[0].title).toBe('Pinned Article About Design');
      expect(results[1].title).toBe('Pinned React Tutorial');

      // Unpinned items sorted A-Z
      expect(results[2].title).toBe('Advanced Web Architecture');
    });

    it('sorts episodic series bookmarks by episode progression', () => {
      const animeCatalog: SearchBookmarkItem[] = [
        { id: 'ep3', title: 'Frieren Ep 3', url: 'https://anime3rb.com/episode/frieren/3', seriesEpisode: 3, createdAt: '2026-01-03' },
        { id: 'ep1', title: 'Frieren Ep 1', url: 'https://anime3rb.com/episode/frieren/1', seriesEpisode: 1, createdAt: '2026-01-01' },
        { id: 'ep2', title: 'Frieren Ep 2', url: 'https://anime3rb.com/episode/frieren/2', seriesEpisode: 2, createdAt: '2026-01-02' },
      ];
      const sorted = filterAndRankBookmarks(animeCatalog, '', undefined, 10, 'all', 'episodic');
      expect(sorted.map(s => s.seriesEpisode)).toEqual([1, 2, 3]);
    });
  });
});
