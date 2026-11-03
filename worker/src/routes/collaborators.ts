import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../types";
import { authMiddleware, requireScope, requireVaultRole } from "../middleware/auth";

export interface CollaboratorDbRow {
  id: string;
  owner_id: string;
  collaborator_user_id: string | null;
  collaborator_email: string;
  role: string;
  status: string;
  invite_token: string;
  created_at: string;
  accepted_at: string | null;
}

export interface SharedVaultDbRow {
  id: string;
  owner_id: string;
  owner_name?: string;
  owner_email?: string;
  role: string;
  created_at: string;
  accepted_at: string | null;
}

interface UserDbRow {
  id: string;
  email?: string;
  name?: string;
}

export const inviteCollaboratorSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(["viewer", "editor"]).optional().default("viewer"),
});

export const acceptCollaboratorSchema = z.object({
  inviteToken: z.string().min(1).max(100),
});

export const collaboratorsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// All collaborator management and shared vault operations require authentication
collaboratorsRouter.use("*", authMiddleware);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VAULT COLLABORATION & PEER SHARING (shares:manage)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// List collaborators for current vault
collaboratorsRouter.get("/collaborators", requireScope("shares:manage"), async (c) => {
  try {
    const ownerId = c.get("vaultOwnerId") || c.get("userId");
    const { results } = await c.env.DB.prepare(
      `SELECT id, owner_id, collaborator_user_id, collaborator_email, role, status, invite_token, created_at, accepted_at
       FROM vault_collaborators WHERE owner_id = ? ORDER BY created_at DESC`
    )
      .bind(ownerId)
      .all<CollaboratorDbRow>();

    return c.json({ collaborators: results || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list collaborators";
    console.error("[List Collaborators Error]:", message);
    return c.json({ error: message }, 500);
  }
});

// Invite a collaborator (owner only)
collaboratorsRouter.post("/collaborators", requireScope("shares:manage"), requireVaultRole(["owner"]), async (c) => {
  try {
    const ownerId = c.get("userId");

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON request body" }, 400);
    }

    const parseResult = inviteCollaboratorSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return c.json({ error: "Invalid collaborator invitation", details: parseResult.error.format() }, 400);
    }

    const { email, role } = parseResult.data;

    // Check if user is inviting themselves
    const ownerUser = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(ownerId).first<UserDbRow>();
    if (ownerUser && ownerUser.email?.toLowerCase() === email.toLowerCase()) {
      return c.json({ error: "Cannot invite vault owner as collaborator" }, 400);
    }

    // Check if invitation already exists
    const existing = await c.env.DB.prepare(
      "SELECT id FROM vault_collaborators WHERE owner_id = ? AND collaborator_email = ?"
    )
      .bind(ownerId, email)
      .first<CollaboratorDbRow>();

    if (existing) {
      return c.json({ error: "Collaborator or invitation already exists for this email" }, 409);
    }

    const id = crypto.randomUUID();
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const tokenSuffix = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const inviteToken = `mb_inv_${tokenSuffix}`;
    const now = new Date().toISOString();

    // Check if the invited email belongs to an existing registered user
    const existingUser = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<UserDbRow>();
    const collaboratorUserId = existingUser ? existingUser.id : null;

    await c.env.DB.prepare(
      `INSERT INTO vault_collaborators (
        id, owner_id, collaborator_user_id, collaborator_email, role, status, invite_token, created_at, accepted_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL)`
    )
      .bind(id, ownerId, collaboratorUserId, email, role, inviteToken, now)
      .run();

    return c.json(
      {
        id,
        owner_id: ownerId,
        collaborator_user_id: collaboratorUserId,
        collaborator_email: email,
        role,
        status: "pending",
        invite_token: inviteToken,
        invite_link: `https://mark.obel.workers.dev/join?token=${inviteToken}`,
        created_at: now,
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to invite collaborator";
    console.error("[Invite Collaborator Error]:", message);
    return c.json({ error: message }, 500);
  }
});

// Revoke or remove a collaborator (owner only)
collaboratorsRouter.delete("/collaborators/:id", requireScope("shares:manage"), requireVaultRole(["owner"]), async (c) => {
  try {
    const ownerId = c.get("userId");
    const id = c.req.param("id");

    await c.env.DB.prepare(
      "DELETE FROM vault_collaborators WHERE id = ? AND owner_id = ?"
    )
      .bind(id, ownerId)
      .run();

    return c.json({ success: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove collaborator";
    console.error("[Delete Collaborator Error]:", message);
    return c.json({ error: message }, 500);
  }
});

// Accept a collaborator invitation
collaboratorsRouter.post("/collaborators/accept", async (c) => {
  try {
    const userId = c.get("userId");

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON request body" }, 400);
    }

    const parseResult = acceptCollaboratorSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return c.json({ error: "Invalid invite token", details: parseResult.error.format() }, 400);
    }

    const { inviteToken } = parseResult.data;

    const collabRow = await c.env.DB.prepare(
      "SELECT * FROM vault_collaborators WHERE invite_token = ? AND status = 'pending'"
    )
      .bind(inviteToken)
      .first<CollaboratorDbRow>();

    if (!collabRow) {
      return c.json({ error: "Invalid or expired invitation token" }, 404);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      "UPDATE vault_collaborators SET status = 'accepted', collaborator_user_id = ?, accepted_at = ? WHERE id = ?"
    )
      .bind(userId, now, collabRow.id)
      .run();

    return c.json({
      success: true,
      vault_id: collabRow.owner_id,
      role: collabRow.role,
      status: "accepted",
      accepted_at: now,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to accept invitation";
    console.error("[Accept Invite Error]:", message);
    return c.json({ error: message }, 500);
  }
});

// List vaults shared with current user
collaboratorsRouter.get("/collaborators/shared-vaults", async (c) => {
  try {
    const userId = c.get("userId");
    const { results } = await c.env.DB.prepare(
      `SELECT c.id, c.owner_id, u.name as owner_name, u.email as owner_email, c.role, c.created_at, c.accepted_at
       FROM vault_collaborators c
       JOIN users u ON u.id = c.owner_id
       WHERE (c.collaborator_user_id = ? OR c.collaborator_email = (SELECT email FROM users WHERE id = ?))
       AND c.status = 'accepted'`
    )
      .bind(userId, userId)
      .all<SharedVaultDbRow>();

    return c.json({ shared_vaults: results || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list shared vaults";
    console.error("[List Shared Vaults Error]:", message);
    return c.json({ error: message }, 500);
  }
});
