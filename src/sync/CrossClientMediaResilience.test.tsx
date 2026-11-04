import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BookmarkCard } from '../components/BookmarkCard';
import { BookmarkRepository } from '../db/SyncRepository';
import { db, LocalBookmark, SyncOutboxItem, repairMissingMediaThumbnails } from '../db/db';

describe('Cross-Client Media Resilience & Self-Healing Suite', () => {
  describe('1. BookmarkCard Deterministic Thumbnail Fallback', () => {
    const dummyHandlers = {
      onClick: () => {},
      onTogglePin: () => {},
      onToggleRead: () => {},
      onArchive: () => {},
      onEdit: () => {},
      onDelete: () => {},
    };

    it('renders instant YouTube thumbnail when bookmark image is missing (Grid View)', () => {
      const bookmark: LocalBookmark = {
        id: 'bm-yt-1',
        userId: 'user-1',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up',
        group: 'Music',
        image: '',
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
      };

      const html = renderToString(
        <BookmarkCard bookmark={bookmark} viewMode="grid" {...dummyHandlers} />
      );

      expect(html).toContain('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    });

    it('renders instant YouTube thumbnail when bookmark image is missing (List View)', () => {
      const bookmark: LocalBookmark = {
        id: 'bm-yt-2',
        userId: 'user-1',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up',
        group: 'Music',
        image: '',
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
      };

      const html = renderToString(
        <BookmarkCard bookmark={bookmark} viewMode="list" {...dummyHandlers} />
      );

      expect(html).toContain('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    });

    it('prioritizes explicit bookmark image when already present', () => {
      const customImg = 'https://custom-cdn.example.com/cover.jpg';
      const bookmark: LocalBookmark = {
        id: 'bm-yt-3',
        userId: 'user-1',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up',
        group: 'Music',
        image: customImg,
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
      };

      const html = renderToString(
        <BookmarkCard bookmark={bookmark} viewMode="grid" {...dummyHandlers} />
      );

      expect(html).toContain(customImg);
    });

    it('renders instant GitHub social preview when bookmark image is missing', () => {
      const bookmark: LocalBookmark = {
        id: 'bm-gh-1',
        userId: 'user-1',
        url: 'https://github.com/facebook/react',
        title: 'facebook/react',
        group: 'Development',
        image: '',
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
      };

      const html = renderToString(
        <BookmarkCard bookmark={bookmark} viewMode="grid" {...dummyHandlers} />
      );

      expect(html).toContain('https://opengraph.githubassets.com/1/facebook/react');
    });
  });

  describe('2. BookmarkRepository.create Media Enrichment', () => {
    let bookmarkRepo: BookmarkRepository;
    let bookmarksStore: Map<string, LocalBookmark>;
    let outboxStore: Map<string, SyncOutboxItem>;

    beforeEach(() => {
      bookmarkRepo = new BookmarkRepository();
      bookmarksStore = new Map();
      outboxStore = new Map();

      (vi.spyOn(db.bookmarks, 'add') as any).mockImplementation(async (item: any) => {
        bookmarksStore.set(item.id, item);
        return item.id;
      });

      (vi.spyOn(db.syncOutbox, 'add') as any).mockImplementation(async (item: any) => {
        outboxStore.set(item.id, item);
        return item.id;
      });

      (vi.spyOn(db, 'transaction') as any).mockImplementation(async (...args: any[]) => {
        const callback = args[args.length - 1];
        return callback();
      });
    });

    it('enriches YouTube bookmark with thumbnail, siteName, and video contentType', async () => {
      const created = await bookmarkRepo.create({
        id: 'yt-enrich-1',
        userId: 'user-1',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: '',
        group: 'Media',
      });

      expect(created.image).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(created.siteName).toBe('YouTube');
      expect(created.contentType).toBe('video');

      const outbox = outboxStore.get(Array.from(outboxStore.keys())[0]);
      expect(outbox?.payload.image).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    });

    it('enriches GitHub repository bookmark title, siteName, and open graph image', async () => {
      const rawUrl = 'https://github.com/belal-waheed/markbel';
      const created = await bookmarkRepo.create({
        id: 'gh-enrich-1',
        userId: 'user-1',
        url: rawUrl,
        title: rawUrl, // URL as fallback title should be replaced by instant title
        group: 'Code',
      });

      expect(created.image).toBe('https://opengraph.githubassets.com/1/belal-waheed/markbel');
      expect(created.title).toBe('belal-waheed/markbel');
      expect(created.siteName).toBe('GitHub');
      expect(created.contentType).toBe('website');
    });

    it('preserves existing custom title, image, and description if already provided', async () => {
      const created = await bookmarkRepo.create({
        id: 'custom-1',
        userId: 'user-1',
        url: 'https://github.com/belal-waheed/markbel',
        title: 'My Custom Markbel Fork',
        image: 'https://example.com/custom.png',
        description: 'Custom description text',
        siteName: 'Internal Git',
        group: 'Work',
      });

      expect(created.image).toBe('https://example.com/custom.png');
      expect(created.title).toBe('My Custom Markbel Fork');
      expect(created.description).toBe('Custom description text');
      expect(created.siteName).toBe('Internal Git');
    });
  });

  describe('3. Database Self-Healing (repairMissingMediaThumbnails)', () => {
    let mockBookmarks: LocalBookmark[];
    let updatedRecords: { id: string; changes: any }[];

    beforeEach(() => {
      updatedRecords = [];
      mockBookmarks = [
        {
          id: 'b-yt',
          userId: 'u1',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'YouTube Video',
          group: 'Video',
          image: '',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
        {
          id: 'b-gh',
          userId: 'u1',
          url: 'https://github.com/facebook/react',
          title: 'React',
          group: 'Dev',
          image: '',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
        {
          id: 'b-normal',
          userId: 'u1',
          url: 'https://example.com/article/123',
          title: 'Article',
          group: 'Reading',
          image: '',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
        {
          id: 'b-has-img',
          userId: 'u1',
          url: 'https://www.youtube.com/watch?v=alreadyHasImage',
          title: 'Already Has Image',
          group: 'Video',
          image: 'https://custom.com/thumb.jpg',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
        {
          id: 'b-deleted',
          userId: 'u1',
          url: 'https://www.youtube.com/watch?v=deletedVideo',
          title: 'Deleted Video',
          group: 'Video',
          image: '',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: '2026-01-02T00:00:00Z',
        },
      ];

      (vi.spyOn(db.bookmarks, 'filter') as any).mockImplementation((filterFn: any) => {
        const filtered = mockBookmarks.filter(filterFn);
        return {
          toArray: async () => filtered,
        } as any;
      });

      (vi.spyOn(db.bookmarks, 'update') as any).mockImplementation(async (id: any, changes: any) => {
        updatedRecords.push({ id: id as string, changes });
        return 1;
      });
    });

    it('identifies and repairs missing thumbnails for active bookmarks without images', async () => {
      const repairedCount = await repairMissingMediaThumbnails();

      // Only b-yt and b-gh should be repaired (b-normal has no instant image heuristic, b-has-img has image, b-deleted is deleted)
      expect(repairedCount).toBe(2);
      expect(updatedRecords).toHaveLength(2);

      const ytUpdate = updatedRecords.find((r) => r.id === 'b-yt');
      expect(ytUpdate?.changes.image).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(ytUpdate?.changes.siteName).toBe('YouTube');
      expect(ytUpdate?.changes.contentType).toBe('video');

      const ghUpdate = updatedRecords.find((r) => r.id === 'b-gh');
      expect(ghUpdate?.changes.image).toBe('https://opengraph.githubassets.com/1/facebook/react');
      expect(ghUpdate?.changes.siteName).toBe('GitHub');
    });
  });
});
