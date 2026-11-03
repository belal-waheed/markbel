import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { authMiddleware, requireScope } from "../middleware/auth";
import { normalizeSyncRecord } from "../normalize";
import { openApiSpec } from "../openapi";
import { extractInstantMediaMetadata } from "../../../src/lib/mediaHeuristics";
import { resolveSmartGroup } from "../../../src/lib/smartGroups";

export const agentRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// OpenAPI 3.1 specification schema (Public, no authentication required)
agentRouter.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

// Guard all subsequent endpoints under /api/agent/v1/*
agentRouter.use("*", async (c, next) => {
  if (c.req.path.endsWith("/openapi.json")) {
    return await next();
  }
  return authMiddleware(c, next);
});

// Helper: Ensure user_settings table exists
async function ensureUserSettingsTable(db: D1Database): Promise<void> {
  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        rules_json TEXT DEFAULT '[]',
        preferences_json TEXT DEFAULT '{}',
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ).run();
  } catch (err: any) {
    console.error("[user_settings table init]:", err?.message || err);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKMARKS SEARCH & RETRIEVAL (bookmarks:read)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.get("/bookmarks/search", requireScope("bookmarks:read"), async (c) => {
  try {
    const userId = c.get("userId");
    const q = c.req.query("q")?.trim() || "";
    const group = c.req.query("group")?.trim() || "";
    const isReadParam = c.req.query("is_read");
    const isArchivedParam = c.req.query("is_archived") || "false";
    const isPinnedParam = c.req.query("is_pinned");
    const includeContent = c.req.query("include_content") === "true";

    const rawLimit = parseInt(c.req.query("limit") || "20", 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 20 : rawLimit, 1), 100);
    const rawOffset = parseInt(c.req.query("offset") || "0", 10);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

    const conditions: string[] = ["user_id = ?", "deleted_at IS NULL"];
    const params: any[] = [userId];

    // Archive filter
    if (isArchivedParam === "true") {
      conditions.push("is_archived = 1");
    } else if (isArchivedParam !== "all") {
      conditions.push("is_archived = 0");
    }

    // Read filter
    if (isReadParam === "true") {
      conditions.push("is_read = 1");
    } else if (isReadParam === "false") {
      conditions.push("is_read = 0");
    }

    // Pinned filter
    if (isPinnedParam === "true") {
      conditions.push("is_pinned = 1");
    } else if (isPinnedParam === "false") {
      conditions.push("is_pinned = 0");
    }

    // Group filter
    if (group) {
      conditions.push("LOWER(group_name) = LOWER(?)");
      params.push(group);
    }

    // Search query matching title, URL, description, site name, and article content
    if (q) {
      const term = `%${q.toLowerCase()}%`;
      conditions.push(
        "(LOWER(title) LIKE ? OR LOWER(url) LIKE ? OR LOWER(description) LIKE ? OR LOWER(site_name) LIKE ? OR LOWER(article_content) LIKE ?)"
      );
      params.push(term, term, term, term, term);
    }

    // Compute total count matching filter
    const countSql = `SELECT COUNT(*) as total FROM bookmarks WHERE ${conditions.join(" AND ")}`;
    const countRow: any = await c.env.DB.prepare(countSql).bind(...params).first();
    const total = Number(countRow?.total || 0);

    // Multi-attribute relevance ranking when search query is present
    let orderBy = "ORDER BY is_pinned DESC, updated_at DESC";
    const queryParams = [...params];

    if (q) {
      const rankTerm = `%${q.toLowerCase()}%`;
      orderBy = `ORDER BY (CASE 
        WHEN LOWER(title) LIKE ? THEN 1 
        WHEN LOWER(site_name) LIKE ? THEN 2 
        WHEN LOWER(url) LIKE ? THEN 3 
        WHEN LOWER(description) LIKE ? THEN 4 
        ELSE 5 
      END) ASC, is_pinned DESC, updated_at DESC`;
      queryParams.push(rankTerm, rankTerm, rankTerm, rankTerm);
    }

    queryParams.push(limit, offset);

    const selectSql = `SELECT * FROM bookmarks WHERE ${conditions.join(" AND ")} ${orderBy} LIMIT ? OFFSET ?`;
    const { results } = await c.env.DB.prepare(selectSql).bind(...queryParams).all();

    const items = (results || []).map((row: any) => {
      const norm = normalizeSyncRecord(row, "bookmark");
      if (!includeContent) {
        norm.articleContent = "";
        norm.article_content = "";
      }
      return norm;
    });

    return c.json({
      items,
      total,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("[Agent Search Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to search bookmarks" }, 500);
  }
});

agentRouter.get("/bookmarks/:id", requireScope("bookmarks:read"), async (c) => {
  try {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const row: any = await c.env.DB.prepare(
      "SELECT * FROM bookmarks WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
    )
      .bind(id, userId)
      .first();

    if (!row) {
      return c.json({ error: "Bookmark not found" }, 404);
    }

    const bookmark = normalizeSyncRecord(row, "bookmark");
    return c.json(bookmark);
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to retrieve bookmark" }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKMARKS MUTATIONS (bookmarks:write)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.post("/bookmarks", requireScope("bookmarks:write"), async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json();

    const rawUrl = (body.url || "").trim();
    if (!rawUrl) {
      return c.json({ error: "URL is required" }, 400);
    }

    let cleanUrl = rawUrl;
    try {
      const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
      cleanUrl = parsed.toString();
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }

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
        .all();
      const groupNames = (userGroups || []).map((g: any) => g.name);

      let customRules: any[] = [];
      try {
        await ensureUserSettingsTable(c.env.DB);
        const settingsRow: any = await c.env.DB.prepare(
          "SELECT rules_json FROM user_settings WHERE user_id = ?"
        )
          .bind(userId)
          .first();
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
    const remindAt = body.remindAt ? String(body.remindAt).trim() : "";
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
          is_archived, archive_group, version, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
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
        version,
        now,
        now
      ),
      c.env.DB.prepare(
        `INSERT INTO sync_changes (
          user_id, entity_type, entity_id, operation, entity_version, client_change_id, record_json, changed_at
        ) VALUES (?, 'bookmark', ?, 'create', ?, ?, ?, ?)`
      ).bind(userId, id, version, clientChangeId, recordJson, now),
    ]);

    return c.json(normalized, 201);
  } catch (err: any) {
    console.error("[Agent Create Bookmark Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to create bookmark" }, 500);
  }
});

agentRouter.patch("/bookmarks/:id", requireScope("bookmarks:write"), async (c) => {
  try {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = await c.req.json();

    const current: any = await c.env.DB.prepare(
      "SELECT * FROM bookmarks WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
    )
      .bind(id, userId)
      .first();

    if (!current) {
      return c.json({ error: "Bookmark not found" }, 404);
    }

    const now = new Date().toISOString();
    const newVersion = (current.version || 0) + 1;
    const clientChangeId = `agent_${crypto.randomUUID()}`;

    const title = body.title !== undefined ? String(body.title).trim() : current.title;
    const description = body.description !== undefined ? String(body.description).trim() : current.description;
    const groupName = body.group !== undefined ? String(body.group).trim() : current.group_name;
    const isRead = body.isRead !== undefined ? (body.isRead ? 1 : 0) : current.is_read;
    const readAt = body.isRead !== undefined ? (body.isRead ? (current.read_at || now) : "") : current.read_at;
    const isPinned = body.isPinned !== undefined ? (body.isPinned ? 1 : 0) : current.is_pinned;
    const remindAt = body.remindAt !== undefined ? String(body.remindAt).trim() : current.remind_at;
    const isArchived = body.isArchived !== undefined ? (body.isArchived ? 1 : 0) : current.is_archived;

    const updatedRow = {
      ...current,
      title,
      description,
      group_name: groupName,
      is_read: isRead,
      read_at: readAt,
      is_pinned: isPinned,
      remind_at: remindAt,
      is_archived: isArchived,
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
          is_pinned = ?, remind_at = ?, is_archived = ?, version = ?, updated_at = ?
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
        newVersion,
        now,
        id,
        userId
      ),
      c.env.DB.prepare(
        `INSERT INTO sync_changes (
          user_id, entity_type, entity_id, operation, entity_version, client_change_id, record_json, changed_at
        ) VALUES (?, 'bookmark', ?, 'update', ?, ?, ?, ?)`
      ).bind(userId, id, newVersion, clientChangeId, recordJson, now),
    ]);

    return c.json(normalized);
  } catch (err: any) {
    console.error("[Agent Update Bookmark Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to update bookmark" }, 500);
  }
});

agentRouter.delete("/bookmarks/:id", requireScope("bookmarks:write"), async (c) => {
  try {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const current: any = await c.env.DB.prepare(
      "SELECT * FROM bookmarks WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
    )
      .bind(id, userId)
      .first();

    if (!current) {
      return c.json({ error: "Bookmark not found" }, 404);
    }

    const now = new Date().toISOString();
    const newVersion = (current.version || 0) + 1;
    const clientChangeId = `agent_${crypto.randomUUID()}`;

    const deletedRow = {
      ...current,
      deleted_at: now,
      version: newVersion,
      updated_at: now,
    };

    const normalized = normalizeSyncRecord(deletedRow, "bookmark");
    const recordJson = JSON.stringify(normalized);

    // CRITICAL SYNC INVARIANT: Soft delete + sync_changes delete entry
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE bookmarks SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
      ).bind(now, newVersion, now, id, userId),
      c.env.DB.prepare(
        `INSERT INTO sync_changes (
          user_id, entity_type, entity_id, operation, entity_version, client_change_id, record_json, changed_at
        ) VALUES (?, 'bookmark', ?, 'delete', ?, ?, ?, ?)`
      ).bind(userId, id, newVersion, clientChangeId, recordJson, now),
    ]);

    return c.json({ success: true, id });
  } catch (err: any) {
    console.error("[Agent Delete Bookmark Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to delete bookmark" }, 500);
  }
});

agentRouter.post("/bookmarks/batch", requireScope("bookmarks:write"), async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json();

    if (!body || !Array.isArray(body.operations) || body.operations.length === 0) {
      return c.json({ error: "Invalid operations: expected a non-empty array" }, 400);
    }

    if (body.operations.length > 100) {
      return c.json({ error: "Batch operations limit exceeded (maximum 100)" }, 400);
    }

    const ids = Array.from(new Set(body.operations.map((op: any) => op?.id).filter(Boolean)));
    if (ids.length === 0) {
      return c.json({ error: "No valid bookmark IDs in operations" }, 400);
    }

    const placeholders = ids.map(() => "?").join(", ");
    const { results: existingRows } = await c.env.DB.prepare(
      `SELECT * FROM bookmarks WHERE user_id = ? AND id IN (${placeholders}) AND deleted_at IS NULL`
    )
      .bind(userId, ...ids)
      .all();

    const existingMap = new Map((existingRows || []).map((r: any) => [r.id, r]));
    const statements: D1PreparedStatement[] = [];
    const now = new Date().toISOString();
    let processedCount = 0;

    for (const op of body.operations) {
      const { action, id, data = {} } = op;
      const current = existingMap.get(id);
      if (!current) continue;

      const newVersion = (current.version || 0) + 1;
      const clientChangeId = `agent_${crypto.randomUUID()}`;

      if (action === "update") {
        const title = data.title !== undefined ? String(data.title).trim() : current.title;
        const description = data.description !== undefined ? String(data.description).trim() : current.description;
        const groupName = data.group !== undefined ? String(data.group).trim() : current.group_name;
        const isRead = data.isRead !== undefined ? (data.isRead ? 1 : 0) : current.is_read;
        const readAt = data.isRead !== undefined ? (data.isRead ? (current.read_at || now) : "") : current.read_at;
        const isPinned = data.isPinned !== undefined ? (data.isPinned ? 1 : 0) : current.is_pinned;
        const remindAt = data.remindAt !== undefined ? String(data.remindAt).trim() : current.remind_at;
        const isArchived = data.isArchived !== undefined ? (data.isArchived ? 1 : 0) : current.is_archived;

        const updatedRow = {
          ...current,
          title,
          description,
          group_name: groupName,
          is_read: isRead,
          read_at: readAt,
          is_pinned: isPinned,
          remind_at: remindAt,
          is_archived: isArchived,
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
              is_pinned = ?, remind_at = ?, is_archived = ?, version = ?, updated_at = ?
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
            newVersion,
            now,
            id,
            userId
          ),
          c.env.DB.prepare(
            `INSERT INTO sync_changes (
              user_id, entity_type, entity_id, operation, entity_version, client_change_id, record_json, changed_at
            ) VALUES (?, 'bookmark', ?, 'update', ?, ?, ?, ?)`
          ).bind(userId, id, newVersion, clientChangeId, recordJson, now)
        );
        processedCount++;
      } else if (action === "archive") {
        const updatedRow = {
          ...current,
          is_archived: 1,
          version: newVersion,
          updated_at: now,
        };

        const normalized = normalizeSyncRecord(updatedRow, "bookmark");
        const recordJson = JSON.stringify(normalized);
        existingMap.set(id, updatedRow);

        statements.push(
          c.env.DB.prepare(
            "UPDATE bookmarks SET is_archived = 1, version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
          ).bind(newVersion, now, id, userId),
          c.env.DB.prepare(
            `INSERT INTO sync_changes (
              user_id, entity_type, entity_id, operation, entity_version, client_change_id, record_json, changed_at
            ) VALUES (?, 'bookmark', ?, 'update', ?, ?, ?, ?)`
          ).bind(userId, id, newVersion, clientChangeId, recordJson, now)
        );
        processedCount++;
      } else if (action === "delete") {
        const deletedRow = {
          ...current,
          deleted_at: now,
          version: newVersion,
          updated_at: now,
        };

        const normalized = normalizeSyncRecord(deletedRow, "bookmark");
        const recordJson = JSON.stringify(normalized);
        existingMap.delete(id);

        statements.push(
          c.env.DB.prepare(
            "UPDATE bookmarks SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
          ).bind(now, newVersion, now, id, userId),
          c.env.DB.prepare(
            `INSERT INTO sync_changes (
              user_id, entity_type, entity_id, operation, entity_version, client_change_id, record_json, changed_at
            ) VALUES (?, 'bookmark', ?, 'delete', ?, ?, ?, ?)`
          ).bind(userId, id, newVersion, clientChangeId, recordJson, now)
        );
        processedCount++;
      }
    }

    if (statements.length > 0) {
      await c.env.DB.batch(statements);
    }

    return c.json({ success: true, processed: processedCount });
  } catch (err: any) {
    console.error("[Agent Batch Bookmarks Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to process batch operations" }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GROUPS (bookmarks:read)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.get("/groups", requireScope("bookmarks:read"), async (c) => {
  try {
    const userId = c.get("userId");

    const { results } = await c.env.DB.prepare(
      `SELECT g.id, g.name, g.color,
        (SELECT COUNT(*) FROM bookmarks b 
         WHERE b.user_id = g.user_id 
           AND b.group_name = g.name 
           AND b.deleted_at IS NULL 
           AND b.is_archived = 0) as bookmarkCount
       FROM groups g
       WHERE g.user_id = ? AND g.deleted_at IS NULL
       ORDER BY g.name ASC`
    )
      .bind(userId)
      .all();

    const groups = (results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      bookmarkCount: Number(row.bookmarkCount || 0),
    }));

    return c.json({ groups });
  } catch (err: any) {
    console.error("[Agent Groups Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to retrieve groups" }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SMART RULES (groups:manage)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.get("/rules", requireScope("groups:manage"), async (c) => {
  try {
    const userId = c.get("userId");
    await ensureUserSettingsTable(c.env.DB);

    const row: any = await c.env.DB.prepare(
      "SELECT rules_json FROM user_settings WHERE user_id = ?"
    )
      .bind(userId)
      .first();

    let rules: any[] = [];
    if (row && row.rules_json) {
      try {
        rules = JSON.parse(row.rules_json);
      } catch {
        rules = [];
      }
    }

    return c.json({ rules });
  } catch (err: any) {
    console.error("[Agent Get Rules Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to retrieve rules" }, 500);
  }
});

agentRouter.put("/rules", requireScope("groups:manage"), async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json();

    if (!body || !Array.isArray(body.rules)) {
      return c.json({ error: "Invalid rules: expected an array under 'rules' property" }, 400);
    }

    await ensureUserSettingsTable(c.env.DB);
    const now = new Date().toISOString();
    const rulesJson = JSON.stringify(body.rules);

    await c.env.DB.prepare(
      `INSERT INTO user_settings (user_id, rules_json, preferences_json, updated_at)
       VALUES (?, ?, '{}', ?)
       ON CONFLICT(user_id) DO UPDATE SET rules_json = excluded.rules_json, updated_at = excluded.updated_at`
    )
      .bind(userId, rulesJson, now)
      .run();

    return c.json({ success: true, rules: body.rules });
  } catch (err: any) {
    console.error("[Agent Put Rules Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to save rules" }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETTINGS & WORKFLOW PREFERENCES (settings:manage)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.get("/settings", requireScope("settings:manage"), async (c) => {
  try {
    const userId = c.get("userId");
    await ensureUserSettingsTable(c.env.DB);

    const row: any = await c.env.DB.prepare(
      "SELECT preferences_json FROM user_settings WHERE user_id = ?"
    )
      .bind(userId)
      .first();

    let settings: Record<string, any> = {};
    if (row && row.preferences_json) {
      try {
        settings = JSON.parse(row.preferences_json);
      } catch {
        settings = {};
      }
    }

    return c.json({ settings });
  } catch (err: any) {
    console.error("[Agent Get Settings Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to retrieve settings" }, 500);
  }
});

agentRouter.patch("/settings", requireScope("settings:manage"), async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json();

    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid settings payload" }, 400);
    }

    // Protection of master credentials: password and email changes prohibited via agent settings endpoint
    const forbiddenKeys = ["password", "password_hash", "passwordHash", "email", "token", "role", "user_id", "userId"];
    for (const key of forbiddenKeys) {
      if (body[key] !== undefined || (body.settings && body.settings[key] !== undefined)) {
        return c.json(
          { error: `Modifying master account field '${key}' via settings endpoint is strictly prohibited` },
          400
        );
      }
    }

    await ensureUserSettingsTable(c.env.DB);

    const row: any = await c.env.DB.prepare(
      "SELECT preferences_json FROM user_settings WHERE user_id = ?"
    )
      .bind(userId)
      .first();

    let currentSettings: Record<string, any> = {};
    if (row && row.preferences_json) {
      try {
        currentSettings = JSON.parse(row.preferences_json);
      } catch {
        currentSettings = {};
      }
    }

    const inputSettings = body.settings && typeof body.settings === "object" ? body.settings : body;
    const mergedSettings = { ...currentSettings, ...inputSettings };

    // Clean any accidental credential properties
    for (const key of forbiddenKeys) {
      delete mergedSettings[key];
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `INSERT INTO user_settings (user_id, rules_json, preferences_json, updated_at)
       VALUES (?, '[]', ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET preferences_json = excluded.preferences_json, updated_at = excluded.updated_at`
    )
      .bind(userId, JSON.stringify(mergedSettings), now)
      .run();

    return c.json({ success: true, settings: mergedSettings });
  } catch (err: any) {
    console.error("[Agent Patch Settings Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to update settings" }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VAULT METRICS & STATS (bookmarks:read)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.get("/stats", requireScope("bookmarks:read"), async (c) => {
  try {
    const userId = c.get("userId");

    const [totalRes, unreadRes, archivedRes, groupsRes, syncRes]: any[] = await c.env.DB.batch([
      c.env.DB.prepare("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL").bind(userId),
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL AND is_archived = 0 AND is_read = 0"
      ).bind(userId),
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL AND is_archived = 1"
      ).bind(userId),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM groups WHERE user_id = ? AND deleted_at IS NULL").bind(userId),
      c.env.DB.prepare("SELECT MAX(sequence) as max_seq FROM sync_changes WHERE user_id = ?").bind(userId),
    ]);

    const totalBookmarks = Number(totalRes.results?.[0]?.count || 0);
    const unreadCount = Number(unreadRes.results?.[0]?.count || 0);
    const archivedCount = Number(archivedRes.results?.[0]?.count || 0);
    const groupsCount = Number(groupsRes.results?.[0]?.count || 0);
    const latestSyncSequence = Number(syncRes.results?.[0]?.max_seq || 0);

    return c.json({
      totalBookmarks,
      unreadCount,
      archivedCount,
      groupsCount,
      latestSyncSequence,
    });
  } catch (err: any) {
    console.error("[Agent Stats Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to retrieve stats" }, 500);
  }
});
