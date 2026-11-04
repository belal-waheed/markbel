import { Hono } from "hono";
import type { Bindings, Variables } from "../../types";
import { requireScope, requireVaultRole } from "../../middleware/auth";
import { UserSettingsDbRow, getErrorMessage } from "./common";

export const agentSettingsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETTINGS & WORKFLOW PREFERENCES (settings:manage)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentSettingsRouter.get("/settings", requireScope("settings:manage"), async (c) => {
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
    const message = getErrorMessage(err, "Failed to retrieve settings");
    console.error("[Agent Get Settings Error]:", message);
    return c.json({ error: message }, 500);
  }
});

agentSettingsRouter.patch("/settings", requireScope("settings:manage"), requireVaultRole(["owner"]), async (c) => {
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
      if (
        payloadObj[key] !== undefined ||
        (typeof payloadObj.settings === "object" &&
          payloadObj.settings !== null &&
          (payloadObj.settings as Record<string, unknown>)[key] !== undefined)
      ) {
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

    const inputSettings =
      payloadObj.settings && typeof payloadObj.settings === "object"
        ? (payloadObj.settings as Record<string, unknown>)
        : payloadObj;
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
    const message = getErrorMessage(err, "Failed to update settings");
    console.error("[Agent Patch Settings Error]:", message);
    return c.json({ error: message }, 500);
  }
});
