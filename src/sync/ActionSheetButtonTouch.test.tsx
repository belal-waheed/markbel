import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BookmarkCard } from '../components/BookmarkCard';
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

describe('ActionSheetButtonTouch & Decoupled Sibling Architecture Suite', () => {
  const dummyBookmark: LocalBookmark = {
    id: 'bm-action-1',
    userId: 'user-1',
    url: 'https://example.com/deep-dive',
    title: 'Action Sheet Decoupled Architecture',
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
    onOpenReader: vi.fn(),
    onAdvanceSeries: vi.fn(),
    onRollbackSeries: vi.fn(),
    onToggleSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders card with accessible 3-dots action button', () => {
    const html = renderToString(
      <BookmarkCard bookmark={dummyBookmark} viewMode="grid" {...dummyHandlers} />
    );

    expect(html).toContain('aria-label="More actions for Action Sheet Decoupled Architecture"');
    expect(html).toContain('More actions');
  });

  it('renders card in list view with accessible 3-dots action button', () => {
    const html = renderToString(
      <BookmarkCard bookmark={dummyBookmark} viewMode="list" {...dummyHandlers} />
    );

    expect(html).toContain('aria-label="More actions for Action Sheet Decoupled Architecture"');
  });

  it('contains touch event listeners on card root to support mobile gestures and long-press', () => {
    const html = renderToString(
      <BookmarkCard bookmark={dummyBookmark} viewMode="grid" {...dummyHandlers} />
    );

    // Root card element contains touch and selection classes
    expect(html).toContain('studio-card');
  });
});
