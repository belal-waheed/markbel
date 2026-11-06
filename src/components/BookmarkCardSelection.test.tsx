import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BookmarkCard } from './BookmarkCard';
import { LocalBookmark } from '../db/db';

vi.mock('../lib/nativeBridge', () => ({
  hapticImpact: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticSelection: vi.fn(),
  hideKeyboard: vi.fn(),
  shareUrl: vi.fn().mockResolvedValue({ shared: true, method: 'native' }),
}));

vi.mock('../lib/useModalBackNavigation', () => ({
  useModalBackNavigation: vi.fn(),
}));

describe('BookmarkCard Selection & Long-Press Guard Suite', () => {
  const dummyBookmark: LocalBookmark = {
    id: 'bm-select-1',
    userId: 'user-1',
    url: 'https://example.com/item',
    title: 'Guarded Selection Item',
    group: 'Default',
    image: '',
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
  };

  const dummyHandlers = {
    onClick: vi.fn(),
    onTogglePin: vi.fn(),
    onToggleRead: vi.fn(),
    onArchive: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders selection ring when isSelected is true in grid view', () => {
    const html = renderToString(
      <BookmarkCard
        bookmark={dummyBookmark}
        viewMode="grid"
        isSelected={true}
        selectionMode={true}
        {...dummyHandlers}
      />
    );

    expect(html).toContain('ring-2 ring-[var(--color-accent)]');
  });

  it('renders selection ring when isSelected is true in list view', () => {
    const html = renderToString(
      <BookmarkCard
        bookmark={dummyBookmark}
        viewMode="list"
        isSelected={true}
        selectionMode={true}
        {...dummyHandlers}
      />
    );

    expect(html).toContain('ring-2 ring-[var(--color-accent)]');
  });

  it('renders checkbox visibly when selectionMode is true', () => {
    const html = renderToString(
      <BookmarkCard
        bookmark={dummyBookmark}
        viewMode="grid"
        isSelected={false}
        selectionMode={true}
        {...dummyHandlers}
      />
    );

    expect(html).toContain('w-4 h-4 rounded flex items-center justify-center border');
  });
});
