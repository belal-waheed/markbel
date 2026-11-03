import { describe, it, expect, vi } from "vitest";
import { MarkbelClient, normalizeBookmark } from "../src/client.js";
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

  it("executes markbel_list_collaborators and markbel_invite_collaborator", async () => {
    const mockClient = {
      listCollaborators: vi.fn().mockResolvedValue({
        collaborators: [
          {
            id: "c1",
            owner_id: "u1",
            collaborator_email: "partner@example.com",
            role: "editor",
            status: "accepted",
            created_at: "2026-11-03T00:00:00Z",
          },
        ],
      }),
      inviteCollaborator: vi.fn().mockResolvedValue({
        id: "c2",
        owner_id: "u1",
        collaborator_email: "newagent@example.com",
        role: "viewer",
        status: "pending",
        invite_token: "mb_inv_abc123",
        created_at: "2026-11-03T00:00:00Z",
      }),
    } as unknown as MarkbelClient;

    const server = createMarkbelServer(mockClient);

    const listTool = (server as any)._registeredTools["markbel_list_collaborators"];
    expect(listTool).toBeDefined();
    const listRes = await listTool.handler();
    expect(listRes.isError).toBeUndefined();
    const parsedList = JSON.parse(listRes.content[0].text);
    expect(parsedList.collaborators).toHaveLength(1);
    expect(parsedList.collaborators[0].collaborator_email).toBe("partner@example.com");

    const inviteTool = (server as any)._registeredTools["markbel_invite_collaborator"];
    expect(inviteTool).toBeDefined();
    const inviteRes = await inviteTool.handler({
      email: "newagent@example.com",
      role: "viewer",
    });
    expect(inviteRes.isError).toBeUndefined();
    const parsedInvite = JSON.parse(inviteRes.content[0].text);
    expect(parsedInvite.status).toBe("pending");
    expect(parsedInvite.invite_token).toBe("mb_inv_abc123");
  });

  it("normalizes raw legacy snake_case payloads to canonical camelCase domain properties", () => {
    const rawPayload = {
      id: "bm_normalize_test",
      url: "https://example.com/article",
      title: "Clean Architecture",
      description: "A deep dive into clean boundaries",
      snippet: "Architecture snippet",
      image: "https://example.com/cover.jpg",
      favicon: "https://example.com/favicon.ico",
      site_name: "Engineering Blog",
      author: "Robert Martin",
      published_at: "2026-01-01T00:00:00Z",
      content_type: "article",
      reading_time: 7,
      word_count: 1400,
      canonical_url: "https://example.com/article",
      article_content: "<p>Deep article body</p>",
      group: "Architecture",
      is_read: 1,
      read_at: "2026-01-02T12:00:00Z",
      is_pinned: 0,
      remind_at: "2026-02-01T09:00:00Z",
      is_archived: 1,
      archive_group: "2026 Archive",
      version: 4,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T12:00:00Z",
      deleted_at: null,
    };

    const normalized = normalizeBookmark(rawPayload);

    expect(normalized).toEqual({
      id: "bm_normalize_test",
      url: "https://example.com/article",
      title: "Clean Architecture",
      description: "A deep dive into clean boundaries",
      snippet: "Architecture snippet",
      image: "https://example.com/cover.jpg",
      favicon: "https://example.com/favicon.ico",
      siteName: "Engineering Blog",
      author: "Robert Martin",
      publishedAt: "2026-01-01T00:00:00Z",
      contentType: "article",
      readingTime: 7,
      wordCount: 1400,
      canonicalUrl: "https://example.com/article",
      articleContent: "<p>Deep article body</p>",
      groupName: "Architecture",
      isRead: true,
      readAt: "2026-01-02T12:00:00Z",
      isPinned: false,
      remindAt: "2026-02-01T09:00:00Z",
      isArchived: true,
      archiveGroup: "2026 Archive",
      version: 4,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T12:00:00Z",
      deletedAt: null,
    });
  });
});
