import Dexie, { Table } from 'dexie';
import { resolveSmartGroup } from '../lib/smartGroups.js';

export interface LocalBookmark {
  id: string;
  userId: string;
  title: string;
  url: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  author?: string;
  publishedAt?: string;
  contentType?: 'article' | 'video' | 'audio' | 'tweet' | 'code' | 'website';
  readingTime?: number;
  wordCount?: number;
  canonicalUrl?: string;
  articleContent?: string;
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

    this.version(4).stores({
      bookmarks: 'id, userId, group, isArchived, isRead, contentType, deletedAt'
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

/**
 * Initializes default smart groups (YT, Insta, X) for a given user if not already present.
 */
export async function initializeDefaultSmartGroups(userId: string = 'local-user'): Promise<void> {
  const targetUserId = userId || 'local-user';
  const now = new Date().toISOString();

  const existingGroups = await db.groups
    .filter((g) => (g.userId === targetUserId || !g.userId) && !g.deletedAt)
    .toArray();

  const existingNames = new Set(existingGroups.map((g) => g.name.toLowerCase()));

  const DEFAULT_SEEDS = [
    { name: 'YT', color: 'red' },
    { name: 'Insta', color: 'purple' },
    { name: 'X', color: 'slate' },
  ];

  await db.transaction('rw', [db.groups, db.syncOutbox], async () => {
    for (const seed of DEFAULT_SEEDS) {
      if (!existingNames.has(seed.name.toLowerCase())) {
        const id = crypto.randomUUID();
        const newGroup: LocalGroup = {
          id,
          userId: targetUserId,
          name: seed.name,
          color: seed.color,
          version: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };

        await db.groups.add(newGroup);

        if (targetUserId !== 'local-user') {
          await db.syncOutbox.add({
            id: crypto.randomUUID(),
            entityType: 'group',
            entityId: id,
            operation: 'create',
            baseVersion: 0,
            payload: newGroup,
            status: 'pending',
            attempts: 0,
            createdAt: now,
          });
        }
      }
    }
  });
}

/**
 * Scans all bookmarks in 'Unsorted' and automatically assigns them to matching smart groups (YT, Insta, X).
 * Returns the count of newly organized bookmarks.
 */
export async function autoOrganizeUnsortedBookmarks(userId: string = 'local-user'): Promise<number> {
  const targetUserId = userId || 'local-user';
  const now = new Date().toISOString();

  // 1. Ensure smart groups exist first
  await initializeDefaultSmartGroups(targetUserId);

  const activeGroups = await db.groups
    .filter((g) => (g.userId === targetUserId || !g.userId) && !g.deletedAt)
    .toArray();

  const groupNames = activeGroups.map((g) => g.name);

  let organizedCount = 0;

  await db.transaction('rw', [db.bookmarks, db.syncOutbox], async () => {
    const unsortedBookmarks = await db.bookmarks
      .filter(
        (b) =>
          (b.userId === targetUserId || !b.userId) &&
          !b.deletedAt &&
          (!b.group || b.group.toLowerCase() === 'unsorted')
      )
      .toArray();

    for (const b of unsortedBookmarks) {
      const smartGroup = resolveSmartGroup(b.url, groupNames);
      if (smartGroup && smartGroup.toLowerCase() !== 'unsorted') {
        const newVersion = (b.version || 0) + 1;
        const updated: LocalBookmark = {
          ...b,
          group: smartGroup,
          version: newVersion,
          updatedAt: now,
        };

        await db.bookmarks.put(updated);

        if (targetUserId !== 'local-user') {
          await db.syncOutbox.add({
            id: crypto.randomUUID(),
            entityType: 'bookmark',
            entityId: b.id,
            operation: 'update',
            baseVersion: b.version || 0,
            payload: updated,
            status: 'pending',
            attempts: 0,
            createdAt: now,
          });
        }

        organizedCount++;
      }
    }
  });

  return organizedCount;
}
