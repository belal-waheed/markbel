import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { openApiSpec } from "../openapi";
import { agentBookmarksRouter } from "./agent/bookmarks";
import { agentGroupsRouter } from "./agent/groups";
import { agentSettingsRouter } from "./agent/settings";
import { agentStatsRouter } from "./agent/stats";

export { agentBookmarksRouter } from "./agent/bookmarks";
export { agentGroupsRouter } from "./agent/groups";
export { agentSettingsRouter } from "./agent/settings";
export { agentStatsRouter } from "./agent/stats";
export * from "./agent/common";

export const agentRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// OpenAPI 3.1 specification schema (Public, no authentication required)
agentRouter.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

// Guard all subsequent endpoints under /api/agent/v1/*
agentRouter.use("*", async (c, next) => {
  if (c.req.path.endsWith("/openapi.json")) {
    return await next();
  }
  return authMiddleware(c, next);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUB-ROUTER MOUNTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
agentRouter.route("/", agentBookmarksRouter);
agentRouter.route("/", agentGroupsRouter);
agentRouter.route("/", agentSettingsRouter);
agentRouter.route("/", agentStatsRouter);
