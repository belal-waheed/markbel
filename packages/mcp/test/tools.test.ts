import { describe, it, expect, vi } from "vitest";
import { MarkbelClient } from "../src/client.js";
import { createMarkbelServer } from "../src/index.js";

describe("Markbel MCP Tools Execution & Error Handling", () => {
  it("executes markbel_search tool and returns formatted JSON text content", async () => {
    const mockClient = {
      searchBookmarks: vi.fn().mockResolvedValue({
        items: [{ id: "bm_1", title: "Markbel Doc", url: "https://markbel.dev" }],
        total: 1,
        limit: 20,
        offset: 0,
      }),
    } as unknown as MarkbelClient;

    const server = createMarkbelServer(mockClient);
    const tool = (server as any)._registeredTools["markbel_search"];
    expect(tool).toBeDefined();

    const result = await tool.handler({ q: "Markbel" });
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBe(1);
    expect(parsed.items[0].title).toBe("Markbel Doc");
  });

  it("handles markbel_search errors gracefully with isError flag", async () => {
    const mockClient = {
      searchBookmarks: vi.fn().mockRejectedValue(new Error("Database timeout")),
    } as unknown as MarkbelClient;

    const server = createMarkbelServer(mockClient);
    const tool = (server as any)._registeredTools["markbel_search"];

    const result = await tool.handler({ q: "err" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Search error: Database timeout");
  });

  it("executes markbel_create_bookmark and returns created record", async () => {
    const mockClient = {
      createBookmark: vi.fn().mockResolvedValue({
        id: "bm_new",
        url: "https://example.com/post",
        title: "Auto Post",
        group: "Articles",
      }),
    } as unknown as MarkbelClient;

    const server = createMarkbelServer(mockClient);
    const tool = (server as any)._registeredTools["markbel_create_bookmark"];

    const result = await tool.handler({
      url: "https://example.com/post",
      group: "Articles",
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.id).toBe("bm_new");
    expect(parsed.url).toBe("https://example.com/post");
  });

  it("handles markbel_create_bookmark rejection with isError flag", async () => {
    const mockClient = {
      createBookmark: vi.fn().mockRejectedValue(new Error("URL is required")),
    } as unknown as MarkbelClient;

    const server = createMarkbelServer(mockClient);
    const tool = (server as any)._registeredTools["markbel_create_bookmark"];

    const result = await tool.handler({ url: "" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Create bookmark error: URL is required");
  });

  it("executes markbel_delete_bookmark and returns success message", async () => {
    const mockClient = {
      deleteBookmark: vi.fn().mockResolvedValue({ success: true, id: "bm_del" }),
    } as unknown as MarkbelClient;

    const server = createMarkbelServer(mockClient);
    const tool = (server as any)._registeredTools["markbel_delete_bookmark"];

    const result = await tool.handler({ id: "bm_del" });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.id).toBe("bm_del");
  });

  it("executes markbel_batch_mutate and returns processed count", async () => {
    const mockClient = {
      batchMutate: vi.fn().mockResolvedValue({ success: true, processed: 3 }),
    } as unknown as MarkbelClient;

    const server = createMarkbelServer(mockClient);
    const tool = (server as any)._registeredTools["markbel_batch_mutate"];

    const result = await tool.handler({
      operations: [
        { action: "archive", id: "bm_1" },
        { action: "archive", id: "bm_2" },
        { action: "delete", id: "bm_3" },
      ],
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.processed).toBe(3);
  });

  it("executes markbel_get_stats zero-argument tool", async () => {
    const mockClient = {
      getStats: vi.fn().mockResolvedValue({
        totalBookmarks: 42,
        unreadCount: 10,
        archivedCount: 5,
        groupsCount: 4,
        latestSyncSequence: 108,
      }),
    } as unknown as MarkbelClient;

    const server = createMarkbelServer(mockClient);
    const tool = (server as any)._registeredTools["markbel_get_stats"];

    const result = await tool.handler();
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.totalBookmarks).toBe(42);
    expect(parsed.latestSyncSequence).toBe(108);
  });

  it("executes markbel_list_groups and markbel_get_rules", async () => {
    const mockClient = {
      listGroups: vi.fn().mockResolvedValue({
        groups: [{ id: "g1", name: "Dev", color: "#3b82f6", bookmarkCount: 12 }],
      }),
      getRules: vi.fn().mockResolvedValue({
        rules: [{ group: "Dev", conditions: [] }],
      }),
    } as unknown as MarkbelClient;

    const server = createMarkbelServer(mockClient);

    const groupsTool = (server as any)._registeredTools["markbel_list_groups"];
    const groupsRes = await groupsTool.handler();
    const parsedGroups = JSON.parse(groupsRes.content[0].text);
    expect(parsedGroups.groups[0].name).toBe("Dev");

    const rulesTool = (server as any)._registeredTools["markbel_get_rules"];
    const rulesRes = await rulesTool.handler();
    const parsedRules = JSON.parse(rulesRes.content[0].text);
    expect(parsedRules.rules[0].group).toBe("Dev");
  });

  it("executes markbel_update_settings and markbel_get_settings", async () => {
    const mockClient = {
      getSettings: vi.fn().mockResolvedValue({
        settings: { activeTabs: ["all", "unread"] },
      }),
      updateSettings: vi.fn().mockResolvedValue({
        success: true,
        settings: { activeTabs: ["all", "unread", "archived"] },
      }),
    } as unknown as MarkbelClient;

    const server = createMarkbelServer(mockClient);

    const getSettingsTool = (server as any)._registeredTools["markbel_get_settings"];
    const getRes = await getSettingsTool.handler();
    expect(JSON.parse(getRes.content[0].text).settings.activeTabs).toHaveLength(2);

    const updateSettingsTool = (server as any)._registeredTools["markbel_update_settings"];
    const updateRes = await updateSettingsTool.handler({
      settings: { activeTabs: ["all", "unread", "archived"] },
    });
    expect(JSON.parse(updateRes.content[0].text).success).toBe(true);
  });
});
