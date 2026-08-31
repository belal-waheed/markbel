import { db } from '../db';
import { SyncStorage, SyncOutboxItem, RemoteChange } from '@/sync';

export class WebSyncStorage implements SyncStorage {
  async getPendingChanges(limit: number): Promise<SyncOutboxItem[]> {
    const pending = await db.syncOutbox
      .filter(item => item.status === 'pending' || item.status === 'failed')
      .toArray();
    return pending.slice(0, limit);
  }

  async savePendingChange(change: SyncOutboxItem): Promise<void> {
    await db.syncOutbox.put(change);
  }

  async updatePendingChangeStatus(id: string, updates: Partial<SyncOutboxItem>): Promise<void> {
    await db.syncOutbox.update(id, updates as any);
  }

  async removePendingChanges(ids: string[]): Promise<void> {
    await db.syncOutbox.bulkDelete(ids);
  }

  async getCursor(): Promise<number> {
    const metadata = await db.syncMetadata.get('bookmark-sync');
    return metadata?.cursor || 0;
  }

  async saveCursor(cursor: number): Promise<void> {
    await db.syncMetadata.put({
      key: 'bookmark-sync',
      cursor,
      lastSuccessfulSyncAt: new Date().toISOString(),
      protocolVersion: 1
    });
  }

  async getDeviceId(): Promise<string | undefined> {
    const existing = await db.appConfig.get('deviceId');
    if (existing) return existing.value;
    
    const newId = `browser-${crypto.randomUUID()}`;
    await db.appConfig.put({ key: 'deviceId', value: newId });
    return newId;
  }

  async saveDeviceId(deviceId: string): Promise<void> {
    await db.appConfig.put({ key: 'deviceId', value: deviceId });
  }

  async getAuthToken(): Promise<string | null> {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('markbel_token');
    }
    return null;
  }

  async saveAuthToken(token: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('markbel_token', token);
    }
  }

  async removeAuthToken(): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('markbel_token');
    }
  }

  async applyRemoteChanges(changes: RemoteChange[]): Promise<void> {
    await db.transaction('rw', db.bookmarks, db.groups, async () => {
      for (const change of changes) {
        const table = change.entityType === 'group' ? db.groups : db.bookmarks;
        
        if (change.operation === 'delete') {
          const localItem = await table.get(change.entityId);
          if (localItem) {
            await table.update(change.entityId, { 
              deletedAt: change.deletedAt || new Date().toISOString(),
              version: change.version 
            } as any);
          }
        } else if (change.operation === 'create' || change.operation === 'update') {
          const raw = change.payload || (change as any).record;
          if (!raw) continue;

          const data = {
            ...raw,
            group: raw.group || raw.group_name || 'Unsorted',
            isRead: raw.isRead ?? (raw.is_read ? Boolean(raw.is_read) : false),
            readAt: raw.readAt || raw.read_at || '',
            isPinned: raw.isPinned ?? (raw.is_pinned ? Boolean(raw.is_pinned) : false),
            remindAt: raw.remindAt || raw.remind_at || '',
            isArchived: raw.isArchived ?? (raw.is_archived ? Boolean(raw.is_archived) : false),
            archiveGroup: raw.archiveGroup || raw.archive_group || '',
            createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
            updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
            deletedAt: change.deletedAt || raw.deletedAt || raw.deleted_at || null
          };

          const localItem = await table.get(change.entityId);
          if (localItem) {
            // Update
            await table.update(change.entityId, {
              ...data,
              version: change.version,
              updatedAt: data.updatedAt || new Date().toISOString()
            } as any);
          } else {
            // Create
            await table.put({
              ...data,
              id: change.entityId,
              version: change.version,
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
              deletedAt: null
            } as any);
          }
        }
      }
    });
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return await db.transaction('rw', db.bookmarks, db.syncOutbox, db.syncMetadata, db.appConfig, callback);
  }
}
