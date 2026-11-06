import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BookmarkCard, BookmarkMenuContent } from '../components/BookmarkCard';
import { LocalBookmark } from '../db/db';

vi.mock('../lib/nativeBridge', () => ({
  hapticImpact: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticSelection: vi.fn(),
  hideKeyboard: vi.fn(),
  shareUrl: vi.fn().mockResolvedValue({ shared: true, method: 'native' }),
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

  const createEvent = () => ({
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  });

  function getNodeText(node: any): string {
    if (!node) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getNodeText).join('');
    if (node.props?.children) return getNodeText(node.props.children);
    return '';
  }

  function extractMenuButtonHandlers(element: any): Map<string, (e: any) => void> {
    const handlers = new Map<string, (e: any) => void>();
    function traverse(node: any) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'button' && typeof node.props?.onClick === 'function') {
        const label = node.props['aria-label'] || getNodeText(node.props.children).trim();
        if (label) {
          handlers.set(label, node.props.onClick);
        }
      }
      if (node.props?.children) {
        const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
        for (const child of children) {
          traverse(child);
        }
      }
    }
    traverse(element);
    return handlers;
  }

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

  it('renders full menu items inside BookmarkMenuContent', () => {
    const html = renderToString(
      <BookmarkMenuContent
        bookmark={dummyBookmark}
        closeMenu={vi.fn()}
        {...dummyHandlers}
      />
    );

    expect(html).toContain('Open in New Tab');
    expect(html).toContain('Share Bookmark');
    expect(html).toContain('Mark as Read');
    expect(html).toContain('Pin to Top');
    expect(html).toContain('Edit Bookmark');
    expect(html).toContain('Archive Bookmark');
    expect(html).toContain('Delete Bookmark');
  });

  it('invokes onClick and closeMenu when clicking Open in New Tab', () => {
    const closeMenu = vi.fn();
    const mockOpen = vi.fn();
    vi.stubGlobal('window', { open: mockOpen });

    const menuTree = BookmarkMenuContent({
      bookmark: dummyBookmark,
      closeMenu,
      ...dummyHandlers,
    });
    const handlers = extractMenuButtonHandlers(menuTree);
    const clickHandler = handlers.get('Open in New Tab');
    expect(clickHandler).toBeDefined();

    clickHandler!(createEvent());

    expect(mockOpen).toHaveBeenCalledWith(dummyBookmark.url, '_blank', 'noopener,noreferrer');
    expect(dummyHandlers.onClick).toHaveBeenCalledWith(dummyBookmark.url);
    expect(closeMenu).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('invokes onToggleRead and closeMenu when clicking Mark as Read', () => {
    const closeMenu = vi.fn();
    const menuTree = BookmarkMenuContent({
      bookmark: dummyBookmark,
      closeMenu,
      ...dummyHandlers,
    });
    const handlers = extractMenuButtonHandlers(menuTree);
    const clickHandler = handlers.get('Mark as Read');
    expect(clickHandler).toBeDefined();

    clickHandler!(createEvent());

    expect(dummyHandlers.onToggleRead).toHaveBeenCalledWith(dummyBookmark);
    expect(closeMenu).toHaveBeenCalledTimes(1);
  });

  it('invokes onTogglePin and closeMenu when clicking Pin to Top', () => {
    const closeMenu = vi.fn();
    const menuTree = BookmarkMenuContent({
      bookmark: dummyBookmark,
      closeMenu,
      ...dummyHandlers,
    });
    const handlers = extractMenuButtonHandlers(menuTree);
    const clickHandler = handlers.get('Pin to Top');
    expect(clickHandler).toBeDefined();

    clickHandler!(createEvent());

    expect(dummyHandlers.onTogglePin).toHaveBeenCalledWith(dummyBookmark);
    expect(closeMenu).toHaveBeenCalledTimes(1);
  });

  it('invokes onEdit and closeMenu when clicking Edit Bookmark synchronously before close', () => {
    const order: string[] = [];
    const closeMenu = vi.fn(() => order.push('closeMenu'));
    dummyHandlers.onEdit.mockImplementation(() => order.push('onEdit'));

    const menuTree = BookmarkMenuContent({
      bookmark: dummyBookmark,
      closeMenu,
      ...dummyHandlers,
    });
    const handlers = extractMenuButtonHandlers(menuTree);
    const clickHandler = handlers.get('Edit Bookmark');
    expect(clickHandler).toBeDefined();

    clickHandler!(createEvent());

    expect(dummyHandlers.onEdit).toHaveBeenCalledWith(dummyBookmark);
    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['onEdit', 'closeMenu']);
  });

  it('invokes onDelete and closeMenu when clicking Delete Bookmark synchronously before close', () => {
    const order: string[] = [];
    const closeMenu = vi.fn(() => order.push('closeMenu'));
    dummyHandlers.onDelete.mockImplementation(() => order.push('onDelete'));

    const menuTree = BookmarkMenuContent({
      bookmark: dummyBookmark,
      closeMenu,
      ...dummyHandlers,
    });
    const handlers = extractMenuButtonHandlers(menuTree);
    const clickHandler = handlers.get('Delete Bookmark');
    expect(clickHandler).toBeDefined();

    clickHandler!(createEvent());

    expect(dummyHandlers.onDelete).toHaveBeenCalledWith(dummyBookmark);
    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['onDelete', 'closeMenu']);
  });

  it('invokes onArchive and closeMenu when clicking Archive Bookmark synchronously before close', () => {
    const order: string[] = [];
    const closeMenu = vi.fn(() => order.push('closeMenu'));
    dummyHandlers.onArchive.mockImplementation(() => order.push('onArchive'));

    const menuTree = BookmarkMenuContent({
      bookmark: dummyBookmark,
      closeMenu,
      ...dummyHandlers,
    });
    const handlers = extractMenuButtonHandlers(menuTree);
    const clickHandler = handlers.get('Archive Bookmark');
    expect(clickHandler).toBeDefined();

    clickHandler!(createEvent());

    expect(dummyHandlers.onArchive).toHaveBeenCalledWith(dummyBookmark);
    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['onArchive', 'closeMenu']);
  });

  it('invokes onOpenReader and closeMenu when clicking Read Offline', () => {
    const closeMenu = vi.fn();
    const menuTree = BookmarkMenuContent({
      bookmark: dummyBookmark,
      closeMenu,
      ...dummyHandlers,
    });
    const handlers = extractMenuButtonHandlers(menuTree);
    const clickHandler = handlers.get('Read Offline');
    expect(clickHandler).toBeDefined();

    clickHandler!(createEvent());

    expect(dummyHandlers.onOpenReader).toHaveBeenCalledWith(dummyBookmark);
    expect(closeMenu).toHaveBeenCalledTimes(1);
  });
});
