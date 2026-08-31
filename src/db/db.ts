import Dexie, { Table } from 'dexie';

export interface LocalBookmark {
  id: string;
  userId: string;
  title: string;
  url: string;
  description?: string;
  image?: string;
  group: string;
  isRead?: boolean;
  readAt?: string;
  isPinned?: boolean;
  remindAt?: string;
  isArchived?: boolean;
  archiveGroup?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
export interface LocalGroup {
  id: string;
  userId: string;
  name: string;
  color: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncOutboxItem {
  id: string; // crypto.randomUUID()
  entityType: string; // 'bookmark'
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  baseVersion: number;
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: string;
}

export interface SyncMetadata {
  key: string; // 'bookmark-sync'
  cursor: number | null;
  lastSuccessfulSyncAt: string | null;
  protocolVersion: number; // For future api versioning
}

export interface AppConfig {
  key: string;
  value: any;
}

export class MarkbelDatabase extends Dexie {
  bookmarks!: Table<LocalBookmark, string>;
  groups!: Table<LocalGroup, string>;
  syncOutbox!: Table<SyncOutboxItem, string>;
  syncMetadata!: Table<SyncMetadata, string>;
  appConfig!: Table<AppConfig, string>; // Store deviceId etc here

  scheduledNotifications!: Table<any, string>;

  constructor() {
    super('MarkbelDatabase');
    
    // Define tables and indexes
    this.version(1).stores({
      bookmarks: 'id, userId, group, isArchived, isRead, deletedAt', 
      syncOutbox: 'id, entityType, entityId, status, createdAt',
      syncMetadata: 'key',
      appConfig: 'key'
    });

    this.version(2).stores({
      scheduledNotifications: 'id, bookmarkId, triggerAtUtc'
    }).upgrade(() => {});

    this.version(3).stores({
      groups: 'id, userId, name, deletedAt'
    }).upgrade(() => {});
  }
}

export const db = new MarkbelDatabase();

/**
 * Migrates local guest data (userId = 'local-user' or empty) to the authenticated user ID,
 * and enqueues sync outbox operations so they are immediately pushed to Cloudflare D1.
 */
export async function migrateGuestData(userId: string): Promise<number> {
  if (!userId) return 0;
  let migratedCount = 0;
  const now = new Date().toISOString();

  await db.transaction('rw', [db.bookmarks, db.groups, db.syncOutbox], async () => {
    // 1. Migrate Bookmarks
    const guestBookmarks = await db.bookmarks
      .filter((b) => !b.userId || b.userId === 'local-user')
      .toArray();

    for (const b of guestBookmarks) {
      const updated: LocalBookmark = {
        ...b,
        userId,
        updatedAt: now,
      };
      await db.bookmarks.put(updated);

      const existingOutbox = await db.syncOutbox
        .where('entityId')
        .equals(b.id)
        .first();

      if (!existingOutbox) {
        await db.syncOutbox.add({
          id: crypto.randomUUID(),
          entityType: 'bookmark',
          entityId: b.id,
          operation: 'create',
          baseVersion: b.version || 0,
          payload: updated,
          status: 'pending',
          attempts: 0,
          createdAt: now,
        });
      } else {
        await db.syncOutbox.update(existingOutbox.id, {
          payload: updated,
          status: 'pending',
        });
      }
      migratedCount++;
    }

    // 2. Migrate Groups
    const guestGroups = await db.groups
      .filter((g) => !g.userId || g.userId === 'local-user')
      .toArray();

    for (const g of guestGroups) {
      const updated: LocalGroup = {
        ...g,
        userId,
        updatedAt: now,
      };
      await db.groups.put(updated);

      const existingOutbox = await db.syncOutbox
        .where('entityId')
        .equals(g.id)
        .first();

      if (!existingOutbox) {
        await db.syncOutbox.add({
          id: crypto.randomUUID(),
          entityType: 'group',
          entityId: g.id,
          operation: 'create',
          baseVersion: g.version || 0,
          payload: updated,
          status: 'pending',
          attempts: 0,
          createdAt: now,
        });
      } else {
        await db.syncOutbox.update(existingOutbox.id, {
          payload: updated,
          status: 'pending',
        });
      }
      migratedCount++;
    }
  });

  return migratedCount;
}

export async function clearAllLocalData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.bookmarks, db.groups, db.syncOutbox, db.syncMetadata, db.appConfig, db.scheduledNotifications],
    async () => {
      await db.bookmarks.clear();
      await db.groups.clear();
      await db.syncOutbox.clear();
      await db.syncMetadata.clear();
      await db.appConfig.clear();
      await db.scheduledNotifications.clear();
    }
  );
  if (typeof window !== 'undefined') {
    localStorage.removeItem('markbel_token');
    localStorage.removeItem('markbel_user');
    localStorage.removeItem('markbel_last_sync');
  }
}
