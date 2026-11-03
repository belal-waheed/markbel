import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MarkbelClient } from "../client.js";

export function registerGroupTools(server: McpServer, client: MarkbelClient): void {
  // 1. markbel_list_groups
  server.tool(
    "markbel_list_groups",
    "List all bookmark groups in the vault, including active non-archived bookmark counts and color codes.",
    async () => {
      try {
        const res = await client.listGroups();
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
              text: `List groups error: ${err?.message || err}`,
            },
          ],
        };
      }
    }
  );

  // 2. markbel_get_rules
  server.tool(
    "markbel_get_rules",
    "Retrieve smart auto-categorization rules that automatically route saved URLs into specific groups based on URL domain, title, or path.",
    async () => {
      try {
        const res = await client.getRules();
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
              text: `Get rules error: ${err?.message || err}`,
            },
          ],
        };
      }
    }
  );

  // 3. markbel_set_rule
  server.tool(
    "markbel_set_rule",
    "Replace or update the list of smart auto-categorization rules for automated bookmark routing.",
    {
      rules: z
        .array(
          z.object({
            id: z.string().optional().describe("Optional rule identifier"),
            group: z.string().describe("Target group name to assign when rule conditions match"),
            matchType: z.enum(["all", "any"]).optional().describe("Whether all or any conditions must match"),
            conditions: z
              .array(
                z.object({
                  field: z.string().describe("Field to inspect: 'url', 'title', 'domain', or 'description'"),
                  operator: z.string().describe("Condition operator: 'contains', 'startsWith', 'endsWith', or 'regex'"),
                  value: z.string().describe("Matching value string"),
                })
              )
              .describe("List of rule conditions"),
          })
        )
        .describe("Array of smart categorization rule objects"),
    },
    async (args) => {
      try {
        const res = await client.setRule(args.rules as any);
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
              text: `Set rule error: ${err?.message || err}`,
            },
          ],
        };
      }
    }
  );
}
