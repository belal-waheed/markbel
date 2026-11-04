import { Hono } from "hono";
import type { Bindings, Variables } from "../../types";
import { requireScope } from "../../middleware/auth";
import { CountDbRow, MaxSeqDbRow, getErrorMessage } from "./common";

export const agentStatsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VAULT METRICS & STATS (bookmarks:read)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

agentStatsRouter.get("/stats", requireScope("bookmarks:read"), async (c) => {
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
    const message = getErrorMessage(err, "Failed to retrieve stats");
    console.error("[Agent Stats Error]:", message);
    return c.json({ error: message }, 500);
  }
});
