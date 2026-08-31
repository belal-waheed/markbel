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

export async function clearAllLocalData(): Promise<void> {
  await db.transaction('rw', [db.bookmarks, db.groups, db.syncOutbox, db.syncMetadata, db.appConfig], async () => {
    await db.bookmarks.clear();
    await db.groups.clear();
    await db.syncOutbox.clear();
    await db.syncMetadata.clear();
    await db.appConfig.clear();
  });
  if (typeof window !== 'undefined') {
    localStorage.removeItem('markbel_token');
    localStorage.removeItem('markbel_user');
    localStorage.removeItem('markbel_last_sync');
  }
}
