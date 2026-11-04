import Dexie, { Table } from 'dexie';
import { resolveSmartGroup, getCustomSmartGroupRules, DEFAULT_SMART_GROUPS } from '../lib/smartGroups.js';

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
  contentType?: 'article' | 'video' | 'audio' | 'tweet' | 'code' | 'website' | 'playlist';
  readingTime?: number;
  wordCount?: number;
  canonicalUrl?: string;
  articleContent?: string;
  group: string;
  isRead?: boolean;
  readAt?: string;
  isPinned?: boolean;
  remindAt?: string;
  notifiedAt?: string;
  isArchived?: boolean;
  archiveGroup?: string;
  isBroken?: boolean;
  httpStatus?: number;
  lastCheckedAt?: string;
  actor_type?: 'owner' | 'collaborator' | string;
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

export interface CachedThumbnail {
  id: string; // URL string
  blob: Blob;
  contentType: string;
  size: number;
  updatedAt: string;
}

export interface ArticleToken {
  token: string;
  bookmarkId: string;
}

/**
 * Normalizes text and extracts unique search tokens (lowercase, alphanumeric, length >= 2)
 */
export function extractArticleTokens(text?: string | null): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && w.length <= 50);
  return Array.from(new Set(words));
}

export class MarkbelDatabase extends Dexie {
  bookmarks!: Table<LocalBookmark, string>;
  groups!: Table<LocalGroup, string>;
  syncOutbox!: Table<SyncOutboxItem, string>;
  syncMetadata!: Table<SyncMetadata, string>;
  appConfig!: Table<AppConfig, string>; // Store deviceId etc here

  scheduledNotifications!: Table<any, string>;
  cachedThumbnails!: Table<CachedThumbnail, string>;
  articleTokens!: Table<ArticleToken, [string, string]>;

  constructor() {
    super('MarkbelDatabase');
    
    this.on('versionchange', () => {
      this.close();
    });

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

    this.version(5).stores({
      bookmarks: 'id, userId, group, isArchived, isRead, contentType, deletedAt',
      groups: 'id, userId, name, deletedAt',
      syncOutbox: 'id, entityType, entityId, status, createdAt',
      syncMetadata: 'key',
      appConfig: 'key',
      scheduledNotifications: 'id, bookmarkId, triggerAtUtc'
    }).upgrade(() => {});

    this.version(6).stores({
      cachedThumbnails: 'id, updatedAt'
    }).upgrade(() => {});

    this.version(7).stores({
      bookmarks: 'id, userId, url, group, isArchived, isRead, contentType, deletedAt'
    }).upgrade(() => {});

    this.version(8).stores({
      bookmarks: 'id, userId, url, group, isArchived, isRead, isBroken, contentType, deletedAt',
      articleTokens: 'token, bookmarkId, [token+bookmarkId]'
    }).upgrade(() => {});

    this.version(9).stores({
      articleTokens: '[token+bookmarkId], token, bookmarkId'
    }).upgrade(async (tx) => {
      const bookmarks = await tx.table<LocalBookmark>('bookmarks').toArray();
      const rows: ArticleToken[] = [];
      for (const b of bookmarks) {
        if (b.articleContent && !b.deletedAt) {
          const tokens = extractArticleTokens(b.articleContent);
          for (const token of tokens) {
            rows.push({ token, bookmarkId: b.id });
          }
        }
      }
      if (rows.length > 0) {
        await tx.table('articleTokens').bulkPut(rows);
      }
    });
  }
}

export const db = new MarkbelDatabase();

if (typeof window !== 'undefined') {
  (window as any).db = db;
}

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
      // Do not re-enqueue mutations for groups that already have an authenticated userId
      if (g.userId && g.userId !== 'local-user' && g.userId !== '') {
        continue;
      }

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
    [db.bookmarks, db.groups, db.syncOutbox, db.syncMetadata, db.appConfig, db.scheduledNotifications, db.cachedThumbnails],
    async () => {
      await db.bookmarks.clear();
      await db.groups.clear();
      await db.syncOutbox.clear();
      await db.syncMetadata.clear();
      await db.appConfig.clear();
      await db.scheduledNotifications.clear();
      await db.cachedThumbnails.clear();
    }
  );
  if (typeof window !== 'undefined') {
    localStorage.removeItem('markbel_token');
    localStorage.removeItem('markbel_user');
    localStorage.removeItem('markbel_last_sync');
  }
}

/**
 * Automated self-healing migration that consolidates duplicate groups with the same name.
 * Keeps the oldest/primary group, re-points any referencing bookmarks, and removes duplicate group records.
 */
export async function deduplicateLocalGroups(): Promise<void> {
  const allGroups = await db.groups.filter((g) => !g.deletedAt).toArray();
  const groupedByName = new Map<string, LocalGroup[]>();

  for (const g of allGroups) {
    const key = (g.name || '').toLowerCase().trim();
    if (!key) continue;
    if (!groupedByName.has(key)) {
      groupedByName.set(key, []);
    }
    groupedByName.get(key)!.push(g);
  }

  const duplicatesToResolve: { primary: LocalGroup; duplicates: LocalGroup[] }[] = [];
  for (const [, groupList] of groupedByName) {
    if (groupList.length > 1) {
      groupList.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (aTime && bTime && aTime !== bTime) return aTime - bTime;
        return (a.id || '').localeCompare(b.id || '');
      });
      duplicatesToResolve.push({
        primary: groupList[0],
        duplicates: groupList.slice(1),
      });
    }
  }

  if (duplicatesToResolve.length === 0) return;

  const now = new Date().toISOString();
  await db.transaction('rw', [db.groups, db.bookmarks, db.syncOutbox], async () => {
    for (const { primary, duplicates } of duplicatesToResolve) {
      const dupIds = new Set(duplicates.map((d) => d.id));
      const dupNames = new Set(duplicates.map((d) => d.name.toLowerCase().trim()));

      const bookmarksToUpdate = await db.bookmarks
        .filter((b) => {
          if (b.deletedAt) return false;
          if (!b.group) return false;
          const bg = b.group.toLowerCase().trim();
          return dupNames.has(bg) || dupIds.has(b.group);
        })
        .toArray();

      for (const b of bookmarksToUpdate) {
        await db.bookmarks.update(b.id, {
          group: primary.name,
          updatedAt: now,
          version: (b.version || 0) + 1,
        });
      }

      for (const dup of duplicates) {
        await db.groups.delete(dup.id);
      }
    }
  });
}

/**
 * Initializes default smart groups (YT, Insta, X) for a given user if not already present.
 */
export async function initializeDefaultSmartGroups(userId: string = 'local-user'): Promise<void> {
  const targetUserId = userId || 'local-user';
  const now = new Date().toISOString();

  // Check if groups with default names exist by name.toLowerCase(), regardless of userId
  const existingGroups = await db.groups
    .filter((g) => !g.deletedAt)
    .toArray();

  const DEFAULT_SEEDS = [
    { name: 'YT', color: 'red' },
    { name: 'Insta', color: 'purple' },
    { name: 'X', color: 'slate' },
  ];

  await db.transaction('rw', [db.groups, db.syncOutbox], async () => {
    for (const seed of DEFAULT_SEEDS) {
      const match = existingGroups.find(
        (g) => g.name.toLowerCase().trim() === seed.name.toLowerCase().trim()
      );

      if (match) {
        if (targetUserId !== 'local-user' && match.userId !== targetUserId) {
          const updated: LocalGroup = {
            ...match,
            userId: targetUserId,
            updatedAt: now,
          };
          await db.groups.put(updated);
          match.userId = targetUserId;
        }
      } else {
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
    .filter((g) => !g.deletedAt)
    .toArray();

  const groupNames = activeGroups.map((g) => g.name);

  let organizedCount = 0;
  const customRules = await getCustomSmartGroupRules().catch(() => []);

  await db.transaction('rw', [db.bookmarks, db.syncOutbox, db.groups, db.appConfig], async () => {
    const unsortedBookmarks = await db.bookmarks
      .filter(
        (b) =>
          !b.deletedAt &&
          (!b.group || b.group.toLowerCase() === 'unsorted')
      )
      .toArray();

    for (const b of unsortedBookmarks) {
      const smartGroup = resolveSmartGroup(b.url, groupNames, customRules);
      if (smartGroup && smartGroup.toLowerCase() !== 'unsorted') {
        // Auto-provision missing group if it doesn't exist in db.groups
        const groupExists = activeGroups.some(
          (g) => g.name.toLowerCase().trim() === smartGroup.toLowerCase().trim()
        );

        if (!groupExists) {
          let groupColor = '#005fb8';
          const matchingRule = customRules.find(
            (r) => r.group.toLowerCase().trim() === smartGroup.toLowerCase().trim()
          );
          if (matchingRule?.groupColor) {
            groupColor = matchingRule.groupColor;
          } else {
            const defaultGroup = DEFAULT_SMART_GROUPS.find(
              (dg) => dg.name.toLowerCase().trim() === smartGroup.toLowerCase().trim()
            );
            if (defaultGroup?.color) {
              groupColor = defaultGroup.color;
            }
          }

          const newGroupId = crypto.randomUUID();
          const newGroup: LocalGroup = {
            id: newGroupId,
            userId: targetUserId,
            name: smartGroup,
            color: groupColor,
            version: 1,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          };

          await db.groups.add(newGroup);
          activeGroups.push(newGroup);
          groupNames.push(smartGroup);

          if (targetUserId !== 'local-user') {
            await db.syncOutbox.add({
              id: crypto.randomUUID(),
              entityType: 'group',
              entityId: newGroupId,
              operation: 'create',
              baseVersion: 0,
              payload: newGroup,
              status: 'pending',
              attempts: 0,
              createdAt: now,
            });
          }
        }

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

/**
 * Retrieves a locally cached thumbnail blob by URL.
 */
export async function getCachedThumbnail(url: string): Promise<CachedThumbnail | null> {
  if (!url) return null;
  try {
    const item = await db.cachedThumbnails.get(url);
    return item || null;
  } catch (err) {
    console.error('Failed to get cached thumbnail:', err);
    return null;
  }
}

/**
 * Persists an image blob into Dexie cachedThumbnails.
 */
export async function saveCachedThumbnail(
  url: string,
  blob: Blob,
  contentType: string = 'image/jpeg'
): Promise<void> {
  if (!url || !blob) return;
  try {
    const item: CachedThumbnail = {
      id: url,
      blob,
      contentType: contentType || blob.type || 'image/jpeg',
      size: blob.size,
      updatedAt: new Date().toISOString(),
    };
    await db.cachedThumbnails.put(item);
  } catch (err) {
    console.error('Failed to save cached thumbnail:', err);
  }
}

/**
 * Prunes cached thumbnails when the count exceeds maxCount (default 300),
 * removing the oldest records by updatedAt.
 */
export async function pruneCachedThumbnails(maxCount: number = 300): Promise<number> {
  try {
    const count = await db.cachedThumbnails.count();
    if (count <= maxCount) {
      return 0;
    }
    const excess = count - maxCount;
    const oldestKeys = await db.cachedThumbnails
      .orderBy('updatedAt')
      .limit(excess)
      .primaryKeys();

    if (oldestKeys.length > 0) {
      await db.cachedThumbnails.bulkDelete(oldestKeys);
    }
    return oldestKeys.length;
  } catch (err) {
    console.error('Failed to prune cached thumbnails:', err);
    return 0;
  }
}

/**
 * Indexes article content in the Dexie client-side inverted index
 */
export async function indexArticleContent(bookmarkId: string, articleContent?: string | null): Promise<void> {
  if (!bookmarkId) return;
  try {
    const tokens = extractArticleTokens(articleContent);
    await db.transaction('rw', db.articleTokens, async () => {
      await db.articleTokens.where('bookmarkId').equals(bookmarkId).delete();
      if (tokens.length > 0) {
        const rows: ArticleToken[] = tokens.map((token) => ({
          token,
          bookmarkId,
        }));
        await db.articleTokens.bulkPut(rows);
      }
    });
  } catch (err) {
    console.warn('[Dexie Article Token Index Error]:', err);
  }
}

/**
 * Deletes indexed article tokens for a bookmark
 */
export async function deleteArticleTokens(bookmarkId: string): Promise<void> {
  if (!bookmarkId) return;
  try {
    await db.articleTokens.where('bookmarkId').equals(bookmarkId).delete();
  } catch (err) {
    console.warn('[Dexie Delete Article Tokens Error]:', err);
  }
}


