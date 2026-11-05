import { db, LocalBookmark, LocalGroup } from '@/db/db';
import { extractInstantMediaMetadata } from '@/lib/mediaHeuristics';

export interface ImportBookmarksOptions {
  userId?: string;
  isJson?: boolean;
}

export interface ImportBookmarksResult {
  importedBookmarksCount: number;
  importedGroupsCount: number;
}

function getAttr(el: Element, name: string): string | null {
  return (
    el.getAttribute(name.toLowerCase()) ||
    el.getAttribute(name.toUpperCase()) ||
    el.getAttribute(name) ||
    null
  );
}

/**
 * Resilient Bookmark & Group Importer
 * Unifies Markbel JSON backups and Netscape HTML browser exports.
 * Auto-populates instant media thumbnails (YouTube, GitHub, etc.) and favicons.
 */
export async function importBookmarksData(
  content: string,
  options: ImportBookmarksOptions = {}
): Promise<ImportBookmarksResult> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Import file is empty.');
  }

  const isJson =
    options.isJson !== undefined
      ? options.isJson
      : (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'));

  const now = new Date().toISOString();
  const userId = options.userId || 'local-user';

  const [existingBookmarks, existingGroups] = await Promise.all([
    db.bookmarks.toArray(),
    db.groups.toArray(),
  ]);

  const existingUrls = new Set(existingBookmarks.map((b) => b.url.toLowerCase()));
  const existingGroupNames = new Set(existingGroups.map((g) => g.name.toLowerCase()));

  let importedBookmarksCount = 0;
  let importedGroupsCount = 0;

  if (isJson) {
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e: any) {
      throw new Error(`Failed to parse JSON backup: ${e.message}`);
    }

    let rawBookmarks: any[] = [];
    let rawGroups: any[] = [];

    if (Array.isArray(parsed)) {
      rawBookmarks = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.bookmarks)) {
        rawBookmarks = parsed.bookmarks;
      }
      if (Array.isArray(parsed.groups)) {
        rawGroups = parsed.groups;
      }
    }

    // 1. Restore groups from JSON backup
    for (const g of rawGroups) {
      if (!g || typeof g.name !== 'string') continue;
      const groupName = g.name.trim();
      if (!groupName || existingGroupNames.has(groupName.toLowerCase())) continue;

      const groupId = typeof g.id === 'string' && g.id.length > 5 ? g.id : crypto.randomUUID();
      const newGroup: LocalGroup = {
        id: groupId,
        userId,
        name: groupName,
        color: g.color || '#00e5ff',
        version: typeof g.version === 'number' ? g.version : 1,
        createdAt: g.createdAt || now,
        updatedAt: g.updatedAt || now,
        deletedAt: null,
      };

      await db.transaction('rw', [db.groups, db.syncOutbox], async () => {
        await db.groups.add(newGroup);
        await db.syncOutbox.add({
          id: crypto.randomUUID(),
          entityType: 'group',
          entityId: groupId,
          operation: 'create',
          baseVersion: 0,
          payload: newGroup,
          status: 'pending',
          attempts: 0,
          createdAt: now,
        });
      });

      existingGroupNames.add(groupName.toLowerCase());
      importedGroupsCount++;
    }

    // 2. Restore bookmarks from JSON backup
    for (const b of rawBookmarks) {
      if (!b || typeof b.url !== 'string') continue;
      const url = b.url.trim();
      if (!url || url.startsWith('javascript:') || url.startsWith('data:')) continue;
      if (existingUrls.has(url.toLowerCase())) continue;

      const instant = extractInstantMediaMetadata(url);
      const bookmarkId = typeof b.id === 'string' && b.id.length > 5 ? b.id : crypto.randomUUID();
      const image = b.image || instant.image || '';
      const favicon = b.favicon || '';
      const contentType = b.contentType || instant.contentType || 'website';
      const siteName = b.siteName || instant.siteName || '';
      const description = b.description || instant.description || '';
      const title = b.title || instant.title || url;
      const group = b.group || 'Unsorted';

      // Auto-create missing group if non-default
      if (group && group !== 'Unsorted' && !existingGroupNames.has(group.toLowerCase())) {
        const groupId = crypto.randomUUID();
        const newGroup: LocalGroup = {
          id: groupId,
          userId,
          name: group,
          color: '#00e5ff',
          version: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        await db.transaction('rw', [db.groups, db.syncOutbox], async () => {
          await db.groups.add(newGroup);
          await db.syncOutbox.add({
            id: crypto.randomUUID(),
            entityType: 'group',
            entityId: groupId,
            operation: 'create',
            baseVersion: 0,
            payload: newGroup,
            status: 'pending',
            attempts: 0,
            createdAt: now,
          });
        });
        existingGroupNames.add(group.toLowerCase());
        importedGroupsCount++;
      }

      const newRecord: LocalBookmark = {
        id: bookmarkId,
        userId,
        url,
        title,
        description,
        image,
        favicon,
        siteName,
        contentType: contentType as any,
        group,
        isRead: Boolean(b.isRead),
        isPinned: Boolean(b.isPinned),
        isArchived: Boolean(b.isArchived),
        version: typeof b.version === 'number' ? b.version : 1,
        createdAt: b.createdAt || now,
        updatedAt: b.updatedAt || now,
        deletedAt: null,
      };

      await db.transaction('rw', [db.bookmarks, db.syncOutbox], async () => {
        await db.bookmarks.add(newRecord);
        await db.syncOutbox.add({
          id: crypto.randomUUID(),
          entityType: 'bookmark',
          entityId: bookmarkId,
          operation: 'create',
          baseVersion: 0,
          payload: newRecord,
          status: 'pending',
          attempts: 0,
          createdAt: now,
        });
      });

      existingUrls.add(url.toLowerCase());
      importedBookmarksCount++;
    }
  } else {
    // Netscape HTML Import
    if (typeof DOMParser === 'undefined') {
      throw new Error('DOMParser is not available in the current runtime.');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a'));

    if (anchors.length === 0) {
      throw new Error('No bookmarks found in the uploaded HTML file.');
    }

    for (const a of anchors) {
      const href = (getAttr(a, 'href'))?.trim();
      if (!href || href.startsWith('javascript:') || href.startsWith('data:')) continue;
      if (existingUrls.has(href.toLowerCase())) continue;

      const title = a.textContent?.trim() || href;
      const icon = getAttr(a, 'icon') || getAttr(a, 'favicon') || '';
      const instant = extractInstantMediaMetadata(href);

      // Group resolution from parent DL / H3 headers
      let groupName = 'Unsorted';
      const parentDl = a.closest('dl');
      if (parentDl) {
        const prevHeader = parentDl.previousElementSibling;
        if (prevHeader && /^H[1-6]$/i.test(prevHeader.tagName)) {
          const hText = prevHeader.textContent?.trim();
          if (hText && hText !== 'Bookmarks' && hText !== 'Bookmarks Bar') {
            groupName = hText;
          }
        }
      }

      // Auto-create missing group if non-default
      if (groupName && groupName !== 'Unsorted' && !existingGroupNames.has(groupName.toLowerCase())) {
        const groupId = crypto.randomUUID();
        const newGroup: LocalGroup = {
          id: groupId,
          userId,
          name: groupName,
          color: '#00e5ff',
          version: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        await db.transaction('rw', [db.groups, db.syncOutbox], async () => {
          await db.groups.add(newGroup);
          await db.syncOutbox.add({
            id: crypto.randomUUID(),
            entityType: 'group',
            entityId: groupId,
            operation: 'create',
            baseVersion: 0,
            payload: newGroup,
            status: 'pending',
            attempts: 0,
            createdAt: now,
          });
        });
        existingGroupNames.add(groupName.toLowerCase());
        importedGroupsCount++;
      }

      const bookmarkId = crypto.randomUUID();
      const newRecord: LocalBookmark = {
        id: bookmarkId,
        userId,
        url: href,
        title,
        description: instant.description || '',
        image: instant.image || '',
        favicon: icon || '',
        siteName: instant.siteName || '',
        group: groupName,
        isRead: false,
        isPinned: false,
        isArchived: false,
        contentType: (instant.contentType || 'website') as any,
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      await db.transaction('rw', [db.bookmarks, db.syncOutbox], async () => {
        await db.bookmarks.add(newRecord);
        await db.syncOutbox.add({
          id: crypto.randomUUID(),
          entityType: 'bookmark',
          entityId: bookmarkId,
          operation: 'create',
          baseVersion: 0,
          payload: newRecord,
          status: 'pending',
          attempts: 0,
          createdAt: now,
        });
      });

      existingUrls.add(href.toLowerCase());
      importedBookmarksCount++;
    }
  }

  return {
    importedBookmarksCount,
    importedGroupsCount,
  };
}
