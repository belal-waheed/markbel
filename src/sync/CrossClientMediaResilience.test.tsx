import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BookmarkCard } from '../components/BookmarkCard';
import { BookmarkRepository } from '../db/SyncRepository';
import { db, LocalBookmark, SyncOutboxItem, repairMissingMediaThumbnails, repairAndEnrichBookmarkThumbnails } from '../db/db';
import { importBookmarksData } from '../lib/bookmarkImport';
import { DOMParser } from 'linkedom';

if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = DOMParser as any;
}

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

    it('repairAndEnrichBookmarkThumbnails scrubs polluted favicons and restores instant posters', async () => {
      let bulkPutPayload: LocalBookmark[] = [];
      (vi.spyOn(db.bookmarks, 'bulkPut') as any).mockImplementation(async (items: any) => {
        bulkPutPayload = items;
        return items.map((i: any) => i.id);
      });

      const pollutedBookmarks: LocalBookmark[] = [
        {
          id: 'b-polluted-yt',
          userId: 'u1',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'YouTube Video',
          group: 'Video',
          image: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=128',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
        {
          id: 'b-polluted-article',
          userId: 'u1',
          url: 'https://example.com/article',
          title: 'Generic Article',
          group: 'Reading',
          image: 'https://www.google.com/s2/favicons?domain=example.com&sz=128',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
        {
          id: 'b-clean-real-img',
          userId: 'u1',
          url: 'https://example.com/photo',
          title: 'Photo',
          group: 'Reading',
          image: 'https://cdn.example.com/photo.jpg',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
        {
          id: 'b-deleted-polluted',
          userId: 'u1',
          url: 'https://www.youtube.com/watch?v=xyz',
          title: 'Deleted',
          group: 'Video',
          image: 'https://www.google.com/s2/favicons?domain=youtube.com',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: '2026-01-02T00:00:00Z',
        },
      ];

      (vi.spyOn(db.bookmarks, 'filter') as any).mockImplementation((filterFn: any) => {
        const filtered = pollutedBookmarks.filter(filterFn);
        return {
          toArray: async () => filtered,
        } as any;
      });

      const count = await repairAndEnrichBookmarkThumbnails();

      // b-polluted-yt (replaces favicon with YouTube poster) and b-polluted-article (clears favicon)
      expect(count).toBe(2);
      expect(bulkPutPayload).toHaveLength(2);

      const ytRepaired = bulkPutPayload.find((b) => b.id === 'b-polluted-yt');
      expect(ytRepaired?.image).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(ytRepaired?.siteName).toBe('YouTube');
      expect(ytRepaired?.contentType).toBe('video');

      const articleRepaired = bulkPutPayload.find((b) => b.id === 'b-polluted-article');
      expect(articleRepaired?.image).toBeUndefined();
    });

    it('repairAndEnrichBookmarkThumbnails purges video stream URLs and private IP favicons', async () => {
      let bulkPutPayload: LocalBookmark[] = [];
      (vi.spyOn(db.bookmarks, 'bulkPut') as any).mockImplementation(async (items: any) => {
        bulkPutPayload = items;
        return items.map((i: any) => i.id);
      });

      const bookmarks: LocalBookmark[] = [
        {
          id: 'b-vid-stream',
          userId: 'u1',
          url: 'https://example.com/stream-page',
          title: 'Stream',
          group: 'Video',
          image: 'https://video.vid3rb.com/video/b515cf5f-6a75-4ee4-b6d9-cf6368d40be6',
          favicon: 'https://example.com/favicon.ico',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
        {
          id: 'b-private-ip-fav',
          userId: 'u1',
          url: 'http://192.168.1.1/dashboard',
          title: 'Router',
          group: 'Tech',
          favicon: 'http://192.168.1.1/favicon.ico',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
        {
          id: 'b-google-s2-private-fav',
          userId: 'u1',
          url: 'http://10.0.0.1/admin',
          title: 'Internal Admin',
          group: 'Tech',
          favicon: 'https://www.google.com/s2/favicons?domain=10.0.0.1&sz=128',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
      ];

      (vi.spyOn(db.bookmarks, 'filter') as any).mockImplementation((filterFn: any) => {
        const filtered = bookmarks.filter(filterFn);
        return {
          toArray: async () => filtered,
        } as any;
      });

      const count = await repairAndEnrichBookmarkThumbnails();
      expect(count).toBe(3);

      const vidRepaired = bulkPutPayload.find((b) => b.id === 'b-vid-stream');
      expect(vidRepaired?.image).toBeUndefined();

      const routerRepaired = bulkPutPayload.find((b) => b.id === 'b-private-ip-fav');
      expect(routerRepaired?.favicon).toBeUndefined();

      const s2Repaired = bulkPutPayload.find((b) => b.id === 'b-google-s2-private-fav');
      expect(s2Repaired?.favicon).toBeUndefined();
    });
  });

  describe('4. Bookmark Import Resilience & Metadata Enrichment (HTML & JSON)', () => {
    let importedBookmarks: Map<string, LocalBookmark>;
    let importedGroups: Map<string, any>;
    let queuedOutbox: any[];

    beforeEach(() => {
      importedBookmarks = new Map();
      importedGroups = new Map();
      queuedOutbox = [];

      (vi.spyOn(db.bookmarks, 'toArray') as any).mockImplementation(async () => Array.from(importedBookmarks.values()));
      (vi.spyOn(db.bookmarks, 'add') as any).mockImplementation(async (b: any) => {
        importedBookmarks.set(b.id, b);
        return b.id;
      });
      (vi.spyOn(db.groups, 'toArray') as any).mockImplementation(async () => Array.from(importedGroups.values()));
      (vi.spyOn(db.groups, 'add') as any).mockImplementation(async (g: any) => {
        importedGroups.set(g.id, g);
        return g.id;
      });
      (vi.spyOn(db.syncOutbox, 'add') as any).mockImplementation(async (item: any) => {
        queuedOutbox.push(item);
        return item.id;
      });
      (vi.spyOn(db, 'transaction') as any).mockImplementation(async (...args: any[]) => {
        const fn = args[args.length - 1];
        return await fn();
      });
    });

    it('extracts favicon from Netscape HTML <A ICON="..."> attribute', async () => {
      const html = `
        <!DOCTYPE NETSCAPE-Bookmark-file-1>
        <DL><p>
          <DT><H3>Tools</H3>
          <DL><p>
            <DT><A HREF="https://example.com/tool" ICON="data:image/svg+xml;base64,PHN2Zz4=">Tool Title</A>
          </DL><p>
        </DL><p>
      `;

      const res = await importBookmarksData(html, { userId: 'u-1', isJson: false });
      expect(res.importedBookmarksCount).toBe(1);

      const bm = Array.from(importedBookmarks.values())[0];
      expect(bm.favicon).toBe('data:image/svg+xml;base64,PHN2Zz4=');
      expect(bm.group).toBe('Tools');
    });

    it('auto-populates YouTube cover poster at 0ms during Netscape HTML import', async () => {
      const html = `
        <!DOCTYPE NETSCAPE-Bookmark-file-1>
        <DL><p>
          <DT><A HREF="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Never Gonna Give You Up</A>
        </DL><p>
      `;

      const res = await importBookmarksData(html, { userId: 'u-1', isJson: false });
      expect(res.importedBookmarksCount).toBe(1);

      const bm = Array.from(importedBookmarks.values())[0];
      expect(bm.image).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(bm.contentType).toBe('video');
      expect(bm.siteName).toBe('YouTube');
    });

    it('parses and restores full Markbel JSON backup format with groups and metadata', async () => {
      const json = JSON.stringify({
        app: 'Markbel',
        version: '2.5.19',
        exportedAt: '2026-11-04T00:00:00.000Z',
        totalBookmarks: 1,
        totalGroups: 1,
        groups: [{ id: 'g-1', name: 'Design', color: '#ff0055' }],
        bookmarks: [
          {
            id: 'b-json-1',
            url: 'https://figma.com',
            title: 'Figma',
            image: 'https://figma.com/og.png',
            favicon: 'https://figma.com/icon.png',
            group: 'Design',
            isPinned: true,
          },
        ],
      });

      const res = await importBookmarksData(json, { userId: 'u-1' });
      expect(res.importedBookmarksCount).toBe(1);
      expect(res.importedGroupsCount).toBe(1);

      const bm = Array.from(importedBookmarks.values())[0];
      expect(bm.url).toBe('https://figma.com');
      expect(bm.image).toBe('https://figma.com/og.png');
      expect(bm.favicon).toBe('https://figma.com/icon.png');
      expect(bm.group).toBe('Design');
      expect(bm.isPinned).toBe(true);
    });
  });
});
