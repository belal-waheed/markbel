import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MarkbelClient } from "../client.js";
import { registerSearchTools } from "./search.js";
import { registerBookmarkTools } from "./bookmarks.js";
import { registerGroupTools } from "./groups.js";
import { registerSettingsTools } from "./settings.js";
import { registerCollaborationTools } from "./collaboration.js";

export function registerAllTools(server: McpServer, client: MarkbelClient): void {
  registerSearchTools(server, client);
  registerBookmarkTools(server, client);
  registerGroupTools(server, client);
  registerSettingsTools(server, client);
  registerCollaborationTools(server, client);
}

export {
  registerSearchTools,
  registerBookmarkTools,
  registerGroupTools,
  registerSettingsTools,
  registerCollaborationTools,
};
