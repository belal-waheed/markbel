import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt, sign, verify } from "hono/jwt";
import * as cheerio from "cheerio";

export type Bindings = {
  DB: D1Database;
  ASSETS?: Fetcher;
  KV_AUTH?: KVNamespace;
  JWT_SECRET?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
};

type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Enable CORS
app.use(
  "/api/*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/api/health", (c) => {
  return c.json({
    status: "healthy",
    runtime: "Cloudflare Workers",
    database: "Cloudflare D1",
    timestamp: new Date().toISOString(),
  });
});

// Helper: Password Hashing using Web Crypto PBKDF2 (Edge Native)
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashHex = Array.from(new Uint8Array(rawKey))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;
  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const computedHashHex = Array.from(new Uint8Array(rawKey))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHashHex === hashHex;
}

// Auth Middleware
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return c.json({ error: "Missing authorization token" }, 401);
  }

  const secret = c.env.JWT_SECRET || "markbel-edge-secret-key-2026";
  try {
    const payload = await verify(token, secret, "HS256");
    c.set("userId", (payload as any).id);
    await next();
  } catch (err: any) {
    console.error("[JWT Verify Error]:", err?.message || err);
    return c.json({ error: "Invalid or expired token", details: err?.message }, 401);
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTH ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.post("/api/users/signup", async (c) => {
  try {
    const { name, email, password, avatar } = await c.req.json();
    if (!name || !email || !password) {
      return c.json({ error: "Name, email, and password are required" }, 400);
    }

    const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email.toLowerCase())
      .first();

    if (existing) {
      return c.json({ error: "An account with this email already exists" }, 409);
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      "INSERT INTO users (id, name, email, password_hash, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(id, name, email.toLowerCase(), passwordHash, avatar || "", now)
      .run();

    const secret = c.env.JWT_SECRET || "markbel-edge-secret-key-2026";
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
    const token = await sign({ id, email, exp }, secret, "HS256");

    return c.json(
      {
        token,
        user: { id, name, email: email.toLowerCase(), avatar: avatar || "", createdAt: now },
      },
      201
    );
  } catch (err: any) {
    return c.json({ error: err.message || "Internal server error" }, 500);
  }
});

app.post("/api/users/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const user: any = await c.env.DB.prepare(
      "SELECT id, name, email, password_hash, avatar, created_at FROM users WHERE email = ?"
    )
      .bind(email.toLowerCase())
      .first();

    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const secret = c.env.JWT_SECRET || "markbel-edge-secret-key-2026";
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
    const token = await sign({ id: user.id, email: user.email, exp }, secret, "HS256");

    return c.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.created_at,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Internal server error" }, 500);
  }
});

app.get("/api/users/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const user: any = await c.env.DB.prepare(
    "SELECT id, name, email, avatar, created_at FROM users WHERE id = ?"
  )
    .bind(userId)
    .first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    createdAt: user.created_at,
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYNC ROUTES (D1 Cloudflare SQLite with Last-Write-Wins)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.post("/api/sync/push", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { deviceId, changes } = await c.req.json();

  if (!changes || !Array.isArray(changes)) {
    return c.json({ error: "Invalid push payload" }, 400);
  }

  const results: any[] = [];

  for (const change of changes) {
    const { changeId, entityType, entityId, operation, baseVersion, payload } = change;

    // 1. Idempotency Check
    const existingSync: any = await c.env.DB.prepare(
      "SELECT sequence, entity_version FROM sync_changes WHERE client_change_id = ?"
    )
      .bind(changeId)
      .first();

    if (existingSync) {
      results.push({
        changeId,
        entityId,
        status: "duplicate",
        version: existingSync.entity_version,
      });
      continue;
    }

    if (entityType !== "bookmark" && entityType !== "group") {
      results.push({
        changeId,
        entityId,
        status: "rejected",
        reason: "Unsupported entity type",
      });
      continue;
    }

    try {
      const now = new Date().toISOString();
      const tableName = entityType === "bookmark" ? "bookmarks" : "groups";

      const currentRecord: any = await c.env.DB.prepare(
        `SELECT * FROM ${tableName} WHERE id = ? AND user_id = ?`
      )
        .bind(entityId, userId)
        .first();

      const currentVersion = currentRecord ? currentRecord.version : 0;

      // 2. Conflict & LWW Evaluation
      if (operation !== "create" && currentVersion !== baseVersion) {
        let isLWWWinner = false;
        if (operation === "update" && payload && payload.updatedAt && currentRecord && currentRecord.updated_at) {
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

      // 3. Apply changes to D1 SQLite
      if (entityType === "bookmark") {
        if (operation === "create") {
          await c.env.DB.prepare(
            `INSERT INTO bookmarks (id, user_id, title, url, description, image, group_name, is_read, read_at, is_pinned, remind_at, is_archived, archive_group, version, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
          )
            .bind(
              entityId,
              userId,
              payload.title || payload.url || "",
              payload.url || "",
              payload.description || "",
              payload.image || "",
              payload.group || "Unsorted",
              payload.isRead ? 1 : 0,
              payload.readAt || "",
              payload.isPinned ? 1 : 0,
              payload.remindAt || "",
              payload.isArchived ? 1 : 0,
              payload.archiveGroup || "",
              newVersion,
              payload.createdAt || now,
              payload.updatedAt || now
            )
            .run();
        } else if (operation === "update") {
          await c.env.DB.prepare(
            `UPDATE bookmarks SET 
              title = COALESCE(?, title),
              url = COALESCE(?, url),
              description = COALESCE(?, description),
              image = COALESCE(?, image),
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
          )
            .bind(
              payload.title,
              payload.url,
              payload.description,
              payload.image,
              payload.group,
              payload.isRead !== undefined ? (payload.isRead ? 1 : 0) : null,
              payload.readAt,
              payload.isPinned !== undefined ? (payload.isPinned ? 1 : 0) : null,
              payload.remindAt,
              payload.isArchived !== undefined ? (payload.isArchived ? 1 : 0) : null,
              payload.archiveGroup,
              newVersion,
              payload.updatedAt || now,
              entityId,
              userId
            )
            .run();
        } else if (operation === "delete") {
          await c.env.DB.prepare(
            "UPDATE bookmarks SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
          )
            .bind(now, newVersion, now, entityId, userId)
            .run();
        }

        const savedBookmark = await c.env.DB.prepare("SELECT * FROM bookmarks WHERE id = ?")
          .bind(entityId)
          .first();
        recordJson = JSON.stringify(savedBookmark);
      } else if (entityType === "group") {
        if (operation === "create") {
          await c.env.DB.prepare(
            "INSERT INTO groups (id, user_id, name, color, version, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)"
          )
            .bind(
              entityId,
              userId,
              payload.name || "New Group",
              payload.color || "blue",
              newVersion,
              payload.createdAt || now,
              payload.updatedAt || now
            )
            .run();
        } else if (operation === "update") {
          const oldName = currentRecord?.name;
          await c.env.DB.prepare(
            "UPDATE groups SET name = COALESCE(?, name), color = COALESCE(?, color), version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
          )
            .bind(payload.name, payload.color, newVersion, payload.updatedAt || now, entityId, userId)
            .run();

          // Cascade group rename to bookmarks in D1
          if (payload.name && oldName && oldName !== payload.name) {
            await c.env.DB.prepare(
              "UPDATE bookmarks SET group_name = ?, updated_at = ? WHERE user_id = ? AND group_name = ?"
            )
              .bind(payload.name, now, userId, oldName)
              .run();
          }
        } else if (operation === "delete") {
          await c.env.DB.prepare(
            "UPDATE groups SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ?"
          )
            .bind(now, newVersion, now, entityId, userId)
            .run();
        }

        const savedGroup = await c.env.DB.prepare("SELECT * FROM groups WHERE id = ?")
          .bind(entityId)
          .first();
        recordJson = JSON.stringify(savedGroup);
      }

      // 4. Record in sync_changes
      await c.env.DB.prepare(
        `INSERT INTO sync_changes (user_id, entity_type, entity_id, operation, entity_version, client_change_id, record_json, changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(userId, entityType, entityId, operation, newVersion, changeId, recordJson, now)
        .run();

      results.push({
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

  return c.json({ results });
});

app.get("/api/sync/pull", authMiddleware, async (c) => {
  const userId = c.get("userId");
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

    return {
      sequence: ch.sequence,
      entityType: ch.entity_type,
      entityId: ch.entity_id,
      operation: ch.operation,
      version: ch.entity_version,
      record: parsedRecord,
      deletedAt: ch.operation === "delete" ? (parsedRecord?.deleted_at || ch.changed_at) : null,
    };
  });

  const nextCursor =
    changes && changes.length > 0 ? (changes[changes.length - 1] as any).sequence : cursor;
  const hasMore = changes ? changes.length === limit : false;

  return c.json({
    changes: formattedChanges,
    nextCursor,
    hasMore,
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EDGE LINK METADATA SCRAPER (Cheerio on Cloudflare Workers)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get("/api/metadata", authMiddleware, async (c) => {
  const rawUrl = (c.req.query("url") || "").trim();
  if (!rawUrl) {
    return c.json({ error: "URL is required" }, 400);
  }

  let targetUrl: URL;
  try {
    const formatted = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? rawUrl
      : `https://${rawUrl}`;
    targetUrl = new URL(formatted);
  } catch {
    return c.json({ error: "Invalid URL format" }, 400);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").first().text() ||
      targetUrl.hostname.replace(/^www\./, "");

    let description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "";

    let image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      "";

    // YouTube thumbnail resolution
    if (targetUrl.hostname.includes("youtube.com") || targetUrl.hostname.includes("youtu.be")) {
      let ytId = targetUrl.searchParams.get("v");
      if (!ytId && targetUrl.hostname.includes("youtu.be")) {
        ytId = targetUrl.pathname.slice(1).split("/")[0];
      }
      if (ytId && !image) {
        image = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      }
    }

    if (image && !image.startsWith("http")) {
      try {
        image = new URL(image, targetUrl.origin).toString();
      } catch {}
    }

    return c.json({
      title: title.trim(),
      description: description.trim(),
      image: image.trim(),
    });
  } catch (err: any) {
    return c.json({
      title: targetUrl.hostname.replace(/^www\./, ""),
      description: "",
      image: "",
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEVICES & NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get("/api/notifications/vapid-key", (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY || "" });
});

app.post("/api/devices/register", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { deviceId, name, platform, pushToken } = await c.req.json();

  if (!deviceId) return c.json({ error: "deviceId is required" }, 400);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO devices (id, user_id, name, platform, push_token, created_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       platform = excluded.platform,
       push_token = excluded.push_token,
       last_active_at = excluded.last_active_at`
  )
    .bind(deviceId, userId, name || "Device", platform || "web", pushToken || "", now, now)
    .run();

  return c.json({ success: true });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATIC ASSET FALLBACK (Vite SPA Frontend)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.notFound(async (c) => {
  if (c.env.ASSETS) {
    return await c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Not Found", 404);
});

export default app;
