import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserBookmarkSyncEngine, MARKBEL_VAULT_FOLDER_TITLE, STORAGE_KEY_TWO_WAY_SYNC } from '../../extension/src/bookmarkSync';

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
});
