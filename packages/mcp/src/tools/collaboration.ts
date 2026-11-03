import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MarkbelClient } from "../client.js";

function getErrorMessage(prefix: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `${prefix}: ${msg}`;
}

export function registerCollaborationTools(server: McpServer, client: MarkbelClient): void {
  // 1. markbel_list_collaborators
  server.tool(
    "markbel_list_collaborators",
    "List all collaborators and pending invitations for the Markbel vault with their roles and status.",
    async () => {
      try {
        const res = await client.listCollaborators();
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
              text: getErrorMessage("List collaborators error", err),
            },
          ],
        };
      }
    }
  );

  // 2. markbel_invite_collaborator
  server.tool(
    "markbel_invite_collaborator",
    "Invite a human collaborator or agent partner to the Markbel vault with viewer or editor permissions.",
    {
      email: z.string().email().describe("Email address of the collaborator to invite"),
      role: z
        .enum(["viewer", "editor"])
        .optional()
        .default("viewer")
        .describe("Permission level: 'viewer' (read-only search and inspection) or 'editor' (mutations, tagging, categorization)"),
    },
    async (args) => {
      try {
        const res = await client.inviteCollaborator({
          email: args.email,
          role: args.role,
        });
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
              text: getErrorMessage("Invite collaborator error", err),
            },
          ],
        };
      }
    }
  );
}
