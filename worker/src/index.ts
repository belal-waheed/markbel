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
  VAPID_SUBJECT?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  QSTASH_TOKEN?: string;
  QSTASH_CURRENT_SIGNING_KEY?: string;
  QSTASH_NEXT_SIGNING_KEY?: string;
  CRON_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
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

  const secret = c.env.JWT_SECRET || "markbel-production-jwt-secret-replace-with-secret";
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

    const secret = c.env.JWT_SECRET || "markbel-production-jwt-secret-replace-with-secret";
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

    const secret = c.env.JWT_SECRET || "markbel-production-jwt-secret-replace-with-secret";
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

app.post("/api/auth/forgot-password", async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await c.env.DB.prepare("SELECT id, name FROM users WHERE email = ?")
      .bind(normalizedEmail)
      .first();

    if (!user) {
      // Return success anyway to avoid user enumeration
      return c.json({ success: true, message: "If an account exists, a reset code has been sent." });
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Clean up older tokens for this email
    await c.env.DB.prepare("DELETE FROM password_resets WHERE email = ?")
      .bind(normalizedEmail)
      .run();

    await c.env.DB.prepare(
      "INSERT INTO password_resets (id, email, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(id, normalizedEmail, code, expiresAt, now)
      .run();

    // If Resend API Key is configured, send email
    const resendKey = c.env.RESEND_API_KEY;
    let emailDelivered = false;
    let resendNotice = "";

    if (resendKey) {
      try {
        const fromAddress = c.env.RESEND_FROM_EMAIL || "Markbel Security <onboarding@resend.dev>";
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [normalizedEmail],
            subject: "Markbel Password Reset Code",
            html: `<div style="font-family: sans-serif; padding: 20px; color: #111; max-width: 500px; margin: 0 auto; border: 1px solid #e4e4e7; rounded: 8px;">
              <h2 style="color: #0284c7;">Markbel Password Reset</h2>
              <p>You requested a password reset for your Markbel account. Your 6-digit verification code is:</p>
              <div style="background: #f4f4f5; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
                <span style="letter-spacing: 8px; color: #0284c7; font-size: 32px; font-weight: bold; font-family: monospace;">${code}</span>
              </div>
              <p style="color: #71717a; font-size: 13px;">This code will expire in 15 minutes. If you did not request this reset, you can safely ignore this email.</p>
            </div>`,
          }),
        });

        if (resendRes.ok) {
          emailDelivered = true;
        } else {
          const resendData: any = await resendRes.json().catch(() => ({}));
          resendNotice = resendData?.message || `HTTP ${resendRes.status}`;
          console.error("[Resend Error]:", resendNotice);
        }
      } catch (emailErr: any) {
        resendNotice = emailErr?.message || String(emailErr);
        console.error("[Resend Exception]:", resendNotice);
      }
    }

    return c.json({
      success: true,
      message: emailDelivered
        ? "Verification code sent to your email address."
        : "Reset code generated. Please enter your 6-digit code to update your password.",
      // Include devCode if email was not delivered or in development environment
      devCode: !emailDelivered ? code : undefined,
      emailDelivered,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Internal server error" }, 500);
  }
});

app.post("/api/auth/reset-password", async (c) => {
  try {
    const { email, code, newPassword } = await c.req.json();
    if (!email || !code || !newPassword) {
      return c.json({ error: "Email, reset code, and new password are required" }, 400);
    }

    if (newPassword.length < 4) {
      return c.json({ error: "Password must be at least 4 characters long" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();

    const resetRecord: any = await c.env.DB.prepare(
      "SELECT id FROM password_resets WHERE email = ? AND token = ? AND expires_at > ?"
    )
      .bind(normalizedEmail, code.trim(), now)
      .first();

    if (!resetRecord) {
      return c.json({ error: "Invalid or expired verification code" }, 400);
    }

    const newHash = await hashPassword(newPassword);

    await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE email = ?")
      .bind(newHash, normalizedEmail)
      .run();

    // Invalidate reset code
    await c.env.DB.prepare("DELETE FROM password_resets WHERE email = ?")
      .bind(normalizedEmail)
      .run();

    return c.json({ success: true, message: "Password reset successfully. You can now sign in." });
  } catch (err: any) {
    return c.json({ error: err.message || "Internal server error" }, 500);
  }
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
      payload: parsedRecord,
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
// UPSTASH REDIS CACHE HELPERS (Edge REST Protocol)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function computeHash(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const reqHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ...((options.headers as any) || {}),
  };
  try {
    return await fetch(url, {
      ...options,
      headers: reqHeaders,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getRedisCache<T>(env: Bindings, key: string): Promise<T | null> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    const res = await fetchWithTimeout(
      env.UPSTASH_REDIS_REST_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["GET", key]),
      },
      2000
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!data || data.result === null || data.result === undefined) return null;
    return typeof data.result === "string" ? JSON.parse(data.result) : data.result;
  } catch (err) {
    console.warn("[Upstash Redis GET Error]:", err);
    return null;
  }
}

async function setRedisCache(
  env: Bindings,
  key: string,
  value: any,
  ttlSeconds = 604800 // 7 days default
): Promise<void> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return;
  try {
    await fetchWithTimeout(
      env.UPSTASH_REDIS_REST_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["SET", key, JSON.stringify(value), "EX", ttlSeconds]),
      },
      2000
    );
  } catch (err) {
    console.warn("[Upstash Redis SET Error]:", err);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MULTI-PLATFORM RICH MEDIA & LINK METADATA SCRAPER (Cloudflare Edge)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…");
}

function cleanText(str: string): string {
  if (!str) return "";
  return decodeHtmlEntities(str.replace(/\s+/g, " ").trim());
}

function synthesizeMetadataFromUrl(targetUrl: URL): { title: string; description: string; image: string } {
  const rawSegments = targetUrl.pathname
    .split("/")
    .filter(Boolean)
    .map((seg) => decodeURIComponent(seg).replace(/[-_+]/g, " ").replace(/\.[a-zA-Z0-9]+$/, "").trim())
    .filter((seg) => seg.length > 0);

  const domainParts = targetUrl.hostname.replace(/^www\./, "").split(".");
  const domainName = domainParts.length > 1 ? domainParts[0] : targetUrl.hostname;
  const capitalizedDomain = domainName.charAt(0).toUpperCase() + domainName.slice(1);

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${targetUrl.hostname}&sz=128`;

  if (rawSegments.length > 0) {
    const formattedSegments = rawSegments.map((s) =>
      s.replace(/\b\w/g, (l) => l.toUpperCase())
    );
    const synthesizedTitle = `${formattedSegments.join(" - ")} | ${capitalizedDomain}`;
    return {
      title: synthesizedTitle,
      description: `Saved link from ${targetUrl.hostname} (${formattedSegments.join(" / ")})`,
      image: faviconUrl,
    };
  }

  return {
    title: capitalizedDomain || targetUrl.hostname.replace(/^www\./, ""),
    description: `Saved link from ${targetUrl.hostname}`,
    image: faviconUrl,
  };
}

app.get("/api/metadata", async (c) => {
  let targetUrl: URL | null = null;
  try {
    const rawReqUrl = c.req.url;
    let rawUrl = (c.req.query("url") || "").trim();

    const forceRefresh = c.req.query("refresh") === "1" || c.req.query("nocache") === "1" || rawReqUrl.includes("refresh=1") || rawReqUrl.includes("nocache=1");

    const urlParamIdx = rawReqUrl.indexOf("url=");
    if (urlParamIdx !== -1) {
      let extracted = rawReqUrl.slice(urlParamIdx + 4);
      extracted = extracted.replace(/&(refresh|nocache)=[^&]*/g, "");
      try {
        rawUrl = decodeURIComponent(extracted);
      } catch {
        rawUrl = extracted;
      }
    }

    if (!rawUrl) {
      return c.json({ error: "URL is required" }, 400);
    }

    try {
      const formatted = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
        ? rawUrl
        : `https://${rawUrl}`;
      targetUrl = new URL(formatted);
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }

    const urlHash = await computeHash(targetUrl.toString());
    const cacheKey = `markbel:metadata:${urlHash}`;

    // 1. Check Upstash Redis Cache first (unless forceRefresh is requested)
    if (!forceRefresh) {
      const cached = await getRedisCache<{ title: string; description: string; image: string }>(
        c.env,
        cacheKey
      );

      const isSynthesizedFallback =
        cached &&
        ((cached.description && cached.description.startsWith("Saved link from")) ||
          (cached.image && cached.image.includes("google.com/s2/favicons")));

      if (
        cached &&
        !isSynthesizedFallback &&
        cached.title &&
        cached.title !== targetUrl.hostname &&
        (cached.image || cached.description)
      ) {
        c.header("X-Cache", "HIT");
        return c.json(cached);
      }
    }

    c.header("X-Cache", "MISS");

    const hostname = targetUrl.hostname.toLowerCase();
    let metadataResult: { title: string; description: string; image: string } | null = null;

    // 1. YouTube Adapter (Videos, Shorts, Embeds)
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      let ytId: string | null = null;
      if (targetUrl.pathname.startsWith("/shorts/")) {
        ytId = targetUrl.pathname.split("/")[2]?.split("?")[0] || null;
      } else if (targetUrl.pathname.startsWith("/watch")) {
        ytId = targetUrl.searchParams.get("v");
      } else if (targetUrl.pathname.startsWith("/embed/")) {
        ytId = targetUrl.pathname.split("/")[2]?.split("?")[0] || null;
      } else if (hostname.includes("youtu.be")) {
        ytId = targetUrl.pathname.slice(1).split("/")[0]?.split("?")[0] || null;
      }

      if (ytId) {
        const thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        let ytTitle = targetUrl.pathname.startsWith("/shorts/") ? "YouTube Short" : "YouTube Video";
        let ytAuthor = "";

        const watchUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`);
        try {
          const oembedRes = await fetchWithTimeout(
            `https://www.youtube.com/oembed?url=${watchUrl}&format=json`,
            {},
            4000
          );
          if (oembedRes.ok) {
            const oembedData: any = await oembedRes.json();
            if (oembedData.title) ytTitle = oembedData.title;
            if (oembedData.author_name) ytAuthor = oembedData.author_name;
          } else {
            const noembedRes = await fetchWithTimeout(
              `https://noembed.com/embed?url=${watchUrl}`,
              {},
              4000
            );
            if (noembedRes.ok) {
              const noembedData: any = await noembedRes.json();
              if (noembedData.title) ytTitle = noembedData.title;
              if (noembedData.author_name) ytAuthor = noembedData.author_name;
            }
          }
        } catch {}

        metadataResult = {
          title: cleanText(ytTitle),
          description: ytAuthor ? `By ${ytAuthor} on YouTube` : "YouTube Video",
          image: thumbnail,
        };
      }
    }

    // 2. TikTok Adapter (oEmbed)
    if (!metadataResult && hostname.includes("tiktok.com")) {
      try {
        const oembedRes = await fetchWithTimeout(
          `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl.toString())}`,
          {},
          4000
        );
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          metadataResult = {
            title: cleanText(
              oembedData.title || `TikTok by @${oembedData.author_unique_id || oembedData.author_name}`
            ),
            description: oembedData.author_name
              ? `@${oembedData.author_unique_id || oembedData.author_name} on TikTok`
              : "TikTok Video",
            image: oembedData.thumbnail_url || "",
          };
        }
      } catch {}
    }

    // 3. Twitter / X Adapter (Publish oEmbed)
    if (!metadataResult && (hostname.includes("twitter.com") || hostname.includes("x.com"))) {
      try {
        const oembedRes = await fetchWithTimeout(
          `https://publish.twitter.com/oembed?url=${encodeURIComponent(targetUrl.toString())}&omit_script=true`,
          {},
          4000
        );
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          const plainText = (oembedData.html || "").replace(/<[^>]*>?/gm, "").trim();
          metadataResult = {
            title: oembedData.author_name ? `Post by ${oembedData.author_name}` : "Post on X",
            description: cleanText(plainText).slice(0, 300),
            image: "",
          };
        }
      } catch {}
    }

    // 4. Standard Web Pages & Enhanced Multi-Source Scraper
    if (!metadataResult) {
      try {
        let response = await fetchWithTimeout(
          targetUrl.toString(),
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
              "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
              "Sec-Ch-Ua-Mobile": "?0",
              "Sec-Ch-Ua-Platform": '"Windows"',
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "cross-site",
              "Sec-Fetch-User": "?1",
              "Upgrade-Insecure-Requests": "1",
            },
          },
          7500
        );

        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);

          let title = "";
          let description = "";
          let image = "";

          // A. Parse JSON-LD Schema.org metadata
          $('script[type="application/ld+json"]').each((_, el) => {
            if (title && description && image) return;
            try {
              const rawJson = $(el).html() || "{}";
              const parsed = JSON.parse(rawJson);
              const items = Array.isArray(parsed) ? parsed : [parsed];

              for (const item of items) {
                if (!title) {
                  title = item.name || item.headline || item.title || "";
                }
                if (!description) {
                  description = item.description || item.abstract || "";
                }
                if (!image) {
                  if (typeof item.image === "string") image = item.image;
                  else if (Array.isArray(item.image) && item.image[0]) {
                    image = typeof item.image[0] === "string" ? item.image[0] : item.image[0].url;
                  } else if (item.image?.url) image = item.image.url;
                  else if (item.thumbnailUrl) image = item.thumbnailUrl;
                  else if (item.video?.[0]?.thumbnailUrl) image = item.video[0].thumbnailUrl;
                }
              }
            } catch {}
          });

          // B. OpenGraph & Twitter Meta Tags (Priority)
          if (!title) {
            title =
              $('meta[property="og:title"]').attr("content") ||
              $('meta[name="og:title"]').attr("content") ||
              $('meta[name="twitter:title"]').attr("content") ||
              $('meta[property="twitter:title"]').attr("content") ||
              $('meta[name="title"]').attr("content") ||
              $("title").first().text() ||
              $("h1").first().text() ||
              targetUrl.hostname.replace(/^www\./, "");
          }

          if (!description) {
            description =
              $('meta[property="og:description"]').attr("content") ||
              $('meta[name="og:description"]').attr("content") ||
              $('meta[name="twitter:description"]').attr("content") ||
              $('meta[property="twitter:description"]').attr("content") ||
              $('meta[name="description"]').attr("content") ||
              $('meta[itemprop="description"]').attr("content") ||
              "";
          }

          if (!image) {
            image =
              $('meta[property="og:image"]').attr("content") ||
              $('meta[property="og:image:secure_url"]').attr("content") ||
              $('meta[name="og:image"]').attr("content") ||
              $('meta[name="twitter:image"]').attr("content") ||
              $('meta[name="twitter:image:src"]').attr("content") ||
              $('meta[itemprop="image"]').attr("content") ||
              $('link[rel="image_src"]').attr("href") ||
              "";
          }

          // C. Fallback: 2-3 Line Description from Article / Main Content
          if (!description || description.length < 25) {
            $("script, style, noscript, nav, header, footer, svg, button, form").remove();
            const paragraphTexts: string[] = [];
            $("article p, main p, .content p, .post-content p, p").each((_, el) => {
              const text = cleanText($(el).text());
              if (text.length > 30 && !text.includes("cookie") && !text.includes("javascript")) {
                paragraphTexts.push(text);
              }
            });
            if (paragraphTexts.length > 0) {
              description = paragraphTexts.slice(0, 3).join(" ");
            }
          }

          // D. Fallback: High Quality Image on Page
          if (!image) {
            $("article img, main img, .content img, img").each((_, el) => {
              if (image) return;
              const src =
                $(el).attr("src") ||
                $(el).attr("data-src") ||
                $(el).attr("data-lazy-src") ||
                $(el).attr("srcset");
              if (
                src &&
                !src.includes("avatar") &&
                !src.includes("logo") &&
                !src.includes("icon") &&
                !src.includes("pixel") &&
                !src.endsWith(".svg")
              ) {
                const firstSrc = src.split(",")[0].trim().split(" ")[0];
                if (firstSrc.startsWith("http") || firstSrc.startsWith("/")) {
                  image = firstSrc;
                }
              }
            });
          }

          // Resolve relative image URLs
          if (image && !image.startsWith("http")) {
            try {
              image = new URL(image, targetUrl.origin).toString();
            } catch {}
          }

          // Format description to clean 2-3 line length (~250-350 chars)
          let formattedDescription = cleanText(description);
          if (formattedDescription.length > 350) {
            formattedDescription = formattedDescription.slice(0, 347) + "...";
          }

          metadataResult = {
            title: cleanText(title) || targetUrl.hostname.replace(/^www\./, ""),
            description: formattedDescription,
            image: image.trim(),
          };
        }
      } catch {}
    }

    // Smart fallback if anti-bot/CAPTCHA blocked live scraping
    if (!metadataResult) {
      metadataResult = synthesizeMetadataFromUrl(targetUrl);
    }

    // Only cache high-quality results in Redis (NEVER cache empty/failed fallback results)
    const isHighQualityResult =
      metadataResult.title &&
      metadataResult.title !== targetUrl.hostname.replace(/^www\./, "") &&
      (metadataResult.image || metadataResult.description);

    if (isHighQualityResult) {
      setRedisCache(c.env, cacheKey, metadataResult, 604800).catch(() => {});
    }

    return c.json(metadataResult);
  } catch (err: any) {
    console.error("[Metadata Endpoint Exception]:", err);
    if (targetUrl) {
      return c.json(synthesizeMetadataFromUrl(targetUrl));
    }
    return c.json({ title: "Link", description: "", image: "" });
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

app.put("/api/devices/:deviceId/token", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const deviceId = c.req.param("deviceId");
  const { pushToken } = await c.req.json();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO devices (id, user_id, name, platform, push_token, created_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       push_token = excluded.push_token,
       last_active_at = excluded.last_active_at`
  )
    .bind(deviceId, userId, "Device", "web", pushToken || "", now, now)
    .run();

  return c.json({ success: true });
});

app.post("/api/notifications/test", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { results: devices } = await c.env.DB.prepare(
    `SELECT id, platform, push_token FROM devices WHERE user_id = ? AND push_token IS NOT NULL AND push_token != ''`
  )
    .bind(userId)
    .all();

  if (!devices || devices.length === 0) {
    return c.json(
      { error: "No push-enabled devices found for this account. Enable notifications on your device first." },
      400
    );
  }

  let sent = 0;
  for (const dev of devices as any[]) {
    try {
      if (dev.platform === "mobile" && dev.push_token.startsWith("ExponentPushToken")) {
        const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: dev.push_token,
            sound: "default",
            title: "Markbel Push Test",
            body: "Instant Push Notification test successful! Notifications are operational on this device.",
            data: { url: "/" },
          }),
        });
        if (expoRes.ok) sent++;
      } else {
        let sub: any = null;
        try {
          sub = JSON.parse(dev.push_token);
        } catch {}
        if (sub && sub.endpoint) {
          const res = await fetch(sub.endpoint, {
            method: "POST",
            headers: { TTL: "60", "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Markbel Push Test",
              body: "Instant Push Notification test successful! Notifications are operational on this device.",
              url: "/",
            }),
          }).catch(() => null);
          if (res && res.ok) sent++;
        }
      }
    } catch {}
  }

  return c.json({ success: true, sent });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UPSTASH QSTASH NOTIFICATION DISPATCH (15-Minute Cron & Webhooks)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.post("/api/notifications/dispatch", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const qstashSignature =
    c.req.header("Upstash-Signature") || c.req.header("upstash-signature");
  const secretParam = c.req.query("secret");

  const expectedCronSecret = c.env.CRON_SECRET || c.env.JWT_SECRET || "markbel-cron-secret";
  const expectedQStashToken = c.env.QSTASH_TOKEN;

  let isAuthorized = false;

  if (secretParam && secretParam === expectedCronSecret) {
    isAuthorized = true;
  } else if (
    token &&
    (token === expectedCronSecret || (expectedQStashToken && token === expectedQStashToken))
  ) {
    isAuthorized = true;
  } else if (qstashSignature && (c.env.QSTASH_CURRENT_SIGNING_KEY || expectedQStashToken)) {
    isAuthorized = true;
  } else if (!c.env.CRON_SECRET && !c.env.QSTASH_CURRENT_SIGNING_KEY && !c.env.QSTASH_TOKEN) {
    // Dev / local sandbox fallback
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return c.json({ error: "Unauthorized cron trigger" }, 403);
  }

  const now = new Date().toISOString();

  // 1. Query due unread bookmarks from Cloudflare D1
  const { results: dueBookmarks } = await c.env.DB.prepare(
    `SELECT id, user_id, title, url, remind_at 
     FROM bookmarks 
     WHERE remind_at IS NOT NULL 
       AND remind_at != '' 
       AND remind_at <= ? 
       AND is_read = 0 
       AND is_archived = 0 
       AND deleted_at IS NULL`
  )
    .bind(now)
    .all();

  if (!dueBookmarks || dueBookmarks.length === 0) {
    return c.json({
      success: true,
      message: "No due bookmarks found at this time",
      timestamp: now,
      dueCount: 0,
      notificationsSent: 0,
    });
  }

  // 2. Group bookmarks by user_id
  const userDueMap = new Map<string, any[]>();
  for (const b of dueBookmarks as any[]) {
    const list = userDueMap.get(b.user_id) || [];
    list.push(b);
    userDueMap.set(b.user_id, list);
  }

  let totalSent = 0;

  // 3. Dispatch push notifications to each user's registered devices
  for (const [userId, bookmarks] of userDueMap.entries()) {
    const { results: devices } = await c.env.DB.prepare(
      `SELECT id, platform, push_token FROM devices WHERE user_id = ? AND push_token IS NOT NULL AND push_token != ''`
    )
      .bind(userId)
      .all();

    if (!devices || devices.length === 0) continue;

    const count = bookmarks.length;
    const firstTitle = bookmarks[0].title || "Saved Bookmark";
    const notificationPayload = {
      title: count === 1 ? `Reminder: ${firstTitle}` : `${count} Bookmarks Due for Reading`,
      body:
        count === 1
          ? "Tap to open and read your saved link."
          : `You have ${count} unread bookmarks waiting in your vault.`,
      url: count === 1 ? bookmarks[0].url : "/?tab=due",
      tag: "markbel-reminders",
    };

    for (const dev of devices as any[]) {
      try {
        if (dev.platform === "mobile" && dev.push_token.startsWith("ExponentPushToken")) {
          const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: dev.push_token,
              sound: "default",
              title: notificationPayload.title,
              body: notificationPayload.body,
              data: { url: notificationPayload.url },
            }),
          });
          if (expoRes.ok) totalSent++;
        } else {
          let subscription: any = null;
          try {
            subscription = JSON.parse(dev.push_token);
          } catch {}

          if (subscription && subscription.endpoint) {
            const webPushRes = await fetch(subscription.endpoint, {
              method: "POST",
              headers: {
                TTL: "60",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(notificationPayload),
            }).catch(() => null);

            if (webPushRes && (webPushRes.status === 404 || webPushRes.status === 410)) {
              await c.env.DB.prepare("UPDATE devices SET push_token = '' WHERE id = ?")
                .bind(dev.id)
                .run();
            } else if (webPushRes && webPushRes.ok) {
              totalSent++;
            }
          }
        }
      } catch (devErr) {
        console.warn(`[Push Dispatch Error] Device ${dev.id}:`, devErr);
      }
    }
  }

  return c.json({
    success: true,
    timestamp: now,
    dueBookmarks: dueBookmarks.length,
    notificationsSent: totalSent,
  });
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
