import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MarkbelClient, BatchOperation } from "../client.js";

function getErrorMessage(prefix: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `${prefix}: ${msg}`;
}

export function registerBookmarkTools(server: McpServer, client: MarkbelClient): void {
  // 1. markbel_create_bookmark
  server.tool(
    "markbel_create_bookmark",
    "Create a new bookmark in the Markbel vault. Automatically triggers edge metadata scraping and smart rule group assignment.",
    {
      url: z.string().describe("Target URL to bookmark"),
      title: z.string().optional().describe("Optional custom title override"),
      description: z.string().optional().describe("Optional custom description or note"),
      group: z.string().optional().describe("Target group name (auto-assigned via smart rules if omitted)"),
      isPinned: z.boolean().optional().describe("Whether bookmark should be pinned to the top"),
      remindAt: z.string().optional().describe("Optional ISO 8601 reminder timestamp"),
    },
    async (args) => {
      try {
        const created = await client.createBookmark(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(created, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: getErrorMessage("Create bookmark error", err),
            },
          ],
        };
      }
    }
  );

  // 2. markbel_update_bookmark
  server.tool(
    "markbel_update_bookmark",
    "Update fields of an existing bookmark in the Markbel vault. Increments version and logs audit sync change.",
    {
      id: z.string().describe("Unique bookmark ID"),
      title: z.string().optional().describe("Updated title"),
      description: z.string().optional().describe("Updated description"),
      group: z.string().optional().describe("Updated group assignment"),
      isRead: z.boolean().optional().describe("Updated read status"),
      isPinned: z.boolean().optional().describe("Updated pinned status"),
      remindAt: z.string().optional().describe("Updated reminder timestamp (empty string to clear)"),
      isArchived: z.boolean().optional().describe("Updated archive status"),
    },
    async (args) => {
      try {
        const { id, ...data } = args;
        const updated = await client.updateBookmark(id, data);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(updated, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: getErrorMessage("Update bookmark error", err),
            },
          ],
        };
      }
    }
  );

  // 3. markbel_delete_bookmark
  server.tool(
    "markbel_delete_bookmark",
    "Soft-delete a bookmark from the Markbel vault. Logs audit sync change for client deletion propagation.",
    {
      id: z.string().describe("Unique bookmark ID to delete"),
    },
    async (args) => {
      try {
        const res = await client.deleteBookmark(args.id);
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
              text: getErrorMessage("Delete bookmark error", err),
            },
          ],
        };
      }
    }
  );

  // 4. markbel_batch_mutate
  server.tool(
    "markbel_batch_mutate",
    "Execute bulk atomic bookmark operations (batch update, archive, or delete) inside a single transaction.",
    {
      operations: z
        .array(
          z.object({
            action: z.enum(["update", "archive", "delete"]).describe("Batch action type"),
            id: z.string().describe("Target bookmark ID"),
            data: z
              .object({
                title: z.string().optional(),
                description: z.string().optional(),
                group: z.string().optional(),
                isRead: z.boolean().optional(),
                isPinned: z.boolean().optional(),
                remindAt: z.string().optional(),
                isArchived: z.boolean().optional(),
              })
              .optional()
              .describe("Data payload for update action"),
          })
        )
        .min(1)
        .max(100)
        .describe("Array of batch operations (maximum 100)"),
    },
    async (args) => {
      try {
        const res = await client.batchMutate(args.operations as BatchOperation[]);
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
              text: getErrorMessage("Batch mutate error", err),
            },
          ],
        };
      }
    }
  );
}
