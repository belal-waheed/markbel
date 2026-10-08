import { db, LocalBookmark, LocalGroup, SyncOutboxItem } from './db';
import { SyncOutboxItem as SharedSyncOutboxItem } from '@/sync';
import { NotificationEventBus } from '@/notifications';

export interface SyncRepository<T> {
  create(entity: Omit<T, 'version' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T | undefined>;
  delete(id: string): Promise<void>;
  
  getPendingChanges(): Promise<SharedSyncOutboxItem[]>;
  applyRemoteChange(operation: 'create' | 'update' | 'delete', version: number, record?: Partial<T>, deletedAt?: string | null): Promise<void>;
}

export class BookmarkRepository implements SyncRepository<LocalBookmark> {
  private eventBus: NotificationEventBus | null = null;

  constructor(eventBus?: NotificationEventBus) {
    if (eventBus) {
      this.eventBus = eventBus;
    }
  }

  setEventBus(bus: NotificationEventBus | null) {
    this.eventBus = bus;
  }

  getEventBus(): NotificationEventBus | null {
    return this.eventBus;
  }

  async create(data: Omit<LocalBookmark, 'version' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<LocalBookmark> {
    const now = new Date().toISOString();
    
    const bookmark: LocalBookmark = {
      ...data,
      version: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    await db.transaction('rw', db.bookmarks, db.syncOutbox, async () => {
      await db.bookmarks.add(bookmark);
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'bookmark',
        entityId: bookmark.id,
        operation: 'create',
        baseVersion: bookmark.version,
        payload: bookmark,
        status: 'pending',
        attempts: 0,
        createdAt: now
      };
      await db.syncOutbox.add(outboxItem);
    });

    if (this.eventBus) {
      this.eventBus.publish({
        type: 'BookmarkCreated',
        payload: {
          id: bookmark.id,
          title: bookmark.title,
          remindAt: bookmark.remindAt,
          version: bookmark.version
        }
      });
    }

    return bookmark;
  }

  async update(id: string, updates: Partial<LocalBookmark>): Promise<LocalBookmark | undefined> {
    const now = new Date().toISOString();
    let updatedBookmark: LocalBookmark | undefined;

    await db.transaction('rw', db.bookmarks, db.syncOutbox, async () => {
      const existing = await db.bookmarks.get(id);
      if (!existing) return;
      if (existing.deletedAt) return; // Don't update deleted items

      updatedBookmark = {
        ...existing,
        ...updates,
        updatedAt: now
      };
      
      // Update local db, but keep version same until sync confirms
      await db.bookmarks.put(updatedBookmark);
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'bookmark',
        entityId: id,
        operation: 'update',
        baseVersion: existing.version,
        payload: { ...updates, updatedAt: now },
        status: 'pending',
        attempts: 0,
        createdAt: now
      };
      await db.syncOutbox.add(outboxItem);
    });

    if (updatedBookmark && this.eventBus) {
      this.eventBus.publish({
        type: 'BookmarkUpdated',
        payload: {
          id: updatedBookmark.id,
          title: updatedBookmark.title,
          remindAt: updatedBookmark.remindAt,
          version: updatedBookmark.version
        }
      });
    }

    return updatedBookmark;
  }

  async bulkUpdate(ids: string[], updates: Partial<LocalBookmark>): Promise<void> {
    if (!ids || ids.length === 0) return;
    const now = new Date().toISOString();
    const updatedBookmarks: LocalBookmark[] = [];

    await db.transaction('rw', db.bookmarks, db.syncOutbox, async () => {
      for (const id of ids) {
        const existing = await db.bookmarks.get(id);
        if (!existing || existing.deletedAt) continue;

        const updatedBookmark: LocalBookmark = {
          ...existing,
          ...updates,
          updatedAt: now
        };
        await db.bookmarks.put(updatedBookmark);
        updatedBookmarks.push(updatedBookmark);

        const outboxItem: SyncOutboxItem = {
          id: crypto.randomUUID(),
          entityType: 'bookmark',
          entityId: id,
          operation: 'update',
          baseVersion: existing.version,
          payload: { ...updates, updatedAt: now },
          status: 'pending',
          attempts: 0,
          createdAt: now
        };
        await db.syncOutbox.add(outboxItem);
      }
    });

    if (this.eventBus) {
      for (const b of updatedBookmarks) {
        this.eventBus.publish({
          type: 'BookmarkUpdated',
          payload: {
            id: b.id,
            title: b.title,
            remindAt: b.remindAt,
            version: b.version
          }
        });
      }
    }
  }

  async delete(id: string): Promise<void> {
    const now = new Date().toISOString();
    let wasDeleted = false;

    await db.transaction('rw', db.bookmarks, db.syncOutbox, async () => {
      const existing = await db.bookmarks.get(id);
      if (!existing) return;
      if (existing.deletedAt) return; 

      const updatedBookmark = {
        ...existing,
        updatedAt: now,
        deletedAt: now
      };
      
      await db.bookmarks.put(updatedBookmark);
      wasDeleted = true;
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'bookmark',
        entityId: id,
        operation: 'delete',
        baseVersion: existing.version,
        payload: { deletedAt: now },
        status: 'pending',
        attempts: 0,
        createdAt: now
      };
      await db.syncOutbox.add(outboxItem);
    });

    if (wasDeleted && this.eventBus) {
      this.eventBus.publish({
        type: 'BookmarkDeleted',
        payload: { id }
      });
    }
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const now = new Date().toISOString();
    const deletedIds: string[] = [];

    await db.transaction('rw', db.bookmarks, db.syncOutbox, async () => {
      for (const id of ids) {
        const existing = await db.bookmarks.get(id);
        if (!existing || existing.deletedAt) continue;

        const updatedBookmark: LocalBookmark = {
          ...existing,
          updatedAt: now,
          deletedAt: now
        };
        await db.bookmarks.put(updatedBookmark);
        deletedIds.push(id);

        const outboxItem: SyncOutboxItem = {
          id: crypto.randomUUID(),
          entityType: 'bookmark',
          entityId: id,
          operation: 'delete',
          baseVersion: existing.version,
          payload: { deletedAt: now },
          status: 'pending',
          attempts: 0,
          createdAt: now
        };
        await db.syncOutbox.add(outboxItem);
      }
    });

    if (this.eventBus) {
      for (const id of deletedIds) {
        this.eventBus.publish({
          type: 'BookmarkDeleted',
          payload: { id }
        });
      }
    }
  }

  async getPendingChanges(): Promise<SyncOutboxItem[]> {
    return await db.syncOutbox
      .where('entityType').equals('bookmark')
      .and(item => item.status === 'pending' || item.status === 'failed')
      .toArray();
  }

  async applyRemoteChange(operation: 'create' | 'update' | 'delete', version: number, record?: Partial<LocalBookmark>, deletedAt?: string | null): Promise<void> {
    if (!record || !record.id) return;
    
    await db.transaction('rw', db.bookmarks, async () => {
      const existing = await db.bookmarks.get(record.id!);
      
      if (operation === 'create' || operation === 'update') {
        // If we have a local version that is newer, we might have a conflict, but since server is source of truth,
        // we overwrite with server version. The SyncManager handles conflict resolution by rejecting local pushes.
        await db.bookmarks.put({
          ...(existing || {}),
          ...record,
          version
        } as LocalBookmark);
      } else if (operation === 'delete') {
        const deleteTimestamp = deletedAt || new Date().toISOString();
        if (existing) {
          existing.deletedAt = deleteTimestamp;
          existing.version = version;
          await db.bookmarks.put(existing);
        } else {
          await db.bookmarks.put({
            id: record.id,
            userId: record.userId || 'remote-synced',
            title: record.title || 'Deleted Bookmark',
            url: record.url || '',
            description: '',
            group: 'Unsorted',
            isRead: false,
            readAt: '',
            isPinned: false,
            remindAt: '',
            isArchived: false,
            archiveGroup: '',
            version,
            createdAt: record.createdAt || deleteTimestamp,
            updatedAt: record.updatedAt || deleteTimestamp,
            deletedAt: deleteTimestamp
          } as LocalBookmark);
        }
      }
    });
  }
}

export const bookmarkRepository = new BookmarkRepository();

export class GroupRepository implements SyncRepository<LocalGroup> {
  async create(data: Omit<LocalGroup, 'version' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<LocalGroup> {
    const now = new Date().toISOString();
    
    const group: LocalGroup = {
      ...data,
      version: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    await db.transaction('rw', db.groups, db.syncOutbox, async () => {
      await db.groups.add(group);
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'group',
        entityId: group.id,
        operation: 'create',
        baseVersion: group.version,
        payload: group,
        status: 'pending',
        attempts: 0,
        createdAt: now
      };
      await db.syncOutbox.add(outboxItem);
    });

    return group;
  }

  async update(id: string, updates: Partial<LocalGroup>): Promise<LocalGroup | undefined> {
    const now = new Date().toISOString();
    let updatedGroup: LocalGroup | undefined;

    await db.transaction('rw', db.groups, db.bookmarks, db.syncOutbox, async () => {
      const existing = await db.groups.get(id);
      if (!existing) return;
      if (existing.deletedAt) return; 

      updatedGroup = {
        ...existing,
        ...updates,
        updatedAt: now
      };
      
      await db.groups.put(updatedGroup);
      
      if (updates.name && existing.name !== updates.name) {
        // Bulk update local bookmarks and queue sync mutations
        const affectedBookmarks = await db.bookmarks
          .filter(b => b.group === existing.name && !b.deletedAt)
          .toArray();
        for (const b of affectedBookmarks) {
          b.group = updates.name;
          b.updatedAt = now;
          await db.bookmarks.put(b);

          const bmOutboxItem: SyncOutboxItem = {
            id: crypto.randomUUID(),
            entityType: 'bookmark',
            entityId: b.id,
            operation: 'update',
            baseVersion: b.version,
            payload: { group: updates.name, updatedAt: now },
            status: 'pending',
            attempts: 0,
            createdAt: now
          };
          await db.syncOutbox.add(bmOutboxItem);
        }
      }
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'group',
        entityId: id,
        operation: 'update',
        baseVersion: existing.version,
        payload: { ...updates, updatedAt: now },
        status: 'pending',
        attempts: 0,
        createdAt: now
      };
      await db.syncOutbox.add(outboxItem);
    });

    return updatedGroup;
  }

  async delete(id: string): Promise<void> {
    const now = new Date().toISOString();

    await db.transaction('rw', db.groups, db.bookmarks, db.syncOutbox, async () => {
      const existing = await db.groups.get(id);
      if (!existing) return;
      if (existing.deletedAt) return; 

      const updatedGroup = {
        ...existing,
        updatedAt: now,
        deletedAt: now
      };
      
      await db.groups.put(updatedGroup);

      // Cascade bookmarks to Unsorted and queue sync mutations
      const affectedBookmarks = await db.bookmarks
        .filter(b => b.group === existing.name && !b.deletedAt)
        .toArray();
      for (const b of affectedBookmarks) {
        b.group = 'Unsorted';
        b.updatedAt = now;
        await db.bookmarks.put(b);

        const bmOutboxItem: SyncOutboxItem = {
          id: crypto.randomUUID(),
          entityType: 'bookmark',
          entityId: b.id,
          operation: 'update',
          baseVersion: b.version,
          payload: { group: 'Unsorted', updatedAt: now },
          status: 'pending',
          attempts: 0,
          createdAt: now
        };
        await db.syncOutbox.add(bmOutboxItem);
      }
      
      const outboxItem: SyncOutboxItem = {
        id: crypto.randomUUID(),
        entityType: 'group',
        entityId: id,
        operation: 'delete',
        baseVersion: existing.version,
        payload: { deletedAt: now },
        status: 'pending',
        attempts: 0,
        createdAt: now
      };
      await db.syncOutbox.add(outboxItem);
    });
  }

  async getPendingChanges(): Promise<SyncOutboxItem[]> {
    return await db.syncOutbox
      .where('entityType').equals('group')
      .and(item => item.status === 'pending' || item.status === 'failed')
      .toArray();
  }

  async applyRemoteChange(operation: 'create' | 'update' | 'delete', version: number, record?: Partial<LocalGroup>, deletedAt?: string | null): Promise<void> {
    if (!record || !record.id) return;
    
    await db.transaction('rw', db.groups, async () => {
      const existing = await db.groups.get(record.id!);
      
      if (operation === 'create' || operation === 'update') {
        if (!existing && record.name) {
          const nameNormalized = record.name.trim().toLowerCase();
          const existingSameName = await db.groups
            .filter((g) => !g.deletedAt && g.name.trim().toLowerCase() === nameNormalized)
            .first();

          if (existingSameName) {
            await db.groups.update(existingSameName.id, {
              ...existingSameName,
              ...record,
              id: existingSameName.id,
              version,
              updatedAt: record.updatedAt || new Date().toISOString()
            } as LocalGroup);
            return;
          }
        }

        await db.groups.put({
          ...(existing || {}),
          ...record,
          version
        } as LocalGroup);
      } else if (operation === 'delete') {
        const deleteTimestamp = deletedAt || new Date().toISOString();
        if (existing) {
          existing.deletedAt = deleteTimestamp;
          existing.version = version;
          await db.groups.put(existing);
        } else {
          await db.groups.put({
            id: record.id,
            userId: record.userId || 'remote-synced',
            name: record.name || 'Deleted Group',
            color: record.color || 'blue',
            version,
            createdAt: record.createdAt || deleteTimestamp,
            updatedAt: record.updatedAt || deleteTimestamp,
            deletedAt: deleteTimestamp
          } as LocalGroup);
        }
      }
    });
  }
}

export const groupRepository = new GroupRepository();
