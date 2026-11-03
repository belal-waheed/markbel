import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MarkbelClient } from "../client.js";

function getErrorMessage(prefix: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `${prefix}: ${msg}`;
}

export function registerSettingsTools(server: McpServer, client: MarkbelClient): void {
  // 1. markbel_get_settings
  server.tool(
    "markbel_get_settings",
    "Retrieve user workflow preferences, category configurations, and default notification schedules.",
    async () => {
      try {
        const res = await client.getSettings();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(res, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: getErrorMessage("Get settings error", err),
            },
          ],
        };
      }
    }
  );

  // 2. markbel_update_settings
  server.tool(
    "markbel_update_settings",
    "Update user workflow preferences and category settings. Master credentials (passwords, emails, user ID) cannot be modified.",
    {
      settings: z
        .record(z.string(), z.unknown())
        .describe("Key-value preference map (e.g., active navigation categories, reminder defaults, reader font size)"),
    },
    async (args) => {
      try {
        const res = await client.updateSettings(args.settings);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(res, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: getErrorMessage("Update settings error", err),
            },
          ],
        };
      }
    }
  );
}
