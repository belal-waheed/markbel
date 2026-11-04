import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { normalizeSyncRecord } from "../normalize";
import { extractInstantMediaMetadata } from "../../../src/lib/mediaHeuristics";
import { sanitizeAndCleanUrl } from "../../../src/lib/urlSafety";

export const syncRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const SyncChangeSchema = z.object({
  changeId: z.string().min(1, "changeId is required"),
  entityType: z.enum(["bookmark", "group"]),
  entityId: z.string().min(1, "entityId is required"),
  operation: z.enum(["create", "update", "delete"]),
  baseVersion: z.number().optional().default(0),
  payload: z.record(z.string(), z.any()).nullish().default({}),
});

const SyncMutationsPayloadSchema = z.object({
  deviceId: z.string().optional(),
  protocolVersion: z.union([z.string(), z.number()]).optional(),
  requestId: z.string().optional(),
  changes: z.array(SyncChangeSchema),
});

syncRouter.post("/api/sync/mutations", authMiddleware, async (c) => {
  const vaultRole = c.get("vaultRole");
  if (vaultRole === "viewer") {
    return c.json({ error: "Forbidden: viewer role cannot mutate shared vault" }, 403);
  }
  const userId = c.get("vaultOwnerId") || c.get("userId");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parseResult = SyncMutationsPayloadSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: "Invalid push payload",
        details: parseResult.error.errors,
      },
      400
    );
  }

  const { deviceId, changes } = parseResult.data;

  if (changes.length === 0) {
    return c.json({ results: [] });
  }

  // 1. Prefetch existing sync changes for idempotency check in batch
  const changeIds = changes.map((ch) => ch.changeId);
  const existingSyncMap = new Map<string, { sequence: number; entity_version: number }>();

  if (changeIds.length > 0) {
    const placeholders = changeIds.map(() => "?").join(", ");
    const { results: existingChanges } = await c.env.DB.prepare(
      `SELECT client_change_id, sequence, entity_version FROM sync_changes WHERE client_change_id IN (${placeholders})`
    )
      .bind(...changeIds)
      .all();

    for (const row of existingChanges || []) {
      existingSyncMap.set((row as any).client_change_id, {
        sequence: (row as any).sequence,
        entity_version: (row as any).entity_version,
      });
    }
  }

  // 2. Prefetch current database records for affected bookmarks and groups
  const bookmarkIds = Array.from(
    new Set(changes.filter((c) => c.entityType === "bookmark").map((c) => c.entityId))
  );
  const groupIds = Array.from(
    new Set(changes.filter((c) => c.entityType === "group").map((c) => c.entityId))
  );

  const currentBookmarkMap = new Map<string, any>();
  if (bookmarkIds.length > 0) {
    const placeholders = bookmarkIds.map(() => "?").join(", ");
    const { results: bookmarks } = await c.env.DB.prepare(
      `SELECT * FROM bookmarks WHERE user_id = ? AND id IN (${placeholders})`
    )
      .bind(userId, ...bookmarkIds)
      .all();

    for (const b of bookmarks || []) {
      currentBookmarkMap.set((b as any).id, b);
    }
  }

  const currentGroupMap = new Map<string, any>();
  if (groupIds.length > 0) {
    const placeholders = groupIds.map(() => "?").join(", ");
    const { results: groups } = await c.env.DB.prepare(
      `SELECT * FROM groups WHERE user_id = ? AND id IN (${placeholders})`
    )
      .bind(userId, ...groupIds)
      .all();

    for (const g of groups || []) {
      currentGroupMap.set((g as any).id, g);
    }
  }

  const results: any[] = [];
  const statements: D1PreparedStatement[] = [];
  const pendingApplied: any[] = [];

  for (const change of changes) {
    const { changeId, entityType, entityId, operation, baseVersion = 0 } = change;
    const payload = change.payload || {};

    // 1. Idempotency Check
    const existingSync = existingSyncMap.get(changeId);
    if (existingSync) {
      results.push({
        changeId,
        entityId,
        status: "duplicate",
        version: existingSync.entity_version,
      });
      continue;
    }

    try {
      const now = new Date().toISOString();
      const currentRecord =
        entityType === "bookmark"
          ? currentBookmarkMap.get(entityId)
          : currentGroupMap.get(entityId);

      const currentVersion = currentRecord ? currentRecord.version : 0;

      // 2. Conflict & LWW Evaluation
      if (operation !== "create" && currentVersion !== baseVersion) {
        let isLWWWinner = false;
        if (
          operation === "update" &&
          payload &&
          payload.updatedAt &&
          currentRecord &&
          currentRecord.updated_at
        ) {
          const incomingTime = new Date(payload.updatedAt).getTime();
          const serverTime = new Date(currentRecord.updated_at).getTime();
          if (incomingTime >= serverTime) {
            isLWWWinner = true;
          }
        }

        if (!isLWWWinner) {
          results.push({
            changeId,
            entityId,
            status: "conflict",
            clientBaseVersion: baseVersion,
            serverVersion: currentVersion,
            serverRecord: currentRecord,
          });
          continue;
        }
      }

      const newVersion = currentVersion + 1;
      let recordJson = "";

      // 3. Accumulate changes for D1 SQLite
      if (entityType === "bookmark") {
        if (operation === "create") {
          let bookmarkTitle = (payload.title || "").trim();
          let bookmarkUrl = (payload.url || "").trim();
          if (bookmarkUrl) {
            try {
              bookmarkUrl = sanitizeAndCleanUrl(bookmarkUrl).cleanUrlStr;
            } catch {}
          }
          let bookmarkImage = (payload.image || "").trim();
          let bookmarkSiteName = (payload.siteName || payload.site_name || "").trim();
          let bookmarkDescription = (payload.description || "").trim();

          // 1. If image is empty or title is empty or identical to url, apply instant heuristics
          if (!bookmarkImage || !bookmarkTitle || bookmarkTitle === bookmarkUrl) {
            const instant = extractInstantMediaMetadata(bookmarkUrl);
            if (instant.image && !bookmarkImage) {
              bookmarkImage = instant.image;
            }
            if (instant.title && (!bookmarkTitle || bookmarkTitle === bookmarkUrl)) {
              bookmarkTitle = instant.title;
            }
            if (instant.siteName && !bookmarkSiteName) {
              bookmarkSiteName = instant.siteName;
            }
            if (instant.description && !bookmarkDescription) {
              bookmarkDescription = instant.description;
            }
          }

          // 2. Fallback title if still empty
          if (!bookmarkTitle && bookmarkUrl) {
            try {
              bookmarkTitle = new URL(bookmarkUrl).hostname.replace(/^www\./, "");
            } catch {
              bookmarkTitle = bookmarkUrl;
            }
          } else if (!bookmarkTitle) {
            bookmarkTitle = "Saved Bookmark";
          }

          const createdAt = payload.createdAt || now;
          const updatedAt = payload.updatedAt || now;

          statements.push(
            c.env.DB.prepare(
              `INSERT INTO bookmarks (id, user_id, title, url, description, image, favicon, site_name, author, published_at, content_type, reading_time, word_count, canonical_url, article_content, group_name, is_read, read_at, is_pinned, remind_at, is_archived, archive_group, version, created_at, updated_at, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
            ).bind(
              entityId,
              userId,
              bookmarkTitle,
              bookmarkUrl,
              bookmarkDescription,
              bookmarkImage,
              payload.favicon || "",
              bookmarkSiteName,
              payload.author || "",
              payload.publishedAt || "",
              payload.contentType || "website",
              payload.readingTime || 0,
              payload.wordCount || 0,
              payload.canonicalUrl || "",
              payload.articleContent || "",
              payload.group || "Unsorted",
              payload.isRead ? 1 : 0,
              payload.readAt || "",
              payload.isPinned ? 1 : 0,
              payload.remindAt || "",
              payload.isArchived ? 1 : 0,
              payload.archiveGroup || "",
              newVersion,
              createdAt,
              updatedAt
            )
          );

          const savedBookmark = {
            id: entityId,
            user_id: userId,
            title: bookmarkTitle,
            url: bookmarkUrl,
            description: bookmarkDescription,
            image: bookmarkImage,
            favicon: payload.favicon || "",
            site_name: bookmarkSiteName,
            author: payload.author || "",
            published_at: payload.publishedAt || "",
            content_type: payload.contentType || "website",
            reading_time: payload.readingTime || 0,
            word_count: payload.wordCount || 0,
            canonical_url: payload.canonicalUrl || "",
            article_content: payload.articleContent || "",
            group_name: payload.group || "Unsorted",
            is_read: payload.isRead ? 1 : 0,
            read_at: payload.readAt || "",
            is_pinned: payload.isPinned ? 1 : 0,
            remind_at: payload.remindAt || "",
            is_archived: payload.isArchived ? 1 : 0,
            archive_group: payload.archiveGroup || "",
            version: newVersion,
            created_at: createdAt,
            updated_at: updatedAt,
            deleted_at: null,
          };
          currentBookmarkMap.set(entityId, savedBookmark);
          recordJson = JSON.stringify(normalizeSyncRecord(savedBookmark, "bookmark"));
        } else if (operation === "update") {
          const updatedAt = payload.updatedAt || now;
          let cleanedUrl = payload.url;
          if (typeof payload.url === "string" && payload.url.trim()) {
            try {
              cleanedUrl = sanitizeAndCleanUrl(payload.url.trim()).cleanUrlStr;
            } catch {
              cleanedUrl = payload.url.trim();
            }
          }

          statements.push(
            c.env.DB.prepare(
              `UPDATE bookmarks SET 
                title = COALESCE(?, title),
                url = COALESCE(?, url),
                description = COALESCE(?, description),
                image = COALESCE(?, image),
                favicon = COALESCE(?, favicon),
                site_name = COALESCE(?, site_name),
                author = COALESCE(?, author),
                published_at = COALESCE(?, published_at),
                content_type = COALESCE(?, content_type),
                reading_time = COALESCE(?, reading_time),
                word_count = COALESCE(?, word_count),
                canonical_url = COALESCE(?, canonical_url),
                article_content = COALESCE(?, article_content),
                group_name = COALESCE(?, group_name),
                is_read = COALESCE(?, is_read),
                read_at = COALESCE(?, read_at),
                is_pinned = COALESCE(?, is_pinned),
                remind_at = COALESCE(?, remind_at),
                is_archived = COALESCE(?, is_archived),
                archive_group = COALESCE(?, archive_group),
                version = ?,
                updated_at = ?
               WHERE id = ? AND user_id = ?`
            ).bind(
              payload.title ?? null,
              cleanedUrl ?? null,
              payload.description ?? null,
              payload.image ?? null,
              payload.favicon ?? null,
              payload.siteName ?? payload.site_name ?? null,
              payload.author ?? null,
              payload.publishedAt ?? payload.published_at ?? null,
              payload.contentType ?? payload.content_type ?? null,
              payload.readingTime ?? payload.reading_time ?? null,
              payload.wordCount ?? payload.word_count ?? null,
              payload.canonicalUrl ?? payload.canonical_url ?? null,
              payload.articleContent ?? payload.article_content ?? null,
              payload.group ?? payload.group_name ?? null,
              payload.isRead !== undefined ? (payload.isRead ? 1 : 0) : null,
              payload.readAt ?? payload.read_at ?? null,
              payload.isPinned !== undefined ? (payload.isPinned ? 1 : 0) : null,
              payload.remindAt ?? payload.remind_at ?? null,
              payload.isArchived !== undefined ? (payload.isArchived ? 1 : 0) : null,
              payload.archiveGroup ?? payload.archive_group ?? null,
              newVersion,
              updatedAt,
              entityId,
              userId
            )
          );

          const updatedBookmark = {
            ...(currentRecord || {}),
            id: entityId,
            user_id: userId,
            title: payload.title !== undefined ? payload.title : currentRecord?.title,
            url: cleanedUrl !== undefined ? cleanedUrl : currentRecord?.url,
            description: payload.description !== undefined ? payload.description : currentRecord?.description,
            image: payload.image !== undefined ? payload.image : currentRecord?.image,
            favicon: payload.favicon !== undefined ? payload.favicon : currentRecord?.favicon,
            site_name: (payload.siteName ?? payload.site_name) !== undefined ? (payload.siteName ?? payload.site_name) : currentRecord?.site_name,
            author: payload.author !== undefined ? payload.author : currentRecord?.author,
            published_at: (payload.publishedAt ?? payload.published_at) !== undefined ? (payload.publishedAt ?? payload.published_at) : currentRecord?.published_at,
            content_type: (payload.contentType ?? payload.content_type) !== undefined ? (payload.contentType ?? payload.content_type) : currentRecord?.content_type,
            reading_time: (payload.readingTime ?? payload.reading_time) !== undefined ? (payload.readingTime ?? payload.reading_time) : currentRecord?.reading_time,
            word_count: (payload.wordCount ?? payload.word_count) !== undefined ? (payload.wordCount ?? payload.word_count) : currentRecord?.word_count,
            canonical_url: (payload.canonicalUrl ?? payload.canonical_url) !== undefined ? (payload.canonicalUrl ?? payload.canonical_url) : currentRecord?.canonical_url,
            article_content: (payload.articleContent ?? payload.article_content) !== undefined ? (payload.articleContent ?? payload.article_content) : currentRecord?.article_content,
            group_name: (payload.group ?? payload.group_name) !== undefined ? (payload.group ?? payload.group_name) : currentRecord?.group_name,
            is_read: payload.isRead !== undefined ? (payload.isRead ? 1 : 0) : currentRecord?.is_read,
            read_at: (payload.readAt ?? payload.read_at) !== undefined ? (payload.readAt ?? payload.read_at) : currentRecord?.read_at,
            is_pinned: payload.isPinned !== undefined ? (payload.isPinned ? 1 : 0) : currentRecord?.is_pinned,
            remind_at: (payload.remindAt ?? payload.remind_at) !== undefined ? (payload.remindAt ?? payload.remind_at) : currentRecord?.remind_at,
            is_archived: payload.isArchived !== undefined ? (payload.isArchived ? 1 : 0) : currentRecord?.is_archived,
            archive_group: (payload.archiveGroup ?? payload.archive_group) !== undefined ? (payload.archiveGroup ?? payload.archive_group) : currentRecord?.archive_group,
            version: newVersion,
            updated_at: updatedAt,
          };
          currentBookmarkMap.set(entityId, updatedBookmark);
          recordJson = JSON.stringify(normalizeSyncRecord(updatedBookmark, "bookmark"));
        } else if (operation === "delete") {
          statements.push(
            c.env.DB.prepare(
              "UPDATE bookmarks SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
            ).bind(now, newVersion, now, entityId, userId)
          );

          const deletedBookmark = {
            ...(currentRecord || {}),
            id: entityId,
            user_id: userId,
            deleted_at: now,
            version: newVersion,
            updated_at: now,
          };
          currentBookmarkMap.set(entityId, deletedBookmark);
          recordJson = JSON.stringify(normalizeSyncRecord(deletedBookmark, "bookmark"));
        }
      } else if (entityType === "group") {
        if (operation === "create") {
          const createdAt = payload.createdAt || now;
          const updatedAt = payload.updatedAt || now;

          statements.push(
            c.env.DB.prepare(
              "INSERT INTO groups (id, user_id, name, color, version, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)"
            ).bind(
              entityId,
              userId,
              payload.name || "New Group",
              payload.color || "blue",
              newVersion,
              createdAt,
              updatedAt
            )
          );

          const savedGroup = {
            id: entityId,
            user_id: userId,
            name: payload.name || "New Group",
            color: payload.color || "blue",
            version: newVersion,
            created_at: createdAt,
            updated_at: updatedAt,
            deleted_at: null,
          };
          currentGroupMap.set(entityId, savedGroup);
          recordJson = JSON.stringify(normalizeSyncRecord(savedGroup, "group"));
        } else if (operation === "update") {
          const oldName = currentRecord?.name;
          const updatedAt = payload.updatedAt || now;

          statements.push(
            c.env.DB.prepare(
              "UPDATE groups SET name = COALESCE(?, name), color = COALESCE(?, color), version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
            ).bind(
              payload.name ?? null,
              payload.color ?? null,
              newVersion,
              updatedAt,
              entityId,
              userId
            )
          );

          // Cascade group rename to bookmarks in D1
          if (payload.name && oldName && oldName !== payload.name) {
            const { results: affectedBookmarks } = await c.env.DB.prepare(
              "SELECT * FROM bookmarks WHERE user_id = ? AND group_name = ? AND deleted_at IS NULL"
            ).bind(userId, oldName).all();

            for (const bm of (affectedBookmarks || []) as any[]) {
              const bmNewVersion = (bm.version || 0) + 1;
              const bmUpdatedAt = now;
              statements.push(
                c.env.DB.prepare(
                  "UPDATE bookmarks SET group_name = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
                ).bind(payload.name, bmNewVersion, bmUpdatedAt, bm.id, userId)
              );

              const updatedBmRecord = {
                ...bm,
                group_name: payload.name,
                version: bmNewVersion,
                updated_at: bmUpdatedAt,
              };
              currentBookmarkMap.set(bm.id, updatedBmRecord);
              const bmRecordJson = JSON.stringify(normalizeSyncRecord(updatedBmRecord, "bookmark"));
              const bmClientChangeId = `cascade-rename-${entityId}-${bm.id}-${now}`;

              statements.push(
                c.env.DB.prepare(
                  `INSERT INTO sync_changes (user_id, entity_type, entity_id, operation, entity_version, client_change_id, record_json, changed_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(userId, "bookmark", bm.id, "update", bmNewVersion, bmClientChangeId, bmRecordJson, now)
              );
            }
          }

          const updatedGroup = {
            ...(currentRecord || {}),
            id: entityId,
            user_id: userId,
            name: payload.name !== undefined ? payload.name : currentRecord?.name,
            color: payload.color !== undefined ? payload.color : currentRecord?.color,
            version: newVersion,
            updated_at: updatedAt,
          };
          currentGroupMap.set(entityId, updatedGroup);
          recordJson = JSON.stringify(normalizeSyncRecord(updatedGroup, "group"));
        } else if (operation === "delete") {
          statements.push(
            c.env.DB.prepare(
              "UPDATE groups SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
            ).bind(now, newVersion, now, entityId, userId)
          );

          const existingGroupName = currentRecord?.name;
          if (existingGroupName) {
            const { results: affectedBookmarks } = await c.env.DB.prepare(
              "SELECT * FROM bookmarks WHERE user_id = ? AND group_name = ? AND deleted_at IS NULL"
            ).bind(userId, existingGroupName).all();

            for (const bm of (affectedBookmarks || []) as any[]) {
              const bmNewVersion = (bm.version || 0) + 1;
              const bmUpdatedAt = now;
              statements.push(
                c.env.DB.prepare(
                  "UPDATE bookmarks SET group_name = 'Unsorted', version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
                ).bind(bmNewVersion, bmUpdatedAt, bm.id, userId)
              );

              const updatedBmRecord = {
                ...bm,
                group_name: "Unsorted",
                version: bmNewVersion,
                updated_at: bmUpdatedAt,
              };
              currentBookmarkMap.set(bm.id, updatedBmRecord);
              const bmRecordJson = JSON.stringify(normalizeSyncRecord(updatedBmRecord, "bookmark"));
              const bmClientChangeId = `cascade-delete-${entityId}-${bm.id}-${now}`;

              statements.push(
                c.env.DB.prepare(
                  `INSERT INTO sync_changes (user_id, entity_type, entity_id, operation, entity_version, client_change_id, record_json, changed_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(userId, "bookmark", bm.id, "update", bmNewVersion, bmClientChangeId, bmRecordJson, now)
              );
            }
          }

          const deletedGroup = {
            ...(currentRecord || {}),
            id: entityId,
            user_id: userId,
            deleted_at: now,
            version: newVersion,
            updated_at: now,
          };
          currentGroupMap.set(entityId, deletedGroup);
          recordJson = JSON.stringify(normalizeSyncRecord(deletedGroup, "group"));
        }
      }

      // 4. Accumulate sync_changes insert statement
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO sync_changes (user_id, entity_type, entity_id, operation, entity_version, client_change_id, record_json, changed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, entityType, entityId, operation, newVersion, changeId, recordJson, now)
      );

      pendingApplied.push({
        changeId,
        entityId,
        status: "applied",
        version: newVersion,
      });
    } catch (err: any) {
      console.error(`[Sync Push Error] ${changeId}:`, err);
      results.push({
        changeId,
        entityId,
        status: "rejected",
        reason: err.message,
      });
    }
  }

  // 5. Execute all accumulated prepared statements in a single D1 batch
  if (statements.length > 0) {
    try {
      const BATCH_CHUNK_SIZE = 100;
      for (let i = 0; i < statements.length; i += BATCH_CHUNK_SIZE) {
        const chunk = statements.slice(i, i + BATCH_CHUNK_SIZE);
        await c.env.DB.batch(chunk);
      }
      for (const item of pendingApplied) {
        results.push(item);
      }
    } catch (batchErr: any) {
      console.error("[Sync Push Batch Error]:", batchErr);
      for (const item of pendingApplied) {
        results.push({
          changeId: item.changeId,
          entityId: item.entityId,
          status: "rejected",
          reason: batchErr?.message || "Failed to commit database batch",
        });
      }
    }
  }

  return c.json({ results });
});

syncRouter.get("/api/sync/pull", authMiddleware, async (c) => {
  const userId = c.get("vaultOwnerId") || c.get("userId");
  const cursor = parseInt(c.req.query("cursor") || "0", 10);
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 500);
  const entityType = c.req.query("entity");

  let query = "SELECT * FROM sync_changes WHERE user_id = ? AND sequence > ?";
  const params: any[] = [userId, cursor];

  if (entityType) {
    query += " AND entity_type = ?";
    params.push(entityType);
  }

  query += " ORDER BY sequence ASC LIMIT ?";
  params.push(limit);

  const { results: changes } = await c.env.DB.prepare(query)
    .bind(...params)
    .all();

  const formattedChanges = (changes || []).map((ch: any) => {
    let parsedRecord = null;
    try {
      parsedRecord = ch.record_json ? JSON.parse(ch.record_json) : null;
    } catch {}

    const normalized = normalizeSyncRecord(parsedRecord, ch.entity_type);

    return {
      sequence: ch.sequence,
      entityType: ch.entity_type,
      entityId: ch.entity_id,
      operation: ch.operation,
      version: ch.entity_version,
      payload: normalized,
      record: normalized,
      deletedAt: ch.operation === "delete" ? (normalized?.deleted_at || ch.changed_at) : null,
    };
  });

  const nextCursor =
    changes && changes.length > 0 ? (changes[changes.length - 1] as any).sequence : cursor;
  const hasMore = changes ? changes.length === limit : false;

  const clientEtag = c.req.header("if-none-match");
  if ((!changes || changes.length === 0) && clientEtag === `W/"cursor-${cursor}"`) {
    return c.body(null, 304, {
      "ETag": `W/"cursor-${cursor}"`,
      "Cache-Control": "private, no-cache",
    });
  }

  c.header("ETag", `W/"cursor-${nextCursor}"`);
  c.header("Cache-Control", "private, no-cache");

  return c.json({
    changes: formattedChanges,
    nextCursor,
    hasMore,
  });
});

syncRouter.post("/api/sync/compact", authMiddleware, async (c) => {
  const userId = c.get("vaultOwnerId") || c.get("userId");
  await c.env.DB.prepare(
    `DELETE FROM sync_changes WHERE user_id = ? AND sequence NOT IN (SELECT MAX(sequence) FROM sync_changes WHERE user_id = ? GROUP BY entity_type, entity_id)`
  )
    .bind(userId, userId)
    .run();

  return c.json({ success: true, message: "Sync delta log compacted successfully" });
});
