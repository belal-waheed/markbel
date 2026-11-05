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

describe('BookmarkCard Touch & Ghost-Click Elimination Suite', () => {
  const dummyBookmark: LocalBookmark = {
    id: 'bm-test-1',
    userId: 'user-1',
    url: 'https://example.com/article',
    title: 'Testing Ghost Click Defense',
    group: 'Engineering',
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders typography editorial card with accessible 3-dots action button', () => {
    const html = renderToString(
      <BookmarkCard bookmark={dummyBookmark} viewMode="grid" {...dummyHandlers} />
    );

    expect(html).toContain('Testing Ghost Click Defense');
    expect(html).toContain('aria-label="More actions for Testing Ghost Click Defense"');
  });

  it('renders list view row with accessible 3-dots action button', () => {
    const html = renderToString(
      <BookmarkCard bookmark={dummyBookmark} viewMode="list" {...dummyHandlers} />
    );

    expect(html).toContain('Testing Ghost Click Defense');
    expect(html).toContain('aria-label="More actions for Testing Ghost Click Defense"');
  });

  it('renders hero media card with accessible 3-dots action button when hero image is present', () => {
    const heroBookmark: LocalBookmark = {
      ...dummyBookmark,
      image: 'https://images.unsplash.com/photo-test',
    };

    const html = renderToString(
      <BookmarkCard bookmark={heroBookmark} viewMode="grid" {...dummyHandlers} />
    );

    expect(html).toContain('Testing Ghost Click Defense');
    expect(html).toContain('aria-label="More actions for Testing Ghost Click Defense"');
  });
});
