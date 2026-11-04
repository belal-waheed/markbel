import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings, Variables } from "./types";
import { authRouter } from "./routes/auth";
import { syncRouter } from "./routes/sync";
import { mediaRouter, isSafePublicUrl, isSignedCdnExpired, sniffImageMimeType } from "./routes/media";
import { notificationsRouter } from "./routes/notifications";
import { shareRouter } from "./routes/share";
import { agentRouter } from "./routes/agent";
import { collaboratorsRouter } from "./routes/collaborators";
import { handleScheduledLinkHealthCheck } from "./lib/linkHealth";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORS MIDDLEWARE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.use(
  "/api/*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "If-None-Match",
      "If-Match",
      "Accept",
      "X-Requested-With",
      "Cache-Control",
      "Pragma",
    ],
    exposeHeaders: ["Content-Length", "ETag", "Date"],
    maxAge: 86400,
  })
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYSTEM & HEALTH ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.get("/api/health", (c) => {
  return c.json({
    status: "healthy",
    runtime: "Cloudflare Workers",
    database: "Cloudflare D1",
    timestamp: new Date().toISOString(),
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUB-ROUTER MOUNT POINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.route("/api/agent/v1", agentRouter);
app.route("/api/agent/v1", collaboratorsRouter);
app.route("/", authRouter);
app.route("/", syncRouter);
app.route("/", mediaRouter);
app.route("/", notificationsRouter);
app.route("/", shareRouter);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATIC ASSET FALLBACK (Vite SPA Frontend)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.notFound(async (c) => {
  if (c.env.ASSETS) {
    return await c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Not Found", 404);
});

export type { Bindings, Variables };
export { isSafePublicUrl, isSignedCdnExpired, sniffImageMimeType, handleScheduledLinkHealthCheck, app };

export default {
  fetch: (request: Request, env: Bindings, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledLinkHealthCheck(env));
  },
};
