import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookmarkRepository, GroupRepository } from '../db/SyncRepository';
import { NotificationEventBus } from '../notifications';
import { db, LocalBookmark, LocalGroup, SyncOutboxItem } from '../db/db';

describe('SyncRepository Bulk Operations & Group Cascade Integrity', () => {
  let eventBus: NotificationEventBus;
  let bookmarkRepo: BookmarkRepository;
  let groupRepo: GroupRepository;

  let bookmarksStore: Map<string, LocalBookmark>;
  let groupsStore: Map<string, LocalGroup>;
  let outboxStore: Map<string, SyncOutboxItem>;

  beforeEach(() => {
    bookmarksStore = new Map();
    groupsStore = new Map();
    outboxStore = new Map();

    // Mock db.bookmarks
    (vi.spyOn(db.bookmarks, 'get') as any).mockImplementation(async (id: any) => {
      return bookmarksStore.get(id as string);
    });
    (vi.spyOn(db.bookmarks, 'put') as any).mockImplementation(async (item: any) => {
      bookmarksStore.set(item.id, item);
      return item.id;
    });
    (vi.spyOn(db.bookmarks, 'add') as any).mockImplementation(async (item: any) => {
      bookmarksStore.set(item.id, item);
      return item.id;
    });
    (vi.spyOn(db.bookmarks, 'filter') as any).mockImplementation((fn: any) => {
      const items = Array.from(bookmarksStore.values()).filter(fn);
      return {
        toArray: async () => items,
      };
    });

    // Mock db.groups
    (vi.spyOn(db.groups, 'get') as any).mockImplementation(async (id: any) => {
      return groupsStore.get(id as string);
    });
    (vi.spyOn(db.groups, 'put') as any).mockImplementation(async (item: any) => {
      groupsStore.set(item.id, item);
      return item.id;
    });
    (vi.spyOn(db.groups, 'add') as any).mockImplementation(async (item: any) => {
      groupsStore.set(item.id, item);
      return item.id;
    });

    // Mock db.syncOutbox
    (vi.spyOn(db.syncOutbox, 'add') as any).mockImplementation(async (item: any) => {
      outboxStore.set(item.id, item);
      return item.id;
    });

    // Mock db.transaction
    (vi.spyOn(db, 'transaction') as any).mockImplementation(async (...args: any[]) => {
      const callback = args[args.length - 1];
      return await callback();
    });

    eventBus = new NotificationEventBus();
    bookmarkRepo = new BookmarkRepository(eventBus);
    groupRepo = new GroupRepository();
  });

  it('bulkUpdate atomically updates bookmarks, enqueues sync outbox items, and emits events', async () => {
    const publishedEvents: any[] = [];
    eventBus.subscribe((evt) => {
      publishedEvents.push(evt);
    });

    bookmarksStore.set('bm-1', {
      id: 'bm-1',
      userId: 'u1',
      title: 'Item 1',
      url: 'https://example.com/1',
      group: 'Tech',
      version: 1,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      deletedAt: null,
    });

    bookmarksStore.set('bm-2', {
      id: 'bm-2',
      userId: 'u1',
      title: 'Item 2',
      url: 'https://example.com/2',
      group: 'Tech',
      version: 2,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      deletedAt: null,
    });

    await bookmarkRepo.bulkUpdate(['bm-1', 'bm-2'], { isArchived: true });

    expect(bookmarksStore.get('bm-1')?.isArchived).toBe(true);
    expect(bookmarksStore.get('bm-2')?.isArchived).toBe(true);

    const outboxItems = Array.from(outboxStore.values());
    expect(outboxItems).toHaveLength(2);
    expect(outboxItems[0].entityId).toBe('bm-1');
    expect(outboxItems[0].operation).toBe('update');
    expect(outboxItems[0].baseVersion).toBe(1);
    expect(outboxItems[0].payload.isArchived).toBe(true);

    expect(outboxItems[1].entityId).toBe('bm-2');
    expect(outboxItems[1].operation).toBe('update');
    expect(outboxItems[1].baseVersion).toBe(2);

    expect(publishedEvents).toHaveLength(2);
    expect(publishedEvents.map((e) => e.type)).toEqual(['BookmarkUpdated', 'BookmarkUpdated']);
  });

  it('bulkDelete marks bookmarks deleted, enqueues delete outbox items, and emits events', async () => {
    const publishedEvents: any[] = [];
    eventBus.subscribe((evt) => {
      publishedEvents.push(evt);
    });

    bookmarksStore.set('bm-1', {
      id: 'bm-1',
      userId: 'u1',
      title: 'Item 1',
      url: 'https://example.com/1',
      group: 'Tech',
      version: 1,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      deletedAt: null,
    });

    await bookmarkRepo.bulkDelete(['bm-1']);

    expect(bookmarksStore.get('bm-1')?.deletedAt).toBeTruthy();

    const outboxItems = Array.from(outboxStore.values());
    expect(outboxItems).toHaveLength(1);
    expect(outboxItems[0].entityId).toBe('bm-1');
    expect(outboxItems[0].operation).toBe('delete');
    expect(outboxItems[0].baseVersion).toBe(1);

    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0].type).toBe('BookmarkDeleted');
    expect(publishedEvents[0].payload.id).toBe('bm-1');
  });

  it('GroupRepository.update cascades group rename to bookmarks and enqueues outbox items', async () => {
    groupsStore.set('grp-1', {
      id: 'grp-1',
      userId: 'u1',
      name: 'Design',
      color: 'blue',
      version: 1,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      deletedAt: null,
    });

    bookmarksStore.set('bm-1', {
      id: 'bm-1',
      userId: 'u1',
      title: 'Figma',
      url: 'https://figma.com',
      group: 'Design',
      version: 3,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      deletedAt: null,
    });

    await groupRepo.update('grp-1', { name: 'UX Design' });

    expect(groupsStore.get('grp-1')?.name).toBe('UX Design');
    expect(bookmarksStore.get('bm-1')?.group).toBe('UX Design');

    const outboxItems = Array.from(outboxStore.values());
    // 1 for group update, 1 for bookmark cascade update
    expect(outboxItems).toHaveLength(2);
    
    const bmChange = outboxItems.find((o) => o.entityType === 'bookmark');
    expect(bmChange).toBeDefined();
    expect(bmChange?.entityId).toBe('bm-1');
    expect(bmChange?.operation).toBe('update');
    expect(bmChange?.baseVersion).toBe(3);
    expect(bmChange?.payload.group).toBe('UX Design');
  });

  it('GroupRepository.delete cascades bookmarks to Unsorted and enqueues outbox items', async () => {
    groupsStore.set('grp-1', {
      id: 'grp-1',
      userId: 'u1',
      name: 'Articles',
      color: 'green',
      version: 1,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      deletedAt: null,
    });

    bookmarksStore.set('bm-1', {
      id: 'bm-1',
      userId: 'u1',
      title: 'Article 1',
      url: 'https://example.com/art',
      group: 'Articles',
      version: 2,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      deletedAt: null,
    });

    await groupRepo.delete('grp-1');

    expect(groupsStore.get('grp-1')?.deletedAt).toBeTruthy();
    expect(bookmarksStore.get('bm-1')?.group).toBe('Unsorted');

    const outboxItems = Array.from(outboxStore.values());
    expect(outboxItems).toHaveLength(2);

    const grpChange = outboxItems.find((o) => o.entityType === 'group');
    expect(grpChange?.operation).toBe('delete');

    const bmChange = outboxItems.find((o) => o.entityType === 'bookmark');
    expect(bmChange?.entityId).toBe('bm-1');
    expect(bmChange?.operation).toBe('update');
    expect(bmChange?.payload.group).toBe('Unsorted');
  });
});
