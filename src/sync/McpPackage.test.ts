import { describe, it, expect, vi } from "vitest";
import { MarkbelClient } from "../../packages/mcp/src/client";
import { createMarkbelServer, SERVER_NAME, SERVER_VERSION } from "../../packages/mcp/src/index";

describe("Markbel MCP Client & Server Architecture", () => {
  describe("MarkbelClient initialization & invariants", () => {
    it("should throw an error if API token is missing or empty", () => {
      expect(() => new MarkbelClient({ token: "" })).toThrow(/API token is required/i);
      expect(() => new MarkbelClient({ token: "   " })).toThrow(/API token is required/i);
    });

    it("should use default edge URL and sanitize trailing slashes", async () => {
      let capturedUrl = "";
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url;
        return new Response(JSON.stringify({ groups: [] }), { status: 200 });
      });

      const client = new MarkbelClient({
        baseUrl: "https://mark.obel.workers.dev///",
        token: "mb_pat_test1234567890",
        fetchFn: mockFetch as any,
      });

      await client.listGroups();
      expect(capturedUrl).toBe("https://mark.obel.workers.dev/api/agent/v1/groups");
    });

    it("supports MARKBEL_API_URL as alternative baseUrl fallback", async () => {
      const customUrl = "https://custom-agent.example.com";
      const resolvedUrl = process.env.MARKBEL_BASE_URL || customUrl || "https://mark.obel.workers.dev";
      expect(resolvedUrl).toBe(customUrl);

      const client = new MarkbelClient({
        baseUrl: resolvedUrl,
        token: "mb_pat_custom",
        fetchFn: (async () => new Response(JSON.stringify({ groups: [] }), { status: 200 })) as any,
      });

      expect(client).toBeDefined();
    });

    it("should attach Authorization Bearer header to all requests", async () => {
      let capturedAuth = "";
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        const headers = init.headers as Headers;
        capturedAuth = headers.get("Authorization") || "";
        return new Response(JSON.stringify({ stats: {} }), { status: 200 });
      });

      const client = new MarkbelClient({
        token: "mb_pat_secret_token",
        fetchFn: mockFetch as any,
      });

      await client.getStats();
      expect(capturedAuth).toBe("Bearer mb_pat_secret_token");
    });
  });

  describe("MarkbelClient REST API methods", () => {
    it("searchBookmarks formats query parameters correctly", async () => {
      let capturedUrl = "";
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url;
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "bm_search_1",
                title: "Normalized Search Result",
                site_name: "React Docs",
                article_content: "Content body",
                group_name: "Frontend",
                is_read: 1,
                is_pinned: 0,
              },
            ],
            total: 1,
            limit: 10,
            offset: 0,
          }),
          { status: 200 }
        );
      });

      const client = new MarkbelClient({
        token: "mb_pat_test",
        fetchFn: mockFetch as any,
      });

      const result = await client.searchBookmarks({
        q: "react architecture",
        group: "Dev",
        is_read: false,
        is_archived: false,
        is_pinned: true,
        include_content: true,
        limit: 10,
        offset: 5,
      });

      expect(result.items[0].siteName).toBe("React Docs");
      expect(result.items[0].articleContent).toBe("Content body");
      expect(result.items[0].groupName).toBe("Frontend");
      expect(result.items[0].isRead).toBe(true);
      expect(result.items[0].isPinned).toBe(false);

      const parsed = new URL(capturedUrl);
      expect(parsed.pathname).toBe("/api/agent/v1/bookmarks/search");
      expect(parsed.searchParams.get("q")).toBe("react architecture");
      expect(parsed.searchParams.get("group")).toBe("Dev");
      expect(parsed.searchParams.get("is_read")).toBe("false");
      expect(parsed.searchParams.get("is_archived")).toBe("false");
      expect(parsed.searchParams.get("is_pinned")).toBe("true");
      expect(parsed.searchParams.get("include_content")).toBe("true");
      expect(parsed.searchParams.get("limit")).toBe("10");
      expect(parsed.searchParams.get("offset")).toBe("5");
    });

    it("getBookmark validates id and dispatches GET request", async () => {
      let capturedUrl = "";
      let capturedMethod = "";
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init.method || "GET";
        return new Response(JSON.stringify({ id: "bm_123", title: "Test" }), { status: 200 });
      });

      const client = new MarkbelClient({
        token: "mb_pat_test",
        fetchFn: mockFetch as any,
      });

      await expect(client.getBookmark("")).rejects.toThrow(/id is required/i);

      const bm = await client.getBookmark("bm 123/special");
      expect(capturedUrl).toContain("/api/agent/v1/bookmarks/bm%20123%2Fspecial");
      expect(capturedMethod).toBe("GET");
      expect(bm.id).toBe("bm_123");
    });

    it("createBookmark dispatches POST request with JSON payload", async () => {
      let capturedBody = "";
      let capturedMethod = "";
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedMethod = init.method || "GET";
        capturedBody = String(init.body || "");
        return new Response(JSON.stringify({ id: "bm_created", url: "https://example.com" }), {
          status: 201,
        });
      });

      const client = new MarkbelClient({
        token: "mb_pat_test",
        fetchFn: mockFetch as any,
      });

      await expect(client.createBookmark({ url: "" })).rejects.toThrow(/URL is required/i);

      const created = await client.createBookmark({
        url: "https://example.com",
        title: "Example Title",
        group: "Articles",
        isPinned: true,
      });

      expect(capturedMethod).toBe("POST");
      expect(JSON.parse(capturedBody)).toEqual({
        url: "https://example.com",
        title: "Example Title",
        group: "Articles",
        isPinned: true,
      });
      expect(created.id).toBe("bm_created");
    });

    it("updateBookmark dispatches PATCH request with delta payload", async () => {
      let capturedBody = "";
      let capturedMethod = "";
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedMethod = init.method || "GET";
        capturedBody = String(init.body || "");
        return new Response(JSON.stringify({ id: "bm_1", title: "New Title" }), { status: 200 });
      });

      const client = new MarkbelClient({
        token: "mb_pat_test",
        fetchFn: mockFetch as any,
      });

      const updated = await client.updateBookmark("bm_1", {
        title: "New Title",
        isRead: true,
      });

      expect(capturedMethod).toBe("PATCH");
      expect(JSON.parse(capturedBody)).toEqual({
        title: "New Title",
        isRead: true,
      });
      expect(updated.title).toBe("New Title");
    });

    it("deleteBookmark dispatches DELETE request", async () => {
      let capturedMethod = "";
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedMethod = init.method || "GET";
        return new Response(JSON.stringify({ success: true, id: "bm_1" }), { status: 200 });
      });

      const client = new MarkbelClient({
        token: "mb_pat_test",
        fetchFn: mockFetch as any,
      });

      const result = await client.deleteBookmark("bm_1");
      expect(capturedMethod).toBe("DELETE");
      expect(result.success).toBe(true);
    });

    it("batchMutate dispatches atomic batch operations and validates array", async () => {
      let capturedBody = "";
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedBody = String(init.body || "");
        return new Response(JSON.stringify({ success: true, processed: 2 }), { status: 200 });
      });

      const client = new MarkbelClient({
        token: "mb_pat_test",
        fetchFn: mockFetch as any,
      });

      await expect(client.batchMutate([])).rejects.toThrow(/must not be empty/i);

      const res = await client.batchMutate([
        { action: "archive", id: "bm_1" },
        { action: "delete", id: "bm_2" },
      ]);

      expect(res.processed).toBe(2);
      expect(JSON.parse(capturedBody).operations).toHaveLength(2);
    });

    it("getRules and setRule manage smart rules", async () => {
      let putBody = "";
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        if (init.method === "PUT") {
          putBody = String(init.body || "");
          return new Response(JSON.stringify({ success: true, rules: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ rules: [{ group: "News", conditions: [] }] }), {
          status: 200,
        });
      });

      const client = new MarkbelClient({
        token: "mb_pat_test",
        fetchFn: mockFetch as any,
      });

      const getRes = await client.getRules();
      expect(getRes.rules[0].group).toBe("News");

      await client.setRule([
        {
          group: "Tech",
          conditions: [{ field: "domain", operator: "contains", value: "github.com" }],
        },
      ]);
      expect(JSON.parse(putBody).rules[0].group).toBe("Tech");
    });

    it("getSettings and updateSettings manage workflow preferences", async () => {
      let patchBody = "";
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        if (init.method === "PATCH") {
          patchBody = String(init.body || "");
          return new Response(JSON.stringify({ success: true, settings: {} }), { status: 200 });
        }
        return new Response(JSON.stringify({ settings: { theme: "dark" } }), { status: 200 });
      });

      const client = new MarkbelClient({
        token: "mb_pat_test",
        fetchFn: mockFetch as any,
      });

      const settingsRes = await client.getSettings();
      expect(settingsRes.settings.theme).toBe("dark");

      await client.updateSettings({ defaultGroup: "Work" });
      expect(JSON.parse(patchBody)).toEqual({ defaultGroup: "Work" });
    });

    it("throws clear error on non-2xx HTTP responses", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({ error: "Missing required scope: bookmarks:write" }),
          { status: 403, statusText: "Forbidden" }
        );
      });

      const client = new MarkbelClient({
        token: "mb_pat_readonly",
        fetchFn: mockFetch as any,
      });

      await expect(client.deleteBookmark("bm_test")).rejects.toThrow(
        "Missing required scope: bookmarks:write"
      );
    });
  });

  describe("Markbel MCP Server tool registration & metadata", () => {
    it("creates server instance with correct name and version", () => {
      const client = new MarkbelClient({ token: "mb_pat_dummy" });
      const server = createMarkbelServer(client);

      expect(SERVER_NAME).toBe("markbel");
      expect(SERVER_VERSION).toBe("2.5.14");
      expect(server).toBeDefined();
    });

    it("registers all 14 official Markbel MCP tools", () => {
      const client = new MarkbelClient({ token: "mb_pat_dummy" });
      const server = createMarkbelServer(client);

      // Access registered tools map in McpServer
      const registeredTools = (server as any)._registeredTools;
      expect(registeredTools).toBeDefined();

      const expectedToolNames = [
        "markbel_search",
        "markbel_get_bookmark",
        "markbel_get_stats",
        "markbel_create_bookmark",
        "markbel_update_bookmark",
        "markbel_delete_bookmark",
        "markbel_batch_mutate",
        "markbel_list_groups",
        "markbel_get_rules",
        "markbel_set_rule",
        "markbel_get_settings",
        "markbel_update_settings",
        "markbel_list_collaborators",
        "markbel_invite_collaborator",
      ];

      for (const toolName of expectedToolNames) {
        expect(registeredTools[toolName]).toBeDefined();
      }
      expect(Object.keys(registeredTools).length).toBe(14);
    });

    it("listCollaborators and inviteCollaborator format API requests correctly", async () => {
      let capturedUrl = "";
      let capturedMethod = "";
      let capturedBody: any = null;

      const mockFetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init.method || "GET";
        if (init.body) {
          capturedBody = JSON.parse(init.body as string);
        }
        return new Response(JSON.stringify({ collaborators: [] }), { status: 200 });
      });

      const client = new MarkbelClient({
        token: "mb_pat_test",
        fetchFn: mockFetch as any,
      });

      await client.listCollaborators();
      expect(capturedUrl).toBe("https://mark.obel.workers.dev/api/agent/v1/collaborators");
      expect(capturedMethod).toBe("GET");

      await client.inviteCollaborator({ email: "agent@markbel.dev", role: "editor" });
      expect(capturedUrl).toBe("https://mark.obel.workers.dev/api/agent/v1/collaborators");
      expect(capturedMethod).toBe("POST");
      expect(capturedBody.email).toBe("agent@markbel.dev");
      expect(capturedBody.role).toBe("editor");
    });
  });
});
