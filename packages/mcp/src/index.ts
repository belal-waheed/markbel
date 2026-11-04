#!/usr/bin/env node

import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { MarkbelClient } from "./client.js";
import { registerAllTools } from "./tools/index.js";

export const SERVER_NAME = "markbel";
export const SERVER_VERSION = "2.5.18";

export * from "./client.js";

/**
 * Creates and configures a Markbel McpServer instance with all tools registered.
 */
export function createMarkbelServer(client: MarkbelClient): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerAllTools(server, client);
  return server;
}

/**
 * Main server startup function.
 */
export async function main(): Promise<void> {
  const baseUrl = process.env.MARKBEL_BASE_URL || process.env.MARKBEL_API_URL || "https://mark.obel.workers.dev";
  const token = process.env.MARKBEL_API_TOKEN;

  if (!token) {
    process.stderr.write("Error: MARKBEL_API_TOKEN environment variable is required to start the Markbel MCP server.\n");
    process.stderr.write("Generate a Personal Access Token (PAT) with 'mb_pat_' prefix in Markbel Settings > API Access Tokens.\n");
    process.exit(1);
  }

  const client = new MarkbelClient({
    baseUrl,
    token,
  });

  const server = createMarkbelServer(client);

  const isSse = process.argv.includes("--sse") || Boolean(process.env.PORT);

  if (isSse) {
    const port = parseInt(process.env.PORT || "3000", 10);
    const transports = new Map<string, SSEServerTransport>();

    const httpServer = http.createServer(async (req, res) => {
      const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && parsedUrl.pathname === "/sse") {
        const transport = new SSEServerTransport("/message", res);
        transports.set(transport.sessionId, transport);

        transport.onclose = () => {
          transports.delete(transport.sessionId);
        };

        try {
          await server.connect(transport);
        } catch (err: any) {
          process.stderr.write(`SSE connect error: ${err?.message || err}\n`);
        }
        return;
      }

      if (req.method === "POST" && parsedUrl.pathname === "/message") {
        const sessionId = parsedUrl.searchParams.get("sessionId");
        const transport = sessionId ? transports.get(sessionId) : (transports.values().next().value ?? null);

        if (transport) {
          await transport.handlePostMessage(req, res);
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Session not found or expired" }));
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    httpServer.listen(port, () => {
      process.stderr.write(`Markbel MCP Server ${SERVER_VERSION} listening on SSE port ${port}\n`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`Markbel MCP Server ${SERVER_VERSION} connected via stdio transport\n`);
  }
}

// Automatically execute main when run directly as CLI
const isDirectExecution =
  process.argv[1] &&
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) ||
    process.argv[1].endsWith("markbel-mcp") ||
    process.argv[1].endsWith("index.js") ||
    process.argv[1].endsWith("index.ts"));

if (isDirectExecution) {
  main().catch((err) => {
    process.stderr.write(`Fatal error starting Markbel MCP Server: ${err?.message || err}\n`);
    process.exit(1);
  });
}
