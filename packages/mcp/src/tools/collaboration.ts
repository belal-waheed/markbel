import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MarkbelClient } from "../client.js";

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
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `List collaborators error: ${err?.message || err}`,
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
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Invite collaborator error: ${err?.message || err}`,
            },
          ],
        };
      }
    }
  );
}
