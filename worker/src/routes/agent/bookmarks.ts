import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../../types";
import { requireScope, requireVaultRole } from "../../middleware/auth";
import { normalizeSyncRecord } from "../../normalize";
import { extractInstantMediaMetadata } from "../../../../src/lib/mediaHeuristics";
import { resolveSmartGroup, type CompoundSmartGroupRule, type CustomGroupRule } from "../../../../src/lib/smartGroups";
import {
  BookmarkDbRow,
  GroupDbRow,
  CountDbRow,
  UserSettingsDbRow,
  generateSearchSnippet,
  getErrorMessage,
} from "./common";

// Zod Input Validation Schemas
const searchParamsSchema = z.object({
  q: z.string().max(250).optional().default(""),
  group: z.string().max(100).optional().default(""),
  is_read: z.enum(["true", "false"]).optional(),
  is_archived: z.enum(["true", "false", "all"]).optional().default("false"),
  is_pinned: z.enum(["true", "false"]).optional(),
  include_content: z.enum(["true", "false"]).optional().default("false"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const createBookmarkSchema = z.object({
  url: z.string().url().max(2048),
  title: z.string().max(500).optional(),
  description: z.string().max(4000).optional(),
  group: z.string().max(100).optional(),
  isPinned: z.boolean().optional(),
  remindAt: z.string().max(100).optional(),
});

const updateBookmarkSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(4000).optional(),
  group: z.string().max(100).optional(),
  isRead: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  remindAt: z.string().max(100).optional(),
  isArchived: z.boolean().optional(),
});

const batchOperationsSchema = z.object({
  operations: z
    .array(
      z.object({
        action: z.enum(["update", "archive", "delete"]),
        id: z.string().min(1).max(100),
        data: updateBookmarkSchema.optional(),
      })
    )
    .min(1)
    .max(100),
});

export const agentBookmarksRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKMARKS SEARCH & RETRIEVAL (bookmarks:read)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentBookmarksRouter.get("/bookmarks/search", requireScope("bookmarks:read"), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");
    const queryResult = searchParamsSchema.safeParse(c.req.query());
    if (!queryResult.success) {
      return c.json({ error: "Invalid search query parameters", details: queryResult.error.format() }, 400);
    }

    const { q, group, is_read, is_archived, is_pinned, include_content, limit, offset } = queryResult.data;

    const conditions: string[] = ["user_id = ?", "deleted_at IS NULL"];
    const params: (string | number)[] = [userId];

    // Archive filter
    if (is_archived === "true") {
      conditions.push("is_archived = 1");
    } else if (is_archived !== "all") {
      conditions.push("is_archived = 0");
    }

    // Read filter
    if (is_read === "true") {
      conditions.push("is_read = 1");
    } else if (is_read === "false") {
      conditions.push("is_read = 0");
    }

    // Pinned filter
    if (is_pinned === "true") {
      conditions.push("is_pinned = 1");
    } else if (is_pinned === "false") {
      conditions.push("is_pinned = 0");
    }

    // Group filter
    if (group) {
      conditions.push("LOWER(group_name) = LOWER(?)");
      params.push(group);
    }

    // Search query matching title, URL, description, site name, and article content
    const rawQuery = q ? q.trim() : "";
    const terms = rawQuery ? rawQuery.split(/\s+/).filter(Boolean).slice(0, 5) : [];

    if (terms.length > 0) {
      for (const term of terms) {
        const termLike = `%${term.toLowerCase()}%`;
        conditions.push(
          "(LOWER(title) LIKE ? OR LOWER(url) LIKE ? OR LOWER(description) LIKE ? OR LOWER(site_name) LIKE ? OR LOWER(article_content) LIKE ?)"
        );
        params.push(termLike, termLike, termLike, termLike, termLike);
      }
    }

    // Compute total count matching filter
    const countSql = `SELECT COUNT(*) as total FROM bookmarks WHERE ${conditions.join(" AND ")}`;
    const countRow = await c.env.DB.prepare(countSql).bind(...params).first<CountDbRow>();
    const total = Number(countRow?.total || 0);

    // Multi-attribute relevance ranking when search query is present
    let orderBy = "ORDER BY is_pinned DESC, updated_at DESC";
    const queryParams: (string | number)[] = [...params];

    if (rawQuery) {
      const qLower = rawQuery.toLowerCase();
      const exactTitle = qLower;
      const startsTitle = `${qLower}%`;
      const containsTerm = `%${qLower}%`;

      orderBy = `ORDER BY (CASE 
        WHEN LOWER(title) = ? OR LOWER(title) LIKE ? THEN 1 
        WHEN LOWER(title) LIKE ? THEN 2 
        WHEN LOWER(site_name) LIKE ? THEN 3 
        WHEN LOWER(url) LIKE ? THEN 4 
        WHEN LOWER(description) LIKE ? THEN 5 
        WHEN LOWER(article_content) LIKE ? THEN 6 
        ELSE 7 
      END) ASC, is_pinned DESC, updated_at DESC`;
      queryParams.push(exactTitle, startsTitle, containsTerm, containsTerm, containsTerm, containsTerm, containsTerm);
    }

    queryParams.push(limit, offset);

    const selectSql = `SELECT * FROM bookmarks WHERE ${conditions.join(" AND ")} ${orderBy} LIMIT ? OFFSET ?`;
    const { results } = await c.env.DB.prepare(selectSql).bind(...queryParams).all<BookmarkDbRow>();

    const items = (results || []).map((row) => {
      const norm = normalizeSyncRecord(row, "bookmark");
      if (include_content !== "true") {
        norm.articleContent = "";
        norm.article_content = "";
      }
      if (terms.length > 0) {
        const snippet = generateSearchSnippet(row.description, row.article_content, terms);
        if (snippet) {
          norm.snippet = snippet;
        }
      }
      return norm;
    });

    return c.json({
      items,
      total,
      limit,
      offset,
    });
  } catch (err: unknown) {
    const message = getErrorMessage(err, "Failed to search bookmarks");
    console.error("[Agent Search Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentBookmarksRouter.get("/bookmarks/:id", requireScope("bookmarks:read"), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");
    const id = c.req.param("id");

    const row = await c.env.DB.prepare(
      "SELECT * FROM bookmarks WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
    )
      .bind(id, userId)
      .first<BookmarkDbRow>();

    if (!row) {
      return c.json({ error: "Bookmark not found" }, 404);
    }

    const bookmark = normalizeSyncRecord(row, "bookmark");
    return c.json(bookmark);
  } catch (err: unknown) {
    const message = getErrorMessage(err, "Failed to retrieve bookmark");
    return c.json({ error: message }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKMARKS MUTATIONS (bookmarks:write)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentBookmarksRouter.post("/bookmarks", requireScope("bookmarks:write"), requireVaultRole(["owner", "editor"]), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");
    const actorType = c.get("actorType") || "agent";
    const actorName = c.get("actorName") || "Agent";
    
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON request body" }, 400);
    }

    const parseResult = createBookmarkSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return c.json({ error: "Invalid bookmark input", details: parseResult.error.format() }, 400);
    }

    const body = parseResult.data;
    const cleanUrl = body.url;

    // Extract instant media heuristics for title, description, image, and site name
    const instant = extractInstantMediaMetadata(cleanUrl);

    let title = (body.title || "").trim();
    let description = (body.description || "").trim();
    const image = instant.image || "";
    const siteName = instant.siteName || "";
    const favicon = "";

    if (!title || title === cleanUrl) {
      if (instant.title) {
        title = instant.title;
      } else {
        try {
          title = new URL(cleanUrl).hostname.replace(/^www\./, "");
        } catch {
          title = "Saved Bookmark";
        }
      }
    }

    if (!description && instant.description) {
      description = instant.description;
    }

    // Resolve smart group if not explicitly specified
    let group = (body.group || "").trim();
    if (!group) {
      const { results: userGroups } = await c.env.DB.prepare(
        "SELECT name FROM groups WHERE user_id = ? AND deleted_at IS NULL"
      )
        .bind(userId)
        .all<GroupDbRow>();
      const groupNames = (userGroups || []).map((g) => g.name);

      let customRules: (CompoundSmartGroupRule | CustomGroupRule)[] = [];
      try {
        const settingsRow = await c.env.DB.prepare(
          "SELECT rules_json FROM user_settings WHERE user_id = ?"
        )
          .bind(userId)
          .first<UserSettingsDbRow>();
        if (settingsRow && settingsRow.rules_json) {
          customRules = JSON.parse(settingsRow.rules_json);
        }
      } catch {}

      group = resolveSmartGroup(cleanUrl, groupNames, customRules);
    }

    if (!group) {
      group = "Unsorted";
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isPinned = Boolean(body.isPinned);
    const remindAt = body.remindAt ? body.remindAt.trim() : "";
    const version = 1;
    const clientChangeId = `agent_${crypto.randomUUID()}`;

    const bookmarkRow = {
      id,
      user_id: userId,
      title,
      url: cleanUrl,
      description,
      image,
      favicon,
      site_name: siteName,
      author: "",
      published_at: "",
      content_type: "website",
      reading_time: 0,
      word_count: 0,
      canonical_url: cleanUrl,
      article_content: "",
      group_name: group,
      is_read: 0,
      read_at: "",
      is_pinned: isPinned ? 1 : 0,
      remind_at: remindAt,
      is_archived: 0,
      archive_group: "",
      actor_type: actorType,
      actor_name: actorName,
      version,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    const normalized = normalizeSyncRecord(bookmarkRow, "bookmark");
    const recordJson = JSON.stringify(normalized);

    // CRITICAL SYNC INVARIANT: D1 batch inserting into bookmarks and sync_changes
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO bookmarks (
          id, user_id, title, url, description, image, favicon, site_name,
          author, published_at, content_type, reading_time, word_count, canonical_url,
          article_content, group_name, is_read, read_at, is_pinned, remind_at,
          is_archived, archive_group, actor_type, actor_name, version, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      ).bind(
        id,
        userId,
        title,
        cleanUrl,
        description,
        image,
        favicon,
        siteName,
        "",
        "",
        "website",
        0,
        0,
        cleanUrl,
        "",
        group,
        0,
        "",
        isPinned ? 1 : 0,
        remindAt,
        0,
        "",
        actorType,
        actorName,
        version,
        now,
        now
      ),
      c.env.DB.prepare(
        `INSERT INTO sync_changes (
          user_id, entity_type, entity_id, operation, entity_version, client_change_id, actor_type, actor_name, record_json, changed_at
        ) VALUES (?, 'bookmark', ?, 'create', ?, ?, ?, ?, ?, ?)`
      ).bind(userId, id, version, clientChangeId, actorType, actorName, recordJson, now),
    ]);

    return c.json(normalized, 201);
  } catch (err: unknown) {
    const message = getErrorMessage(err, "Failed to create bookmark");
    console.error("[Agent Create Bookmark Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentBookmarksRouter.patch("/bookmarks/:id", requireScope("bookmarks:write"), requireVaultRole(["owner", "editor"]), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");
    const actorType = c.get("actorType") || "agent";
    const actorName = c.get("actorName") || "Agent";
    const id = c.req.param("id");

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON request body" }, 400);
    }

    const parseResult = updateBookmarkSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return c.json({ error: "Invalid bookmark update input", details: parseResult.error.format() }, 400);
    }

    const body = parseResult.data;

    const current = await c.env.DB.prepare(
      "SELECT * FROM bookmarks WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
    )
      .bind(id, userId)
      .first<BookmarkDbRow>();

    if (!current) {
      return c.json({ error: "Bookmark not found" }, 404);
    }

    const now = new Date().toISOString();
    const newVersion = (current.version || 0) + 1;
    const clientChangeId = `agent_${crypto.randomUUID()}`;

    const title = body.title !== undefined ? body.title.trim() : current.title;
    const description = body.description !== undefined ? body.description.trim() : current.description;
    const groupName = body.group !== undefined ? body.group.trim() : current.group_name;
    const isRead = body.isRead !== undefined ? (body.isRead ? 1 : 0) : current.is_read;
    const readAt = body.isRead !== undefined ? (body.isRead ? (current.read_at || now) : "") : current.read_at;
    const isPinned = body.isPinned !== undefined ? (body.isPinned ? 1 : 0) : current.is_pinned;
    const remindAt = body.remindAt !== undefined ? body.remindAt.trim() : current.remind_at;
    const isArchived = body.isArchived !== undefined ? (body.isArchived ? 1 : 0) : current.is_archived;

    const updatedRow: BookmarkDbRow = {
      ...current,
      title,
      description,
      group_name: groupName,
      is_read: isRead,
      read_at: readAt,
      is_pinned: isPinned,
      remind_at: remindAt,
      is_archived: isArchived,
      actor_type: actorType,
      actor_name: actorName,
      version: newVersion,
      updated_at: now,
    };

    const normalized = normalizeSyncRecord(updatedRow, "bookmark");
    const recordJson = JSON.stringify(normalized);

    // CRITICAL SYNC INVARIANT: D1 batch update + sync_changes log
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE bookmarks SET
          title = ?, description = ?, group_name = ?, is_read = ?, read_at = ?,
          is_pinned = ?, remind_at = ?, is_archived = ?, actor_type = ?, actor_name = ?, version = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`
      ).bind(
        title,
        description,
        groupName,
        isRead,
        readAt,
        isPinned,
        remindAt,
        isArchived,
        actorType,
        actorName,
        newVersion,
        now,
        id,
        userId
      ),
      c.env.DB.prepare(
        `INSERT INTO sync_changes (
          user_id, entity_type, entity_id, operation, entity_version, client_change_id, actor_type, actor_name, record_json, changed_at
        ) VALUES (?, 'bookmark', ?, 'update', ?, ?, ?, ?, ?, ?)`
      ).bind(userId, id, newVersion, clientChangeId, actorType, actorName, recordJson, now),
    ]);

    return c.json(normalized);
  } catch (err: unknown) {
    const message = getErrorMessage(err, "Failed to update bookmark");
    console.error("[Agent Update Bookmark Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentBookmarksRouter.delete("/bookmarks/:id", requireScope("bookmarks:write"), requireVaultRole(["owner", "editor"]), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");
    const actorType = c.get("actorType") || "agent";
    const actorName = c.get("actorName") || "Agent";
    const id = c.req.param("id");

    const current = await c.env.DB.prepare(
      "SELECT * FROM bookmarks WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
    )
      .bind(id, userId)
      .first<BookmarkDbRow>();

    if (!current) {
      return c.json({ error: "Bookmark not found" }, 404);
    }

    const now = new Date().toISOString();
    const newVersion = (current.version || 0) + 1;
    const clientChangeId = `agent_${crypto.randomUUID()}`;

    const deletedRow: BookmarkDbRow = {
      ...current,
      actor_type: actorType,
      actor_name: actorName,
      deleted_at: now,
      version: newVersion,
      updated_at: now,
    };

    const normalized = normalizeSyncRecord(deletedRow, "bookmark");
    const recordJson = JSON.stringify(normalized);

    // CRITICAL SYNC INVARIANT: Soft delete + sync_changes delete entry
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE bookmarks SET deleted_at = ?, actor_type = ?, actor_name = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
      ).bind(now, actorType, actorName, newVersion, now, id, userId),
      c.env.DB.prepare(
        `INSERT INTO sync_changes (
          user_id, entity_type, entity_id, operation, entity_version, client_change_id, actor_type, actor_name, record_json, changed_at
        ) VALUES (?, 'bookmark', ?, 'delete', ?, ?, ?, ?, ?, ?)`
      ).bind(userId, id, newVersion, clientChangeId, actorType, actorName, recordJson, now),
    ]);

    return c.json({ success: true, id });
  } catch (err: unknown) {
    const message = getErrorMessage(err, "Failed to delete bookmark");
    console.error("[Agent Delete Bookmark Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentBookmarksRouter.post("/bookmarks/batch", requireScope("bookmarks:write"), requireVaultRole(["owner", "editor"]), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");
    const actorType = c.get("actorType") || "agent";
    const actorName = c.get("actorName") || "Agent";

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON request body" }, 400);
    }

    const parseResult = batchOperationsSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return c.json({ error: "Invalid batch operations payload", details: parseResult.error.format() }, 400);
    }

    const { operations } = parseResult.data;
    const ids = Array.from(new Set(operations.map((op) => op.id).filter(Boolean)));
    if (ids.length === 0) {
      return c.json({ error: "No valid bookmark IDs in operations" }, 400);
    }

    const placeholders = ids.map(() => "?").join(", ");
    const { results: existingRows } = await c.env.DB.prepare(
      `SELECT * FROM bookmarks WHERE user_id = ? AND id IN (${placeholders}) AND deleted_at IS NULL`
    )
      .bind(userId, ...ids)
      .all<BookmarkDbRow>();

    const existingMap = new Map<string, BookmarkDbRow>((existingRows || []).map((r) => [r.id, r]));
    const statements: D1PreparedStatement[] = [];
    const now = new Date().toISOString();
    let processedCount = 0;

    for (const op of operations) {
      const { action, id, data = {} } = op;
      const current = existingMap.get(id);
      if (!current) continue;

      const newVersion = (current.version || 0) + 1;
      const clientChangeId = `agent_${crypto.randomUUID()}`;

      if (action === "update") {
        const title = data.title !== undefined ? data.title.trim() : current.title;
        const description = data.description !== undefined ? data.description.trim() : current.description;
        const groupName = data.group !== undefined ? data.group.trim() : current.group_name;
        const isRead = data.isRead !== undefined ? (data.isRead ? 1 : 0) : current.is_read;
        const readAt = data.isRead !== undefined ? (data.isRead ? (current.read_at || now) : "") : current.read_at;
        const isPinned = data.isPinned !== undefined ? (data.isPinned ? 1 : 0) : current.is_pinned;
        const remindAt = data.remindAt !== undefined ? data.remindAt.trim() : current.remind_at;
        const isArchived = data.isArchived !== undefined ? (data.isArchived ? 1 : 0) : current.is_archived;

        const updatedRow: BookmarkDbRow = {
          ...current,
          title,
          description,
          group_name: groupName,
          is_read: isRead,
          read_at: readAt,
          is_pinned: isPinned,
          remind_at: remindAt,
          is_archived: isArchived,
          actor_type: actorType,
          actor_name: actorName,
          version: newVersion,
          updated_at: now,
        };

        const normalized = normalizeSyncRecord(updatedRow, "bookmark");
        const recordJson = JSON.stringify(normalized);
        existingMap.set(id, updatedRow);

        statements.push(
          c.env.DB.prepare(
            `UPDATE bookmarks SET
              title = ?, description = ?, group_name = ?, is_read = ?, read_at = ?,
              is_pinned = ?, remind_at = ?, is_archived = ?, actor_type = ?, actor_name = ?, version = ?, updated_at = ?
            WHERE id = ? AND user_id = ?`
          ).bind(
            title,
            description,
            groupName,
            isRead,
            readAt,
            isPinned,
            remindAt,
            isArchived,
            actorType,
            actorName,
            newVersion,
            now,
            id,
            userId
          ),
          c.env.DB.prepare(
            `INSERT INTO sync_changes (
              user_id, entity_type, entity_id, operation, entity_version, client_change_id, actor_type, actor_name, record_json, changed_at
            ) VALUES (?, 'bookmark', ?, 'update', ?, ?, ?, ?, ?, ?)`
          ).bind(userId, id, newVersion, clientChangeId, actorType, actorName, recordJson, now)
        );
        processedCount++;
      } else if (action === "archive") {
        const updatedRow: BookmarkDbRow = {
          ...current,
          is_archived: 1,
          actor_type: actorType,
          actor_name: actorName,
          version: newVersion,
          updated_at: now,
        };

        const normalized = normalizeSyncRecord(updatedRow, "bookmark");
        const recordJson = JSON.stringify(normalized);
        existingMap.set(id, updatedRow);

        statements.push(
          c.env.DB.prepare(
            "UPDATE bookmarks SET is_archived = 1, actor_type = ?, actor_name = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
          ).bind(actorType, actorName, newVersion, now, id, userId),
          c.env.DB.prepare(
            `INSERT INTO sync_changes (
              user_id, entity_type, entity_id, operation, entity_version, client_change_id, actor_type, actor_name, record_json, changed_at
            ) VALUES (?, 'bookmark', ?, 'update', ?, ?, ?, ?, ?, ?)`
          ).bind(userId, id, newVersion, clientChangeId, actorType, actorName, recordJson, now)
        );
        processedCount++;
      } else if (action === "delete") {
        const deletedRow: BookmarkDbRow = {
          ...current,
          deleted_at: now,
          actor_type: actorType,
          actor_name: actorName,
          version: newVersion,
          updated_at: now,
        };

        const normalized = normalizeSyncRecord(deletedRow, "bookmark");
        const recordJson = JSON.stringify(normalized);
        existingMap.delete(id);

        statements.push(
          c.env.DB.prepare(
            "UPDATE bookmarks SET deleted_at = ?, actor_type = ?, actor_name = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
          ).bind(now, actorType, actorName, newVersion, now, id, userId),
          c.env.DB.prepare(
            `INSERT INTO sync_changes (
              user_id, entity_type, entity_id, operation, entity_version, client_change_id, actor_type, actor_name, record_json, changed_at
            ) VALUES (?, 'bookmark', ?, 'delete', ?, ?, ?, ?, ?, ?)`
          ).bind(userId, id, newVersion, clientChangeId, actorType, actorName, recordJson, now)
        );
        processedCount++;
      }
    }

    if (statements.length > 0) {
      await c.env.DB.batch(statements);
    }

    return c.json({ success: true, processed: processedCount });
  } catch (err: unknown) {
    const message = getErrorMessage(err, "Failed to process batch operations");
    console.error("[Agent Batch Bookmarks Error]:", message);
    return c.json({ error: message }, 500);
  }
});
