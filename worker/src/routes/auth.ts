import { Hono } from "hono";
import { sign } from "hono/jwt";
import { z } from "zod";
import type { Bindings, Variables } from "../types";
import { authMiddleware, requireScope, hashPatToken } from "../middleware/auth";

export const authRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Password Hashing using Web Crypto PBKDF2 (Edge Native)
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

function buildRawMimeEmail(
  from: string,
  to: string,
  subject: string,
  html: string,
  code: string
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const base64Html = btoa(unescape(encodeURIComponent(html)));
  const base64Text = btoa(
    unescape(
      encodeURIComponent(
        `Your Markbel verification code is: ${code}\n\nThis code expires in 15 minutes.`
      )
    )
  );

  return [
    `From: Markbel Security <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Text,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTH & USER ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

authRouter.post("/api/users/signup", async (c) => {
  try {
    const { name, email, password, avatar } = await c.req.json();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    if (!cleanName || !cleanEmail || !password) {
      return c.json({ error: "Name, email, and password are required" }, 400);
    }

    const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(cleanEmail)
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
      .bind(id, cleanName, cleanEmail, passwordHash, avatar || "", now)
      .run();

    // Seed default smart groups (YT, Insta, X)
    const defaultSmartGroups = [
      { id: crypto.randomUUID(), name: "YT", color: "red" },
      { id: crypto.randomUUID(), name: "Insta", color: "purple" },
      { id: crypto.randomUUID(), name: "X", color: "slate" },
    ];

    for (const dg of defaultSmartGroups) {
      await c.env.DB.prepare(
        "INSERT INTO groups (id, user_id, name, color, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
      )
        .bind(dg.id, id, dg.name, dg.color, now, now)
        .run();
    }

    const secret = c.env.JWT_SECRET;
    if (!secret) {
      return c.json({ error: "Server misconfiguration: JWT_SECRET binding is missing" }, 500);
    }
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
    const token = await sign({ id, email: cleanEmail, exp }, secret, "HS256");

    return c.json(
      {
        token,
        user: { id, name: cleanName, email: cleanEmail, avatar: avatar || "", createdAt: now },
      },
      201
    );
  } catch (err: any) {
    return c.json({ error: err.message || "Internal server error" }, 500);
  }
});

authRouter.post("/api/users/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const user: any = await c.env.DB.prepare(
      "SELECT id, name, email, password_hash, avatar, created_at FROM users WHERE email = ?"
    )
      .bind(cleanEmail)
      .first();

    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const secret = c.env.JWT_SECRET;
    if (!secret) {
      return c.json({ error: "Server misconfiguration: JWT_SECRET binding is missing" }, 500);
    }
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

authRouter.get("/api/users/me", authMiddleware, async (c) => {
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

authRouter.post("/api/auth/change-password", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const { currentPassword, newPassword } = await c.req.json();

    if (!currentPassword || !newPassword) {
      return c.json({ error: "Current password and new password are required" }, 400);
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return c.json({ error: "New password must be at least 8 characters long" }, 400);
    }

    const user: any = await c.env.DB.prepare(
      "SELECT id, password_hash FROM users WHERE id = ?"
    )
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      return c.json({ error: "Current password is incorrect" }, 400);
    }

    const newHash = await hashPassword(newPassword);
    await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .bind(newHash, userId)
      .run();

    return c.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    return c.json({ error: err.message || "Internal server error" }, 500);
  }
});

authRouter.post("/api/auth/forgot-password", async (c) => {
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

    // Generate 6-digit verification code using cryptographically secure random values
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const code = (100000 + (randomBytes[0] % 900000)).toString();
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Ensure attempts column exists in password_resets
    await c.env.DB.prepare("ALTER TABLE password_resets ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0").run().catch(() => {});

    // Clean up older tokens for this email
    await c.env.DB.prepare("DELETE FROM password_resets WHERE email = ?")
      .bind(normalizedEmail)
      .run();

    await c.env.DB.prepare(
      "INSERT INTO password_resets (id, email, token, expires_at, created_at, attempts) VALUES (?, ?, ?, ?, ?, 0)"
    )
      .bind(id, normalizedEmail, code, expiresAt, now)
      .run();

    let emailDelivered = false;
    let resendNotice = "";

    // 1. Try Cloudflare Email Service Binding (Mail_Pass)
    if (c.env.Mail_Pass) {
      try {
        const fromAddress = c.env.RESEND_FROM_EMAIL || "security@markbel.belal.is-a.dev";
        const emailHtml = `<div style="font-family: sans-serif; padding: 20px; color: #111; max-width: 500px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 8px;">
          <h2 style="color: #0284c7;">Markbel Password Reset</h2>
          <p>You requested a password reset for your Markbel account. Your 6-digit verification code is:</p>
          <div style="background: #f4f4f5; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <span style="letter-spacing: 8px; color: #0284c7; font-size: 32px; font-weight: bold; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #71717a; font-size: 13px;">This code will expire in 15 minutes. If you did not request this reset, you can safely ignore this email.</p>
        </div>`;

        const rawMime = buildRawMimeEmail(fromAddress, normalizedEmail, "Markbel Password Reset Code", emailHtml, code);

        let emailPayload: any;
        try {
          const { EmailMessage } = await import("cloudflare:email");
          emailPayload = new EmailMessage(fromAddress, normalizedEmail, rawMime);
        } catch {
          emailPayload = {
            from: fromAddress,
            to: normalizedEmail,
            raw: rawMime,
          };
        }

        if (typeof c.env.Mail_Pass.send === "function") {
          await c.env.Mail_Pass.send(emailPayload);
          emailDelivered = true;
        }
      } catch (cfEmailErr: any) {
        console.warn("[Cloudflare Mail_Pass Notice]:", cfEmailErr?.message || cfEmailErr);
      }
    }

    // 2. Try Resend API Key if not delivered yet
    const resendKey = c.env.RESEND_API_KEY;
    if (!emailDelivered && resendKey) {
      try {
        const fromAddress = c.env.RESEND_FROM_EMAIL || "Markbel Security <security@markbel.belal.is-a.dev>";
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
        : "If an account exists, a verification code has been generated and sent.",
      emailDelivered,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Internal server error" }, 500);
  }
});

authRouter.post("/api/auth/verify-code", async (c) => {
  try {
    const { email, code } = await c.req.json();
    if (!email || !code) {
      return c.json({ error: "Email and verification code are required" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();

    const resetRecord: any = await c.env.DB.prepare(
      "SELECT id, attempts FROM password_resets WHERE email = ? AND expires_at > ?"
    )
      .bind(normalizedEmail, now)
      .first();

    if (resetRecord && (resetRecord.attempts ?? 0) >= 5) {
      await c.env.DB.prepare("DELETE FROM password_resets WHERE id = ?").bind(resetRecord.id).run();
      return c.json({ error: "Maximum verification attempts exceeded. Please request a new code." }, 429);
    }

    const validRecord: any = await c.env.DB.prepare(
      "SELECT id FROM password_resets WHERE email = ? AND token = ? AND expires_at > ?"
    )
      .bind(normalizedEmail, code.trim(), now)
      .first();

    if (!validRecord) {
      if (resetRecord) {
        await c.env.DB.prepare("UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?")
          .bind(resetRecord.id)
          .run();
      }
      return c.json({ error: "Invalid or expired verification code" }, 400);
    }

    return c.json({ success: true, valid: true, message: "Verification code confirmed." });
  } catch (err: any) {
    return c.json({ error: err.message || "Internal server error" }, 500);
  }
});

authRouter.post("/api/auth/reset-password", async (c) => {
  try {
    const { email, code, newPassword } = await c.req.json();
    if (!email || !code || !newPassword) {
      return c.json({ error: "Email, reset code, and new password are required" }, 400);
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return c.json({ error: "New password must be at least 8 characters long" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();

    const resetRecord: any = await c.env.DB.prepare(
      "SELECT id, attempts FROM password_resets WHERE email = ? AND expires_at > ?"
    )
      .bind(normalizedEmail, now)
      .first();

    if (resetRecord && (resetRecord.attempts ?? 0) >= 5) {
      await c.env.DB.prepare("DELETE FROM password_resets WHERE id = ?").bind(resetRecord.id).run();
      return c.json({ error: "Maximum verification attempts exceeded. Please request a new code." }, 429);
    }

    const validRecord: any = await c.env.DB.prepare(
      "SELECT id FROM password_resets WHERE email = ? AND token = ? AND expires_at > ?"
    )
      .bind(normalizedEmail, code.trim(), now)
      .first();

    if (!validRecord) {
      if (resetRecord) {
        await c.env.DB.prepare("UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?")
          .bind(resetRecord.id)
          .run();
      }
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
// PERSONAL ACCESS TOKEN (PAT) MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ALLOWED_TOKEN_SCOPES = [
  "bookmarks:read",
  "bookmarks:write",
  "groups:manage",
  "shares:manage",
  "settings:manage",
  "tokens:manage",
];

const createTokenSchema = z.object({
  name: z.string().trim().min(1, "Token name is required").max(100),
  scopes: z.array(z.string()).min(1, "At least one scope must be selected"),
  expiresInDays: z.number().int().min(1).nullable().optional(),
});

function generatePatSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let randomStr = "";
  for (let i = 0; i < bytes.length; i++) {
    randomStr += alphabet[bytes[i] % alphabet.length];
  }
  return `mb_pat_${randomStr}`;
}

const handleCreateToken = async (c: any) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = createTokenSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message || "Invalid token payload" }, 400);
    }

    const { name, scopes, expiresInDays } = parsed.data;
    const invalidScope = scopes.find((s) => !ALLOWED_TOKEN_SCOPES.includes(s));
    if (invalidScope) {
      return c.json({ error: `Invalid scope: ${invalidScope}` }, 400);
    }

    const id = crypto.randomUUID();
    const token = generatePatSecret();
    const tokenHash = await hashPatToken(token);
    const tokenPrefix = `${token.slice(0, 14)}...`;
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt =
      expiresInDays && expiresInDays > 0
        ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    await c.env.DB.prepare(
      "INSERT INTO api_tokens (id, user_id, name, token_hash, token_prefix, scopes, expires_at, last_used_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)"
    )
      .bind(id, userId, name, tokenHash, tokenPrefix, JSON.stringify(scopes), expiresAt, createdAt)
      .run();

    return c.json(
      {
        id,
        name,
        token, // Plaintext token returned ONLY once
        tokenPrefix,
        scopes,
        expiresAt,
        createdAt,
      },
      201
    );
  } catch (err: any) {
    console.error("[Create Token Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to create API token" }, 500);
  }
};

authRouter.post("/api/tokens", authMiddleware, requireScope("tokens:manage"), handleCreateToken);
authRouter.post("/api/tokens/create", authMiddleware, requireScope("tokens:manage"), handleCreateToken);

authRouter.get("/api/tokens", authMiddleware, requireScope("tokens:manage"), async (c) => {
  try {
    const userId = c.get("userId");
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, token_prefix, scopes, expires_at, last_used_at, created_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC"
    )
      .bind(userId)
      .all();

    const tokens = (results || []).map((row: any) => {
      let parsedScopes: string[] = [];
      try {
        parsedScopes = JSON.parse(row.scopes);
      } catch {
        parsedScopes = [];
      }
      return {
        id: row.id,
        name: row.name,
        tokenPrefix: row.token_prefix,
        scopes: parsedScopes,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
      };
    });

    return c.json(tokens);
  } catch (err: any) {
    console.error("[Get Tokens Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to list API tokens" }, 500);
  }
});

authRouter.delete("/api/tokens/:id", authMiddleware, requireScope("tokens:manage"), async (c) => {
  try {
    const userId = c.get("userId");
    const id = c.req.param("id");

    await c.env.DB.prepare(
      "DELETE FROM api_tokens WHERE id = ? AND user_id = ?"
    )
      .bind(id, userId)
      .run();

    return c.json({ success: true });
  } catch (err: any) {
    console.error("[Delete Token Error]:", err?.message || err);
    return c.json({ error: err.message || "Failed to delete API token" }, 500);
  }
});
