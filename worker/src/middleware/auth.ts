import { verify } from "hono/jwt";

// Helper: Hash PAT token using SHA-256 (Edge Web Crypto)
export async function hashPatToken(token: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Scope Verification Middleware
export const requireScope = (requiredScope: string) => {
  return async (c: any, next: any) => {
    const scopes: string[] = c.get("tokenScopes") || [];
    if (scopes.includes("*") || scopes.includes(requiredScope)) {
      return await next();
    }
    return c.json({ error: `Forbidden: requires '${requiredScope}' scope` }, 403);
  };
};

// Vault Role Verification Middleware (Full Vault Collaboration)
export const requireVaultRole = (allowedRoles: ("owner" | "editor" | "viewer")[]) => {
  return async (c: any, next: any) => {
    const role = c.get("vaultRole") || "owner";
    if (allowedRoles.includes(role)) {
      return await next();
    }
    return c.json({ error: `Forbidden: role '${role}' cannot perform this action` }, 403);
  };
};

// Auth Middleware (Supports both JWT and Personal Access Tokens mb_pat_...)
export const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return c.json({ error: "Missing authorization token" }, 401);
  }

  // Personal Access Token (PAT) authentication
  if (token.startsWith("mb_pat_")) {
    try {
      const tokenHash = await hashPatToken(token);
      const now = new Date().toISOString();
      const tokenRow: any = await c.env.DB.prepare(
        "SELECT * FROM api_tokens WHERE token_hash = ? AND (expires_at IS NULL OR expires_at > ?)"
      )
        .bind(tokenHash, now)
        .first();

      if (!tokenRow) {
        return c.json({ error: "Invalid or expired API token" }, 401);
      }

      // Update last_used_at timestamp
      const updatePromise = c.env.DB.prepare(
        "UPDATE api_tokens SET last_used_at = ? WHERE id = ?"
      )
        .bind(now, tokenRow.id)
        .run();

      if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
        c.executionCtx.waitUntil(updatePromise);
      } else {
        await updatePromise;
      }

      let scopes: string[] = [];
      try {
        scopes = JSON.parse(tokenRow.scopes);
      } catch {
        scopes = [];
      }

      c.set("userId", tokenRow.user_id);
      c.set("tokenScopes", scopes);
      c.set("authType", "pat");
      c.set("actorType", "agent");
      c.set("actorName", tokenRow.name || "Agent");
      c.set("vaultOwnerId", tokenRow.user_id);
      c.set("vaultRole", "owner");

      return await next();
    } catch (err: any) {
      console.error("[PAT Auth Error]:", err?.message || err);
      return c.json({ error: "Invalid or expired API token", details: err?.message }, 401);
    }
  }

  // Standard User JWT Authentication
  const secret = c.env.JWT_SECRET || "markbel-production-jwt-secret-replace-with-secret";
  try {
    const payload = await verify(token, secret, "HS256");
    const currentUserId = (payload as any).id || (payload as any).userId;
    c.set("userId", currentUserId);
    c.set("tokenScopes", ["*"]);
    c.set("authType", "jwt");
    c.set("actorType", "user");
    c.set("actorName", (payload as any).name || (payload as any).email || "User");
    c.set("vaultOwnerId", currentUserId);
    c.set("vaultRole", "owner");

    // Optional Shared Vault Resolution via X-Vault-Owner header
    const requestedVaultOwner = c.req.header("X-Vault-Owner")?.trim();
    if (requestedVaultOwner && requestedVaultOwner !== currentUserId) {
      const collabRow: any = await c.env.DB.prepare(
        `SELECT role FROM vault_collaborators 
         WHERE owner_id = ? AND (collaborator_user_id = ? OR collaborator_email = (SELECT email FROM users WHERE id = ?)) 
         AND status = 'accepted'`
      )
        .bind(requestedVaultOwner, currentUserId, currentUserId)
        .first();

      if (collabRow) {
        c.set("vaultOwnerId", requestedVaultOwner);
        c.set("vaultRole", collabRow.role || "viewer");
        c.set("actorType", "collaborator");
      } else {
        return c.json({ error: "Access denied to requested shared vault" }, 403);
      }
    }

    return await next();
  } catch (err: any) {
    console.error("[JWT Verify Error]:", err?.message || err);
    return c.json({ error: "Invalid or expired token", details: err?.message }, 401);
  }
};
