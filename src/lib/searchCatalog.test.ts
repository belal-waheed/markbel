import { describe, it, expect } from 'vitest';
import { filterAndRankBookmarks, SearchBookmarkItem } from './searchCatalog';

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

  it('unmatching items are filtered out even if pinned', () => {
    const customCatalog: SearchBookmarkItem[] = [
      { id: 'unrelated-pinned', title: 'Cooking Recipes', url: 'https://food.com', isPinned: true },
      { id: 'matching', title: 'React Guide', url: 'https://react.dev' },
    ];
    const results = filterAndRankBookmarks(customCatalog, 'react');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('matching');
  });
});
