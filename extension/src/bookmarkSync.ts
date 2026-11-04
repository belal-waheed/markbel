/**
 * Markbel Extension - Two-Way Native Browser Bookmarks Sync Engine
 * Manages bidirectional synchronization between the browser's native bookmark tree
 * (designated "Markbel Vault" folder) and the Markbel outbox delta engine.
 * Includes loop-prevention tracking and duplicate detection.
 */

import { db, LocalBookmark } from '@/db/db';
import { saveBookmark } from './api';
import { resolveSmartGroup, getCustomSmartGroupRules } from '@/lib/smartGroups';

export const MARKBEL_VAULT_FOLDER_TITLE = 'Markbel Vault';
export const STORAGE_KEY_TWO_WAY_SYNC = 'twoWayBookmarksSyncEnabled';

export class BrowserBookmarkSyncEngine {
  private isSyncing = false;
  private inFlightNodeIds = new Set<string>();

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public async isEnabled(): Promise<boolean> {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return false;
    }
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY_TWO_WAY_SYNC], (result) => {
        resolve(Boolean(result[STORAGE_KEY_TWO_WAY_SYNC]));
      });
    });
  }

  public async setEnabled(enabled: boolean): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY_TWO_WAY_SYNC]: enabled }, () => {
        resolve();
      });
    });
  }

  /**
   * Finds or creates the root "Markbel Vault" folder in the browser's bookmark bar.
   */
  public async getOrCreateVaultFolder(): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
    if (typeof chrome === 'undefined' || !chrome.bookmarks) return null;

    try {
      const searchResults = await chrome.bookmarks.search({ title: MARKBEL_VAULT_FOLDER_TITLE });
      const existing = searchResults.find((n) => !n.url && n.title === MARKBEL_VAULT_FOLDER_TITLE);
      if (existing) {
        return existing;
      }

      // Locate Bookmarks Bar root folder
      const tree = await chrome.bookmarks.getTree();
      let parentId: string | undefined;

      // In Chrome/Edge: root (id '0') -> children[0] is 'Bookmarks Bar' (id '1')
      // In Firefox: root children includes 'toolbar_____'
      if (tree[0]?.children && tree[0].children.length > 0) {
        const bar = tree[0].children.find(
          (c) =>
            c.id === '1' ||
            c.id === 'toolbar_____' ||
            /bar|toolbar/i.test(c.title || '')
        );
        parentId = bar ? bar.id : tree[0].children[0].id;
      }

      const created = await chrome.bookmarks.create({
        parentId,
        title: MARKBEL_VAULT_FOLDER_TITLE,
      });

      return created;
    } catch (err) {
      console.warn('[Markbel BookmarkSync] Failed to locate or create vault folder:', err);
      return null;
    }
  }

  /**
   * Finds or creates a group subfolder inside "Markbel Vault".
   */
  public async getOrCreateGroupFolder(groupName: string, vaultFolderId: string): Promise<string> {
    if (typeof chrome === 'undefined' || !chrome.bookmarks) return vaultFolderId;

    try {
      const children = await chrome.bookmarks.getChildren(vaultFolderId);
      const existing = children.find((c) => !c.url && c.title.toLowerCase() === groupName.toLowerCase());
      if (existing) {
        return existing.id;
      }

      const created = await chrome.bookmarks.create({
        parentId: vaultFolderId,
        title: groupName,
      });
      return created.id;
    } catch (err) {
      console.warn('[Markbel BookmarkSync] Failed to create group subfolder:', err);
      return vaultFolderId;
    }
  }

  /**
   * Checks whether a parent ID belongs to the "Markbel Vault" folder hierarchy.
   */
  public async isInsideVaultFolder(parentId?: string): Promise<{ inside: boolean; group?: string }> {
    if (!parentId || typeof chrome === 'undefined' || !chrome.bookmarks) {
      return { inside: false };
    }

    try {
      const vaultFolder = await this.getOrCreateVaultFolder();
      if (!vaultFolder) return { inside: false };

      if (parentId === vaultFolder.id) {
        return { inside: true, group: 'Unsorted' };
      }

      const nodes = await chrome.bookmarks.get(parentId);
      const parentNode = nodes[0];
      if (parentNode && parentNode.parentId === vaultFolder.id) {
        return { inside: true, group: parentNode.title || 'Unsorted' };
      }

      return { inside: false };
    } catch {
      return { inside: false };
    }
  }

  /**
   * Browser -> Markbel: Event handler when a bookmark is created natively in the browser.
   */
  public async handleNativeCreated(
    id: string,
    bookmark: chrome.bookmarks.BookmarkTreeNode
  ): Promise<void> {
    if (this.isSyncing || this.inFlightNodeIds.has(id)) return;
    if (!bookmark.url || !/^https?:\/\//i.test(bookmark.url)) return;

    const enabled = await this.isEnabled();
    if (!enabled) return;

    const { inside, group: folderGroup } = await this.isInsideVaultFolder(bookmark.parentId);
    if (!inside) return;

    try {
      this.inFlightNodeIds.add(id);

      // Check if URL already exists locally
      const existing = await db.bookmarks.where('url').equals(bookmark.url).first();
      if (existing && !existing.deletedAt) {
        return;
      }

      const customRules = await getCustomSmartGroupRules();
      const group = folderGroup && folderGroup !== 'Unsorted'
        ? folderGroup
        : resolveSmartGroup(bookmark.url, [], customRules);

      await saveBookmark({
        url: bookmark.url,
        title: bookmark.title || bookmark.url,
        group,
      });
    } catch (err) {
      console.error('[Markbel BookmarkSync] handleNativeCreated error:', err);
    } finally {
      setTimeout(() => this.inFlightNodeIds.delete(id), 1000);
    }
  }

  /**
   * Browser -> Markbel: Event handler when a bookmark is removed natively in the browser.
   */
  public async handleNativeRemoved(
    id: string,
    removeInfo: { parentId: string; node?: chrome.bookmarks.BookmarkTreeNode }
  ): Promise<void> {
    if (this.isSyncing || this.inFlightNodeIds.has(id)) return;

    const enabled = await this.isEnabled();
    if (!enabled) return;

    const { inside } = await this.isInsideVaultFolder(removeInfo.parentId);
    if (!inside) return;

    try {
      const url = removeInfo.node?.url;
      if (!url) return;

      const existing = await db.bookmarks.where('url').equals(url).first();
      if (existing && !existing.deletedAt) {
        const now = new Date().toISOString();
        const updated = {
          ...existing,
          deletedAt: now,
          updatedAt: now,
          version: existing.version + 1,
        };
        await db.bookmarks.put(updated);
        await db.syncOutbox.add({
          id: crypto.randomUUID(),
          entityType: 'bookmark',
          entityId: existing.id,
          operation: 'delete',
          baseVersion: existing.version,
          payload: { id: existing.id, deletedAt: now },
          status: 'pending',
          attempts: 0,
          createdAt: now,
        });
      }
    } catch (err) {
      console.error('[Markbel BookmarkSync] handleNativeRemoved error:', err);
    }
  }

  /**
   * Browser -> Markbel: Event handler when a bookmark is changed natively in the browser.
   */
  public async handleNativeChanged(
    id: string,
    changeInfo: { title: string; url?: string }
  ): Promise<void> {
    if (this.isSyncing || this.inFlightNodeIds.has(id)) return;

    const enabled = await this.isEnabled();
    if (!enabled) return;

    try {
      const nodes = await chrome.bookmarks.get(id);
      const node = nodes[0];
      if (!node) return;

      const { inside } = await this.isInsideVaultFolder(node.parentId);
      if (!inside) return;

      const targetUrl = changeInfo.url || node.url;
      if (!targetUrl) return;

      const existing = await db.bookmarks.where('url').equals(targetUrl).first();
      if (existing && !existing.deletedAt) {
        const now = new Date().toISOString();
        const updated = {
          ...existing,
          title: changeInfo.title || existing.title,
          url: targetUrl,
          updatedAt: now,
          version: existing.version + 1,
        };
        await db.bookmarks.put(updated);
        await db.syncOutbox.add({
          id: crypto.randomUUID(),
          entityType: 'bookmark',
          entityId: existing.id,
          operation: 'update',
          baseVersion: existing.version,
          payload: updated,
          status: 'pending',
          attempts: 0,
          createdAt: now,
        });
      }
    } catch (err) {
      console.error('[Markbel BookmarkSync] handleNativeChanged error:', err);
    }
  }

  /**
   * Markbel -> Browser: Reflects cloud/local bookmarks to the browser's "Markbel Vault" folder.
   */
  public async reflectCloudBookmarksToBrowser(bookmarks: LocalBookmark[]): Promise<number> {
    if (typeof chrome === 'undefined' || !chrome.bookmarks) return 0;
    const enabled = await this.isEnabled();
    if (!enabled) return 0;

    this.isSyncing = true;
    let reflectedCount = 0;

    try {
      const vaultFolder = await this.getOrCreateVaultFolder();
      if (!vaultFolder) return 0;

      // Retrieve all existing browser bookmarks under Markbel Vault
      const vaultSubTree = await chrome.bookmarks.getSubTree(vaultFolder.id);
      const existingUrls = new Set<string>();

      const collectUrls = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
        for (const n of nodes) {
          if (n.url) existingUrls.add(n.url.toLowerCase().trim());
          if (n.children) collectUrls(n.children);
        }
      };
      if (vaultSubTree[0]?.children) {
        collectUrls(vaultSubTree[0].children);
      }

      for (const b of bookmarks) {
        if (b.deletedAt || b.isArchived) continue;
        const normalizedUrl = b.url.toLowerCase().trim();
        if (existingUrls.has(normalizedUrl)) continue;

        const targetFolderId = await this.getOrCreateGroupFolder(b.group || 'Unsorted', vaultFolder.id);
        const createdNode = await chrome.bookmarks.create({
          parentId: targetFolderId,
          title: b.title || b.url,
          url: b.url,
        });

        this.inFlightNodeIds.add(createdNode.id);
        existingUrls.add(normalizedUrl);
        reflectedCount++;
      }
    } catch (err) {
      console.warn('[Markbel BookmarkSync] Reflection error:', err);
    } finally {
      this.isSyncing = false;
      setTimeout(() => this.inFlightNodeIds.clear(), 1000);
    }

    return reflectedCount;
  }

  /**
   * One-click Bulk Import: Traverses all browser bookmarks, skips duplicates, and saves to Markbel.
   */
  public async importAllBrowserBookmarks(): Promise<{ imported: number; skipped: number }> {
    if (typeof chrome === 'undefined' || !chrome.bookmarks) {
      return { imported: 0, skipped: 0 };
    }

    const tree = await chrome.bookmarks.getTree();
    const collected: { title: string; url: string }[] = [];

    const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      for (const n of nodes) {
        if (n.url && /^https?:\/\//i.test(n.url)) {
          collected.push({ title: n.title || n.url, url: n.url });
        }
        if (n.children) traverse(n.children);
      }
    };
    traverse(tree);

    if (collected.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    // Load existing URLs from Dexie
    const existingBookmarks = await db.bookmarks.toArray();
    const existingUrlSet = new Set(
      existingBookmarks.filter((b) => !b.deletedAt).map((b) => b.url.toLowerCase().trim())
    );

    let imported = 0;
    let skipped = 0;

    const customRules = await getCustomSmartGroupRules();

    for (const item of collected) {
      const normalized = item.url.toLowerCase().trim();
      if (existingUrlSet.has(normalized)) {
        skipped++;
        continue;
      }

      const group = resolveSmartGroup(item.url, [], customRules);
      await saveBookmark({
        url: item.url,
        title: item.title,
        group,
      });

      existingUrlSet.add(normalized);
      imported++;
    }

    return { imported, skipped };
  }
}

export const browserBookmarkSync = new BrowserBookmarkSyncEngine();
