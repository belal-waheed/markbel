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
          const deleteTimestamp = change.deletedAt || new Date().toISOString();

          if (localItem) {
            await table.update(change.entityId, { 
              deletedAt: deleteTimestamp,
              version: change.version 
            } as any);
          } else {
            // Insert tombstone to prevent phantom resurrection
            if (change.entityType === 'group') {
              await db.groups.put({
                id: change.entityId,
                userId: 'remote-synced',
                name: (change.payload as any)?.name || 'Deleted Group',
                color: (change.payload as any)?.color || 'blue',
                version: change.version,
                createdAt: (change.payload as any)?.createdAt || deleteTimestamp,
                updatedAt: (change.payload as any)?.updatedAt || deleteTimestamp,
                deletedAt: deleteTimestamp,
              } as any);
            } else {
              await db.bookmarks.put({
                id: change.entityId,
                userId: 'remote-synced',
                title: (change.payload as any)?.title || 'Deleted Bookmark',
                url: (change.payload as any)?.url || '',
                description: (change.payload as any)?.description || '',
                group: (change.payload as any)?.group || 'Unsorted',
                isRead: false,
                readAt: '',
                isPinned: false,
                remindAt: '',
                isArchived: false,
                archiveGroup: '',
                version: change.version,
                createdAt: (change.payload as any)?.createdAt || deleteTimestamp,
                updatedAt: (change.payload as any)?.updatedAt || deleteTimestamp,
                deletedAt: deleteTimestamp,
              } as any);
            }
          }
        } else if (change.operation === 'create' || change.operation === 'update') {
          const raw = change.payload || (change as any).record;
          const localItem = await table.get(change.entityId);

          if (!raw) {
            if (localItem && change.version) {
              await table.update(change.entityId, { version: change.version } as any);
            }
            continue;
          }

          // If local item was deleted and incoming change does not un-delete, preserve deletion
          const rawDeletedAt = change.deletedAt || raw.deletedAt || raw.deleted_at || null;
          const normalizedDeletedAt =
            rawDeletedAt && typeof rawDeletedAt === 'string' && rawDeletedAt.trim() !== ''
              ? rawDeletedAt
              : (localItem?.deletedAt || null);

          const isRead =
            raw.isRead !== undefined
              ? Boolean(raw.isRead)
              : raw.is_read !== undefined
              ? Boolean(raw.is_read)
              : false;

          const isPinned =
            raw.isPinned !== undefined
              ? Boolean(raw.isPinned)
              : raw.is_pinned !== undefined
              ? Boolean(raw.is_pinned)
              : false;

          const isArchived =
            raw.isArchived !== undefined
              ? Boolean(raw.isArchived)
              : raw.is_archived !== undefined
              ? Boolean(raw.is_archived)
              : false;

          const data = {
            ...raw,
            group: raw.group || raw.group_name || 'Unsorted',
            isRead,
            readAt: raw.readAt || raw.read_at || '',
            isPinned,
            remindAt: raw.remindAt || raw.remind_at || '',
            isArchived,
            archiveGroup: raw.archiveGroup || raw.archive_group || '',
            createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
            updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
            deletedAt: normalizedDeletedAt
          };

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
              deletedAt: normalizedDeletedAt
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
