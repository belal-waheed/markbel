import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MarkbelClient } from "../client.js";

function getErrorMessage(prefix: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `${prefix}: ${msg}`;
}

export function registerSearchTools(server: McpServer, client: MarkbelClient): void {
  // 1. markbel_search
  server.tool(
    "markbel_search",
    "Ranked search across titles, URLs, descriptions, groups, tags, and reader article content in Markbel vault.",
    {
      q: z.string().optional().describe("Search query matching title, URL, description, or content keywords"),
      group: z.string().optional().describe("Filter by group name (case-insensitive)"),
      is_read: z.boolean().optional().describe("Filter by read status (true for read, false for unread)"),
      is_archived: z.boolean().optional().describe("Filter by archived status (default false, true for archived)"),
      is_pinned: z.boolean().optional().describe("Filter by pinned status (true for pinned, false for unpinned)"),
      include_content: z
        .boolean()
        .optional()
        .describe("Whether to include full reader article text in results (default false to conserve context)"),
      limit: z.number().min(1).max(100).optional().describe("Maximum bookmarks to return (default 20, max 100)"),
      offset: z.number().min(0).optional().describe("Pagination offset (default 0)"),
    },
    async (args) => {
      try {
        const results = await client.searchBookmarks(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: getErrorMessage("Search error", err),
            },
          ],
        };
      }
    }
  );

  // 2. markbel_get_bookmark
  server.tool(
    "markbel_get_bookmark",
    "Retrieve complete metadata and reader article content for a specific bookmark by its ID.",
    {
      id: z.string().describe("Unique bookmark ID (UUID)"),
    },
    async (args) => {
      try {
        const bookmark = await client.getBookmark(args.id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(bookmark, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: getErrorMessage("Get bookmark error", err),
            },
          ],
        };
      }
    }
  );

  // 3. markbel_get_stats
  server.tool(
    "markbel_get_stats",
    "Retrieve vault health metrics and sync telemetry (total bookmarks, unread count, archived count, group counts, latest sync sequence).",
    async () => {
      try {
        const stats = await client.getStats();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: getErrorMessage("Get stats error", err),
            },
          ],
        };
      }
    }
  );
}
