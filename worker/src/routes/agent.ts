import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../types";
import { authMiddleware, requireScope, requireVaultRole } from "../middleware/auth";
import { normalizeSyncRecord, NormalizedBookmarkRecord } from "../normalize";
import { openApiSpec } from "../openapi";
import { extractInstantMediaMetadata } from "../../../src/lib/mediaHeuristics";
import { resolveSmartGroup, type CompoundSmartGroupRule, type CustomGroupRule } from "../../../src/lib/smartGroups";

// Domain & Database Row Interfaces
interface BookmarkDbRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  title: string;
  url: string;
  description: string;
  image: string;
  favicon: string;
  site_name: string;
  author: string;
  published_at: string;
  content_type: string;
  reading_time: number;
  word_count: number;
  canonical_url: string;
  article_content: string;
  group_name: string;
  is_read: number;
  read_at: string;
  is_pinned: number;
  remind_at: string;
  is_archived: number;
  archive_group: string;
  actor_type: string;
  actor_name: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface GroupDbRow {
  id: string;
  name: string;
  color: string;
  bookmarkCount?: number;
}

interface CountDbRow {
  total?: number;
  count?: number;
}

interface UserSettingsDbRow {
  rules_json?: string;
  preferences_json?: string;
}

interface MaxSeqDbRow {
  max_seq?: number;
}

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

const ruleConditionSchema = z.object({
  field: z.string().max(50),
  operator: z.string().max(50),
  value: z.string().max(200),
});

const ruleItemSchema = z.object({
  id: z.string().optional(),
  group: z.string().min(1).max(100),
  conditions: z.array(ruleConditionSchema).max(20),
  matchType: z.enum(["all", "any"]).optional(),
});

const rulesPayloadSchema = z.object({
  rules: z.array(ruleItemSchema).max(100),
});

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

/**
 * Generates a concise search snippet (~120-160 chars) highlighting matching context
 * from description or article content.
 */
function generateSearchSnippet(
  description?: string | null,
  articleContent?: string | null,
  terms: string[] = []
): string | null {
  const cleanDesc = (description || "").replace(/\s+/g, " ").trim();
  const cleanArticle = (articleContent || "").replace(/\s+/g, " ").trim();

  if (!cleanDesc && !cleanArticle) return null;

  const candidateTexts = [cleanDesc, cleanArticle].filter(Boolean);
  if (terms.length === 0) {
    const fallback = candidateTexts[0] || "";
    return fallback.length > 150 ? fallback.slice(0, 147) + "..." : fallback || null;
  }

  // Locate the earliest term match across description or article content
  let targetText = "";
  let matchIndex = -1;

  for (const text of candidateTexts) {
    const lower = text.toLowerCase();
    for (const term of terms) {
      const idx = lower.indexOf(term.toLowerCase());
      if (idx !== -1 && (matchIndex === -1 || idx < matchIndex)) {
        targetText = text;
        matchIndex = idx;
      }
    }
    if (targetText && matchIndex !== -1) break;
  }

  if (!targetText || matchIndex === -1) {
    const fallback = candidateTexts[0] || "";
    return fallback.length > 150 ? fallback.slice(0, 147) + "..." : fallback || null;
  }

  const targetWindow = 140;
  const leadChars = 35;
  const start = Math.max(0, matchIndex - leadChars);
  const end = Math.min(targetText.length, start + targetWindow);

  let snippet = targetText.slice(start, end).trim();
  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < targetText.length) {
    snippet = snippet + "...";
  }

  return snippet;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKMARKS SEARCH & RETRIEVAL (bookmarks:read)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.get("/bookmarks/search", requireScope("bookmarks:read"), async (c) => {
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
    const message = err instanceof Error ? err.message : "Failed to search bookmarks";
    console.error("[Agent Search Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentRouter.get("/bookmarks/:id", requireScope("bookmarks:read"), async (c) => {
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
    const message = err instanceof Error ? err.message : "Failed to retrieve bookmark";
    return c.json({ error: message }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKMARKS MUTATIONS (bookmarks:write)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.post("/bookmarks", requireScope("bookmarks:write"), requireVaultRole(["owner", "editor"]), async (c) => {
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
    const message = err instanceof Error ? err.message : "Failed to create bookmark";
    console.error("[Agent Create Bookmark Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentRouter.patch("/bookmarks/:id", requireScope("bookmarks:write"), requireVaultRole(["owner", "editor"]), async (c) => {
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
    const message = err instanceof Error ? err.message : "Failed to update bookmark";
    console.error("[Agent Update Bookmark Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentRouter.delete("/bookmarks/:id", requireScope("bookmarks:write"), requireVaultRole(["owner", "editor"]), async (c) => {
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
    const message = err instanceof Error ? err.message : "Failed to delete bookmark";
    console.error("[Agent Delete Bookmark Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentRouter.post("/bookmarks/batch", requireScope("bookmarks:write"), requireVaultRole(["owner", "editor"]), async (c) => {
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
    const message = err instanceof Error ? err.message : "Failed to process batch operations";
    console.error("[Agent Batch Bookmarks Error]:", message);
    return c.json({ error: message }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GROUPS (bookmarks:read)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.get("/groups", requireScope("bookmarks:read"), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");

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
      .all<GroupDbRow>();

    const groups = (results || []).map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      bookmarkCount: Number(row.bookmarkCount || 0),
    }));

    return c.json({ groups });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve groups";
    console.error("[Agent Groups Error]:", message);
    return c.json({ error: message }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SMART RULES (groups:manage)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.get("/rules", requireScope("groups:manage"), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");

    const row = await c.env.DB.prepare(
      "SELECT rules_json FROM user_settings WHERE user_id = ?"
    )
      .bind(userId)
      .first<UserSettingsDbRow>();

    let rules: unknown[] = [];
    if (row && row.rules_json) {
      try {
        rules = JSON.parse(row.rules_json);
      } catch {
        rules = [];
      }
    }

    return c.json({ rules });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve rules";
    console.error("[Agent Get Rules Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentRouter.put("/rules", requireScope("groups:manage"), requireVaultRole(["owner", "editor"]), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON request body" }, 400);
    }

    const parseResult = rulesPayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return c.json({ error: "Invalid rules payload", details: parseResult.error.format() }, 400);
    }

    const { rules } = parseResult.data;
    const now = new Date().toISOString();
    const rulesJson = JSON.stringify(rules);

    await c.env.DB.prepare(
      `INSERT INTO user_settings (user_id, rules_json, preferences_json, updated_at)
       VALUES (?, ?, '{}', ?)
       ON CONFLICT(user_id) DO UPDATE SET rules_json = excluded.rules_json, updated_at = excluded.updated_at`
    )
      .bind(userId, rulesJson, now)
      .run();

    return c.json({ success: true, rules });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save rules";
    console.error("[Agent Put Rules Error]:", message);
    return c.json({ error: message }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETTINGS & WORKFLOW PREFERENCES (settings:manage)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.get("/settings", requireScope("settings:manage"), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");

    const row = await c.env.DB.prepare(
      "SELECT preferences_json FROM user_settings WHERE user_id = ?"
    )
      .bind(userId)
      .first<UserSettingsDbRow>();

    let settings: Record<string, unknown> = {};
    if (row && row.preferences_json) {
      try {
        settings = JSON.parse(row.preferences_json);
      } catch {
        settings = {};
      }
    }

    return c.json({ settings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve settings";
    console.error("[Agent Get Settings Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentRouter.patch("/settings", requireScope("settings:manage"), requireVaultRole(["owner"]), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON request body" }, 400);
    }

    if (!rawBody || typeof rawBody !== "object") {
      return c.json({ error: "Invalid settings payload" }, 400);
    }

    const payloadObj = rawBody as Record<string, unknown>;

    // Protection of master credentials: password and email changes prohibited via agent settings endpoint
    const forbiddenKeys = ["password", "password_hash", "passwordHash", "email", "token", "role", "user_id", "userId"];
    for (const key of forbiddenKeys) {
      if (payloadObj[key] !== undefined || (typeof payloadObj.settings === "object" && payloadObj.settings !== null && (payloadObj.settings as Record<string, unknown>)[key] !== undefined)) {
        return c.json(
          { error: `Modifying master account field '${key}' via settings endpoint is strictly prohibited` },
          400
        );
      }
    }

    const row = await c.env.DB.prepare(
      "SELECT preferences_json FROM user_settings WHERE user_id = ?"
    )
      .bind(userId)
      .first<UserSettingsDbRow>();

    let currentSettings: Record<string, unknown> = {};
    if (row && row.preferences_json) {
      try {
        currentSettings = JSON.parse(row.preferences_json);
      } catch {
        currentSettings = {};
      }
    }

    const inputSettings = payloadObj.settings && typeof payloadObj.settings === "object" ? (payloadObj.settings as Record<string, unknown>) : payloadObj;
    const mergedSettings: Record<string, unknown> = { ...currentSettings, ...inputSettings };

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update settings";
    console.error("[Agent Patch Settings Error]:", message);
    return c.json({ error: message }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VAULT METRICS & STATS (bookmarks:read)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentRouter.get("/stats", requireScope("bookmarks:read"), async (c) => {
  try {
    const userId = c.get("vaultOwnerId") || c.get("userId");

    const batchResults = await c.env.DB.batch([
      c.env.DB.prepare("SELECT COUNT(*) as total FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL").bind(userId),
      c.env.DB.prepare(
        "SELECT COUNT(*) as total FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL AND is_archived = 0 AND is_read = 0"
      ).bind(userId),
      c.env.DB.prepare(
        "SELECT COUNT(*) as total FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL AND is_archived = 1"
      ).bind(userId),
      c.env.DB.prepare("SELECT COUNT(*) as total FROM groups WHERE user_id = ? AND deleted_at IS NULL").bind(userId),
      c.env.DB.prepare("SELECT MAX(sequence) as max_seq FROM sync_changes WHERE user_id = ?").bind(userId),
    ]);

    const totalRes = batchResults[0] as D1Result<CountDbRow>;
    const unreadRes = batchResults[1] as D1Result<CountDbRow>;
    const archivedRes = batchResults[2] as D1Result<CountDbRow>;
    const groupsRes = batchResults[3] as D1Result<CountDbRow>;
    const syncRes = batchResults[4] as D1Result<MaxSeqDbRow>;

    const totalBookmarks = Number(totalRes.results?.[0]?.total || 0);
    const unreadCount = Number(unreadRes.results?.[0]?.total || 0);
    const archivedCount = Number(archivedRes.results?.[0]?.total || 0);
    const groupsCount = Number(groupsRes.results?.[0]?.total || 0);
    const latestSyncSequence = Number(syncRes.results?.[0]?.max_seq || 0);

    return c.json({
      totalBookmarks,
      unreadCount,
      archivedCount,
      groupsCount,
      latestSyncSequence,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve stats";
    console.error("[Agent Stats Error]:", message);
    return c.json({ error: message }, 500);
  }
});
