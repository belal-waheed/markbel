import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BrowserBookmarkSyncEngine,
  MARKBEL_VAULT_FOLDER_TITLE,
  STORAGE_KEY_TWO_WAY_SYNC,
  STORAGE_KEY_NODE_URL_MAP,
} from '../../extension/src/bookmarkSync';
import { db } from '../../src/db/db';

describe('Phase 18: Extension Two-Way Native Browser Bookmarks Sync Suite', () => {
  let engine: BrowserBookmarkSyncEngine;
  let mockStorage: Record<string, any>;
  let mockBookmarksTree: any[];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockStorage = {};
    mockBookmarksTree = [
      {
        id: '0',
        title: 'Root',
        children: [
          {
            id: '1',
            title: 'Bookmarks Bar',
            children: [
              {
                id: '10',
                title: MARKBEL_VAULT_FOLDER_TITLE,
                children: [
                  {
                    id: '101',
                    title: 'Dev',
                    children: [
                      {
                        id: '1001',
                        title: 'React Documentation',
                        url: 'https://react.dev',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    // Mock chrome global
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn((keys, cb) => {
            const key = Array.isArray(keys) ? keys[0] : keys;
            cb({ [key]: mockStorage[key] });
          }),
          set: vi.fn((items, cb) => {
            Object.assign(mockStorage, items);
            if (cb) cb();
          }),
        },
      },
      bookmarks: {
        getTree: vi.fn().mockResolvedValue(mockBookmarksTree),
        search: vi.fn().mockImplementation((query) => {
          if (query.title === MARKBEL_VAULT_FOLDER_TITLE) {
            return Promise.resolve([{ id: '10', title: MARKBEL_VAULT_FOLDER_TITLE }]);
          }
          return Promise.resolve([]);
        }),
        get: vi.fn().mockImplementation((id: string) => {
          if (id === '101') {
            return Promise.resolve([{ id: '101', title: 'Dev', parentId: '10' }]);
          }
          if (id === '10') {
            return Promise.resolve([{ id: '10', title: MARKBEL_VAULT_FOLDER_TITLE, parentId: '1' }]);
          }
          return Promise.resolve([]);
        }),
        getChildren: vi.fn().mockResolvedValue([{ id: '101', title: 'Dev' }]),
        getSubTree: vi.fn().mockResolvedValue([
          {
            id: '10',
            title: MARKBEL_VAULT_FOLDER_TITLE,
            children: [{ id: '101', title: 'Dev', children: [{ url: 'https://react.dev' }] }],
          },
        ]),
        create: vi.fn().mockImplementation((node) => {
          return Promise.resolve({ id: `mock-${Date.now()}`, ...node });
        }),
      },
    };

    engine = new BrowserBookmarkSyncEngine();
  });

  it('stores and reads two-way sync enabled preference', async () => {
    // Initially false
    expect(await engine.isEnabled()).toBe(false);

    // Enable
    await engine.setEnabled(true);
    expect(await engine.isEnabled()).toBe(true);
    expect(mockStorage[STORAGE_KEY_TWO_WAY_SYNC]).toBe(true);
  });

  it('detects when bookmark is inside "Markbel Vault" hierarchy', async () => {
    // Parent 10 is root "Markbel Vault"
    const inRoot = await engine.isInsideVaultFolder('10');
    expect(inRoot.inside).toBe(true);

    // Parent 101 is subfolder "Dev" inside "Markbel Vault"
    const inSubfolder = await engine.isInsideVaultFolder('101');
    expect(inSubfolder.inside).toBe(true);
    expect(inSubfolder.group).toBe('Dev');

    // Random parent outside vault
    const outside = await engine.isInsideVaultFolder('999');
    expect(outside.inside).toBe(false);
  });

  it('prevents loop execution when isSyncing is active during reflection', async () => {
    await engine.setEnabled(true);

    const bookmarks = [
      {
        id: 'new-bm-1',
        userId: 'user-1',
        title: 'New Page',
        url: 'https://newpage.com',
        group: 'Dev',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      },
    ];

    // Reflect should set isSyncing = true during reflection
    const reflected = await engine.reflectCloudBookmarksToBrowser(bookmarks);
    expect(reflected).toBe(1);
    expect(engine.getIsSyncing()).toBe(false);
  });

  it('skips duplicate URLs during browser bookmarks reflection', async () => {
    await engine.setEnabled(true);

    // Already exists in mockBookmarksTree: 'https://react.dev'
    const bookmarks = [
      {
        id: 'dup-1',
        userId: 'user-1',
        title: 'React Documentation',
        url: 'https://react.dev',
        group: 'Dev',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      },
    ];

    const reflected = await engine.reflectCloudBookmarksToBrowser(bookmarks);
    expect(reflected).toBe(0);
  });

  it('records, queries, and clears browserNodeIdToUrlMap in storage', async () => {
    // Act: record node URLs
    await engine.recordNodeUrl('node-123', 'https://example.com/page1');
    await engine.recordNodeUrl('node-456', 'https://example.com/page2');

    // Assert
    const map = await engine.getNodeUrlMap();
    expect(map['node-123']).toBe('https://example.com/page1');
    expect(map['node-456']).toBe('https://example.com/page2');

    // Remove one node
    const removedUrl = await engine.removeNodeUrl('node-123');
    expect(removedUrl).toBe('https://example.com/page1');

    const updatedMap = await engine.getNodeUrlMap();
    expect(updatedMap['node-123']).toBeUndefined();
    expect(updatedMap['node-456']).toBe('https://example.com/page2');
  });

  it('handleNativeRemoved soft-deletes bookmark using persistent mapping when removeInfo.node is undefined', async () => {
    await engine.setEnabled(true);

    const testUrl = 'https://vitest.dev/guide';
    const testBookmark = {
      id: 'test-bm-vitest',
      userId: 'user-1',
      title: 'Vitest Guide',
      url: testUrl,
      group: 'Dev',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    const mockDbBookmarks: any[] = [testBookmark];
    const mockOutbox: any[] = [];

    (vi.spyOn(db.bookmarks, 'where') as any).mockImplementation((key: string) => {
      return {
        equals: (val: any) => ({
          first: async () => mockDbBookmarks.find((b) => b[key] === val),
        }),
      } as any;
    });

    (vi.spyOn(db.bookmarks, 'put') as any).mockImplementation(async (item: any) => {
      const idx = mockDbBookmarks.findIndex((b) => b.id === item.id);
      if (idx >= 0) mockDbBookmarks[idx] = item;
      else mockDbBookmarks.push(item);
      return item.id;
    });

    (vi.spyOn(db.syncOutbox, 'add') as any).mockImplementation(async (item: any) => {
      mockOutbox.push(item);
      return item.id;
    });

    // Pre-record mapping for native node 'native-999'
    await engine.recordNodeUrl('native-999', testUrl);

    // Act: Chrome calls onRemoved with parentId in Vault, but node is undefined!
    await engine.handleNativeRemoved('native-999', {
      parentId: '101', // Dev subfolder
    });

    // Assert: bookmark was soft-deleted in Dexie
    expect(mockDbBookmarks[0].deletedAt).toBeTruthy();

    // Mapping was cleaned up from storage
    const map = await engine.getNodeUrlMap();
    expect(map['native-999']).toBeUndefined();

    // Sync outbox has delete entry
    expect(mockOutbox.length).toBe(1);
    expect(mockOutbox[0].operation).toBe('delete');
    expect(mockOutbox[0].entityId).toBe('test-bm-vitest');
  });
});
