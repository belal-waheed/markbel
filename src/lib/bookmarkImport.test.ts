import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DOMParser } from 'linkedom';
import { importBookmarksData } from './bookmarkImport';
import { db, LocalBookmark, LocalGroup, SyncOutboxItem } from '../db/db';

if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = DOMParser as any;
}

describe('Bookmark & Group Importer Subsystem (JSON & Netscape HTML)', () => {
  let bookmarksStore: Map<string, LocalBookmark>;
  let groupsStore: Map<string, LocalGroup>;
  let outboxStore: Map<string, SyncOutboxItem>;

  beforeEach(() => {
    bookmarksStore = new Map();
    groupsStore = new Map();
    outboxStore = new Map();

    (vi.spyOn(db.bookmarks, 'toArray') as any).mockImplementation(async () => {
      return Array.from(bookmarksStore.values());
    });

    (vi.spyOn(db.bookmarks, 'add') as any).mockImplementation(async (item: any) => {
      bookmarksStore.set(item.id, item);
      return item.id;
    });

    (vi.spyOn(db.groups, 'toArray') as any).mockImplementation(async () => {
      return Array.from(groupsStore.values());
    });

    (vi.spyOn(db.groups, 'add') as any).mockImplementation(async (item: any) => {
      groupsStore.set(item.id, item);
      return item.id;
    });

    (vi.spyOn(db.syncOutbox, 'add') as any).mockImplementation(async (item: any) => {
      outboxStore.set(item.id, item);
      return item.id;
    });

    (vi.spyOn(db, 'transaction') as any).mockImplementation(async (...args: any[]) => {
      const callback = args[args.length - 1];
      return await callback();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Netscape HTML Import Engine', () => {
    it('extracts <A ICON="..."> attribute as favicon and groups by <H3> header', async () => {
      const sampleHtml = `
        <!DOCTYPE NETSCAPE-Bookmark-file-1>
        <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
        <TITLE>Bookmarks</TITLE>
        <H1>Bookmarks</H1>
        <DL><p>
          <DT><H3>Engineering</H3>
          <DL><p>
            <DT><A HREF="https://example.com/docs" ICON="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" ADD_DATE="1600000000">Example Docs</A>
          </DL><p>
        </DL><p>
      `;

      const result = await importBookmarksData(sampleHtml, { userId: 'test-user', isJson: false });

      expect(result.importedBookmarksCount).toBe(1);
      expect(result.importedGroupsCount).toBe(1);

      const imported = Array.from(bookmarksStore.values())[0];
      expect(imported).toBeDefined();
      expect(imported.url).toBe('https://example.com/docs');
      expect(imported.title).toBe('Example Docs');
      expect(imported.group).toBe('Engineering');
      expect(imported.favicon).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');

      // Verify sync outbox enqueue
      expect(outboxStore.size).toBe(2); // 1 group + 1 bookmark
    });

    it('auto-populates instant YouTube poster at 0ms when importing YouTube video link', async () => {
      const sampleHtml = `
        <!DOCTYPE NETSCAPE-Bookmark-file-1>
        <TITLE>Bookmarks</TITLE>
        <DL><p>
          <DT><H3>Media</H3>
          <DL><p>
            <DT><A HREF="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Rick Astley Video</A>
          </DL><p>
        </DL><p>
      `;

      const result = await importBookmarksData(sampleHtml, { userId: 'test-user', isJson: false });

      expect(result.importedBookmarksCount).toBe(1);
      const imported = Array.from(bookmarksStore.values())[0];
      expect(imported.image).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(imported.contentType).toBe('video');
      expect(imported.siteName).toBe('YouTube');
    });

    it('skips existing URLs (case-insensitive deduplication) and javascript: schemes', async () => {
      bookmarksStore.set('existing-1', {
        id: 'existing-1',
        userId: 'test-user',
        url: 'https://github.com/existing/repo',
        title: 'Existing Repo',
        group: 'Dev',
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
      });

      const sampleHtml = `
        <!DOCTYPE NETSCAPE-Bookmark-file-1>
        <DL><p>
          <DT><A HREF="javascript:void(0)">JS Bookmarklet</A>
          <DT><A HREF="https://GITHUB.COM/existing/repo">Duplicate Uppercase Repo</A>
          <DT><A HREF="https://github.com/facebook/react">New React Repo</A>
        </DL><p>
      `;

      const result = await importBookmarksData(sampleHtml, { userId: 'test-user', isJson: false });

      expect(result.importedBookmarksCount).toBe(1);
      const imported = Array.from(bookmarksStore.values()).find((b) => b.url === 'https://github.com/facebook/react');
      expect(imported).toBeDefined();
      expect(imported?.image).toBe('https://opengraph.githubassets.com/1/facebook/react');
    });
  });

  describe('2. Markbel JSON Backup Import Engine', () => {
    it('restores full Markbel JSON backup format with groups and metadata', async () => {
      const backupJson = JSON.stringify({
        app: 'Markbel',
        version: '2.5.19',
        exportedAt: '2026-11-04T00:00:00.000Z',
        totalBookmarks: 2,
        totalGroups: 1,
        groups: [
          {
            id: 'g-dev',
            userId: 'old-user',
            name: 'Development',
            color: '#10b981',
            version: 1,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            deletedAt: null,
          },
        ],
        bookmarks: [
          {
            id: 'b-1',
            url: 'https://vite.dev',
            title: 'Vite Next Generation Frontend Tooling',
            description: 'Get ready for a development environment that can finally catch up to you.',
            image: 'https://vite.dev/og-image.png',
            favicon: 'https://vite.dev/logo.svg',
            group: 'Development',
            isPinned: true,
            isRead: false,
            isArchived: false,
            contentType: 'website',
          },
          {
            id: 'b-2',
            url: 'https://www.youtube.com/watch?v=xyz12345678',
            title: 'Tech Talk Video',
            group: 'Development',
            // image omitted intentionally to verify auto-enrichment
          },
        ],
      });

      const result = await importBookmarksData(backupJson, { userId: 'new-user' });

      expect(result.importedBookmarksCount).toBe(2);
      expect(result.importedGroupsCount).toBe(1);

      const viteBookmark = Array.from(bookmarksStore.values()).find((b) => b.url === 'https://vite.dev');
      expect(viteBookmark).toBeDefined();
      expect(viteBookmark?.userId).toBe('new-user');
      expect(viteBookmark?.image).toBe('https://vite.dev/og-image.png');
      expect(viteBookmark?.favicon).toBe('https://vite.dev/logo.svg');
      expect(viteBookmark?.isPinned).toBe(true);

      const ytBookmark = Array.from(bookmarksStore.values()).find((b) => b.url.includes('xyz12345678'));
      expect(ytBookmark).toBeDefined();
      expect(ytBookmark?.image).toBe('https://img.youtube.com/vi/xyz12345678/hqdefault.jpg');
      expect(ytBookmark?.contentType).toBe('video');
    });

    it('restores raw array of bookmark objects without groups envelope', async () => {
      const rawArrayJson = JSON.stringify([
        {
          url: 'https://news.ycombinator.com',
          title: 'Hacker News',
          group: 'Tech News',
          favicon: 'https://news.ycombinator.com/favicon.ico',
        },
      ]);

      const result = await importBookmarksData(rawArrayJson, { userId: 'user-array' });

      expect(result.importedBookmarksCount).toBe(1);
      expect(result.importedGroupsCount).toBe(1); // Auto-created 'Tech News' group

      const hn = Array.from(bookmarksStore.values())[0];
      expect(hn.url).toBe('https://news.ycombinator.com');
      expect(hn.group).toBe('Tech News');
      expect(hn.favicon).toBe('https://news.ycombinator.com/favicon.ico');
    });

    it('rejects empty or malformed JSON payloads gracefully', async () => {
      await expect(importBookmarksData('', { isJson: true })).rejects.toThrow('empty');
      await expect(importBookmarksData('{ invalid json', { isJson: true })).rejects.toThrow('Failed to parse JSON');
    });
  });
});
