import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../../types";
import { requireScope, requireVaultRole } from "../../middleware/auth";
import { GroupDbRow, UserSettingsDbRow, getErrorMessage } from "./common";

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

export const agentGroupsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GROUPS (bookmarks:read)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentGroupsRouter.get("/groups", requireScope("bookmarks:read"), async (c) => {
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
    const message = getErrorMessage(err, "Failed to retrieve groups");
    console.error("[Agent Groups Error]:", message);
    return c.json({ error: message }, 500);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SMART RULES (groups:manage)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentGroupsRouter.get("/rules", requireScope("groups:manage"), async (c) => {
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
    const message = getErrorMessage(err, "Failed to retrieve rules");
    console.error("[Agent Get Rules Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentGroupsRouter.put("/rules", requireScope("groups:manage"), requireVaultRole(["owner", "editor"]), async (c) => {
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
    const message = getErrorMessage(err, "Failed to save rules");
    console.error("[Agent Put Rules Error]:", message);
    return c.json({ error: message }, 500);
  }
});
