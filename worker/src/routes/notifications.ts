import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";

export const notificationsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEVICES & NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

notificationsRouter.get("/api/notifications/vapid-key", (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY || "" });
});

notificationsRouter.post("/api/devices/register", authMiddleware, async (c) => {
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

notificationsRouter.put("/api/devices/:deviceId/token", authMiddleware, async (c) => {
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

notificationsRouter.post("/api/notifications/test", authMiddleware, async (c) => {
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

notificationsRouter.post("/api/notifications/dispatch", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const qstashSignature =
    c.req.header("Upstash-Signature") || c.req.header("upstash-signature");
  const secretParam = c.req.query("secret");

  const expectedCronSecret = c.env.CRON_SECRET || c.env.JWT_SECRET;
  const expectedQStashToken = c.env.QSTASH_TOKEN;

  let isAuthorized = false;

  if (expectedCronSecret && secretParam && secretParam === expectedCronSecret) {
    isAuthorized = true;
  } else if (
    token &&
    ((expectedCronSecret && token === expectedCronSecret) || (expectedQStashToken && token === expectedQStashToken))
  ) {
    isAuthorized = true;
  } else if (qstashSignature && (c.env.QSTASH_CURRENT_SIGNING_KEY || expectedQStashToken)) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return c.json({ error: "Unauthorized cron trigger" }, 403);
  }

  const now = new Date().toISOString();

  // Ensure notified_at column exists in D1 SQLite
  try {
    await c.env.DB.prepare("ALTER TABLE bookmarks ADD COLUMN notified_at TEXT DEFAULT NULL").run();
  } catch {}

  // 1. Query due unread bookmarks from Cloudflare D1 with deduplication
  let dueBookmarks: any[] = [];
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, user_id, title, url, remind_at, notified_at 
       FROM bookmarks 
       WHERE remind_at IS NOT NULL 
         AND remind_at != '' 
         AND remind_at <= ? 
         AND is_read = 0 
         AND is_archived = 0 
         AND deleted_at IS NULL
         AND (notified_at IS NULL OR notified_at < remind_at)`
    )
      .bind(now)
      .all();
    dueBookmarks = results || [];
  } catch {
    const { results } = await c.env.DB.prepare(
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
    dueBookmarks = results || [];
  }

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

    // Mark bookmarks as notified to prevent infinite notification loop
    for (const b of bookmarks) {
      try {
        await c.env.DB.prepare("UPDATE bookmarks SET notified_at = ? WHERE id = ?")
          .bind(now, b.id)
          .run();
      } catch (markErr) {
        console.warn(`[Push Dispatch] Failed to update notified_at for bookmark ${b.id}:`, markErr);
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
