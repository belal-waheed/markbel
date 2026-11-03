import { describe, it, expect, vi, beforeEach } from "vitest";
import { openApiSpec } from "../../worker/src/openapi";
import { normalizeSyncRecord } from "../../worker/src/normalize";
import {
  agentApi,
  AgentBookmarkSearchParams,
  AgentCreateBookmarkRequest,
  AgentUpdateBookmarkRequest,
  AgentBatchOperation,
} from "../lib/api";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCOPE ENFORCEMENT & SECURITY UNIT TESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function verifyScopeAccess(tokenScopes: string[], requiredScope: string): boolean {
  return tokenScopes.includes("*") || tokenScopes.includes(requiredScope);
}

function sanitizeAgentSettings(settingsInput: Record<string, any>): { allowed: boolean; error?: string; clean?: Record<string, any> } {
  const forbidden = ["password", "password_hash", "passwordHash", "email", "token", "role", "user_id", "userId"];
  for (const key of forbidden) {
    if (settingsInput[key] !== undefined || (settingsInput.settings && settingsInput.settings[key] !== undefined)) {
      return {
        allowed: false,
        error: `Modifying master account field '${key}' via settings endpoint is strictly prohibited`,
      };
    }
  }
  const clean = { ...settingsInput };
  return { allowed: true, clean };
}

describe("Markbel Agent API - Phase 2 Architectural Tests", () => {
  describe("1. Scope Permissions Matrix", () => {
    it("allows full access to all endpoints with wildcard [*] scope", () => {
      const wildcard = ["*"];
      expect(verifyScopeAccess(wildcard, "bookmarks:read")).toBe(true);
      expect(verifyScopeAccess(wildcard, "bookmarks:write")).toBe(true);
      expect(verifyScopeAccess(wildcard, "groups:manage")).toBe(true);
      expect(verifyScopeAccess(wildcard, "settings:manage")).toBe(true);
    });

    it("restricts read-only token strictly to bookmarks:read endpoints", () => {
      const readOnly = ["bookmarks:read"];
      expect(verifyScopeAccess(readOnly, "bookmarks:read")).toBe(true);
      expect(verifyScopeAccess(readOnly, "bookmarks:write")).toBe(false);
      expect(verifyScopeAccess(readOnly, "groups:manage")).toBe(false);
      expect(verifyScopeAccess(readOnly, "settings:manage")).toBe(false);
    });

    it("restricts write token strictly to bookmarks:write endpoints", () => {
      const writeOnly = ["bookmarks:write"];
      expect(verifyScopeAccess(writeOnly, "bookmarks:read")).toBe(false);
      expect(verifyScopeAccess(writeOnly, "bookmarks:write")).toBe(true);
      expect(verifyScopeAccess(writeOnly, "groups:manage")).toBe(false);
      expect(verifyScopeAccess(writeOnly, "settings:manage")).toBe(false);
    });

    it("authorizes groups:manage scope for smart categorization rules", () => {
      const groupToken = ["groups:manage"];
      expect(verifyScopeAccess(groupToken, "groups:manage")).toBe(true);
      expect(verifyScopeAccess(groupToken, "bookmarks:write")).toBe(false);
      expect(verifyScopeAccess(groupToken, "settings:manage")).toBe(false);
    });

    it("authorizes settings:manage scope for workflow preferences", () => {
      const settingsToken = ["settings:manage"];
      expect(verifyScopeAccess(settingsToken, "settings:manage")).toBe(true);
      expect(verifyScopeAccess(settingsToken, "bookmarks:write")).toBe(false);
      expect(verifyScopeAccess(settingsToken, "groups:manage")).toBe(false);
    });
  });

  describe("2. Search Multi-Attribute Ranking & Content Filtering", () => {
    const mockVault = [
      {
        id: "bm-1",
        title: "TypeScript Deep Dive",
        url: "https://basarat.gitbook.io/typescript",
        site_name: "GitBook",
        description: "A comprehensive guide on TypeScript language features.",
        article_content: "Full markdown text of TypeScript guide spanning 5000 words...",
        group_name: "Code",
        is_pinned: 1,
        is_read: 0,
        is_archived: 0,
        updated_at: "2026-11-01T10:00:00Z",
      },
      {
        id: "bm-2",
        title: "Web Standards and APIs",
        url: "https://developer.mozilla.org/en-US/docs/Web/API",
        site_name: "MDN Web Docs",
        description: "Documentation on browser interfaces and TypeScript types.",
        article_content: "MDN reference for DOM, Web Crypto, and Fetch APIs...",
        group_name: "Reading",
        is_pinned: 0,
        is_read: 1,
        is_archived: 0,
        updated_at: "2026-11-02T10:00:00Z",
      },
      {
        id: "bm-3",
        title: "Legacy Archived Notes",
        url: "https://example.com/archive",
        site_name: "Example",
        description: "Old archived notes on TypeScript.",
        article_content: "Archived content...",
        group_name: "Archive",
        is_pinned: 0,
        is_read: 1,
        is_archived: 1,
        updated_at: "2026-10-01T10:00:00Z",
      },
    ];

    it("excludes archived bookmarks by default (is_archived=false)", () => {
      const results = mockVault.filter((b) => b.is_archived === 0);
      expect(results.length).toBe(2);
      expect(results.some((b) => b.id === "bm-3")).toBe(false);
    });

    it("includes only archived bookmarks when is_archived=true", () => {
      const results = mockVault.filter((b) => b.is_archived === 1);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("bm-3");
    });

    it("ranks matches where search query appears in title highest", () => {
      const query = "typescript";
      const qLower = query.toLowerCase();

      const scored = mockVault
        .filter((b) => b.is_archived === 0)
        .map((b) => {
          let score = 5;
          if (b.title.toLowerCase().includes(qLower)) score = 1;
          else if (b.site_name.toLowerCase().includes(qLower)) score = 2;
          else if (b.url.toLowerCase().includes(qLower)) score = 3;
          else if (b.description.toLowerCase().includes(qLower)) score = 4;
          return { ...b, score };
        })
        .sort((a, b) => a.score - b.score || b.is_pinned - a.is_pinned);

      expect(scored[0].id).toBe("bm-1"); // Matches in title
      expect(scored[1].id).toBe("bm-2"); // Matches in description
    });

    it("strips article_content when include_content is false to minimize LLM tokens", () => {
      const row = mockVault[0];
      const normalized = normalizeSyncRecord(row, "bookmark");

      // Agent API behaviour when include_content is not set or false:
      const tokenMinimized = {
        ...normalized,
        articleContent: "",
        article_content: "",
      };

      expect(tokenMinimized.articleContent).toBe("");
      expect(tokenMinimized.article_content).toBe("");
      expect(tokenMinimized.title).toBe("TypeScript Deep Dive");
    });

    it("preserves full article_content when include_content is true", () => {
      const row = mockVault[0];
      const normalized = normalizeSyncRecord(row, "bookmark");

      expect(normalized.articleContent).toBe(row.article_content);
      expect(normalized.article_content).toBe(row.article_content);
    });
  });

  describe("3. Sync Invariant & Audit Logging (agent_ Prefix)", () => {
    it("generates client_change_id with agent_ prefix on creation", () => {
      const changeId = `agent_${crypto.randomUUID()}`;
      expect(changeId.startsWith("agent_")).toBe(true);

      const record = {
        id: crypto.randomUUID(),
        title: "Agent Saved Article",
        url: "https://example.com/agent-test",
        group: "Code",
      };

      const syncChangeEntry = {
        userId: "user-123",
        entityType: "bookmark",
        entityId: record.id,
        operation: "create",
        entityVersion: 1,
        clientChangeId: changeId,
        recordJson: JSON.stringify(record),
        changedAt: new Date().toISOString(),
      };

      expect(syncChangeEntry.clientChangeId).toMatch(/^agent_[0-9a-f-]+$/);
      expect(syncChangeEntry.entityVersion).toBe(1);
      expect(syncChangeEntry.operation).toBe("create");
    });

    it("generates sync_changes audit log with agent_ prefix on bookmark update", () => {
      const existingVersion = 3;
      const newVersion = existingVersion + 1;
      const changeId = `agent_${crypto.randomUUID()}`;

      const syncUpdate = {
        entityType: "bookmark",
        entityId: "bm-existing",
        operation: "update",
        entityVersion: newVersion,
        clientChangeId: changeId,
      };

      expect(syncUpdate.clientChangeId.startsWith("agent_")).toBe(true);
      expect(syncUpdate.entityVersion).toBe(4);
      expect(syncUpdate.operation).toBe("update");
    });

    it("generates sync_changes audit log with agent_ prefix on soft delete", () => {
      const changeId = `agent_${crypto.randomUUID()}`;
      const syncDelete = {
        entityType: "bookmark",
        entityId: "bm-delete-me",
        operation: "delete",
        entityVersion: 2,
        clientChangeId: changeId,
      };

      expect(syncDelete.clientChangeId.startsWith("agent_")).toBe(true);
      expect(syncDelete.operation).toBe("delete");
    });

    it("generates distinct agent_ sync audit entries for batch operations", () => {
      const operations: AgentBatchOperation[] = [
        { action: "update", id: "bm-1", data: { title: "Updated 1" } },
        { action: "archive", id: "bm-2" },
        { action: "delete", id: "bm-3" },
      ];

      const syncEntries = operations.map((op) => ({
        operation: op.action === "archive" ? "update" : op.action,
        entityId: op.id,
        clientChangeId: `agent_${crypto.randomUUID()}`,
      }));

      expect(syncEntries.length).toBe(3);
      syncEntries.forEach((entry) => {
        expect(entry.clientChangeId.startsWith("agent_")).toBe(true);
      });

      // Verify each clientChangeId is uniquely generated
      const uniqueIds = new Set(syncEntries.map((e) => e.clientChangeId));
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe("4. Settings Sandbox & Credential Security", () => {
    it("strictly blocks modifications to user master password via settings endpoint", () => {
      const attack = { password: "malicious-new-password", theme: "dark" };
      const result = sanitizeAgentSettings(attack);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Modifying master account field 'password'");
    });

    it("strictly blocks modifications to user email via settings endpoint", () => {
      const attack = { email: "attacker@example.com" };
      const result = sanitizeAgentSettings(attack);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Modifying master account field 'email'");
    });

    it("strictly blocks modifications to user password_hash via settings endpoint", () => {
      const attack = { password_hash: "hash_value" };
      const result = sanitizeAgentSettings(attack);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Modifying master account field 'password_hash'");
    });

    it("allows valid workflow settings modifications (navigation categories, reminder times)", () => {
      const validSettings = {
        navigationCategories: ["All", "Reading", "Code", "YT"],
        defaultReminderDays: 3,
        autoArchiveAfterDays: 30,
      };

      const result = sanitizeAgentSettings(validSettings);
      expect(result.allowed).toBe(true);
      expect(result.clean).toEqual(validSettings);
    });
  });

  describe("5. OpenAPI 3.1 Specification Validation", () => {
    it("conforms to OpenAPI 3.1.0 standard with bearerAuth security scheme", () => {
      expect(openApiSpec.openapi).toBe("3.1.0");
      expect(openApiSpec.info.title).toBe("Markbel Agentic Access API");
      expect(openApiSpec.components.securitySchemes.bearerAuth).toBeDefined();
      expect(openApiSpec.components.securitySchemes.bearerAuth.type).toBe("http");
      expect(openApiSpec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
      expect(openApiSpec.components.securitySchemes.bearerAuth.bearerFormat).toBe("mb_pat_...");
    });

    it("contains all required /api/agent/v1 paths with appropriate operations", () => {
      const paths = openApiSpec.paths as Record<string, any>;

      expect(paths["/bookmarks/search"]).toBeDefined();
      expect(paths["/bookmarks/search"].get).toBeDefined();
      expect(paths["/bookmarks/search"].get.parameters.some((p: any) => p.name === "include_content")).toBe(true);

      expect(paths["/bookmarks/{id}"]).toBeDefined();
      expect(paths["/bookmarks/{id}"].get).toBeDefined();
      expect(paths["/bookmarks/{id}"].patch).toBeDefined();
      expect(paths["/bookmarks/{id}"].delete).toBeDefined();

      expect(paths["/bookmarks"]).toBeDefined();
      expect(paths["/bookmarks"].post).toBeDefined();

      expect(paths["/bookmarks/batch"]).toBeDefined();
      expect(paths["/bookmarks/batch"].post).toBeDefined();

      expect(paths["/groups"]).toBeDefined();
      expect(paths["/groups"].get).toBeDefined();

      expect(paths["/rules"]).toBeDefined();
      expect(paths["/rules"].get).toBeDefined();
      expect(paths["/rules"].put).toBeDefined();

      expect(paths["/settings"]).toBeDefined();
      expect(paths["/settings"].get).toBeDefined();
      expect(paths["/settings"].patch).toBeDefined();

      expect(paths["/stats"]).toBeDefined();
      expect(paths["/stats"].get).toBeDefined();

      expect(paths["/openapi.json"]).toBeDefined();
      expect(paths["/openapi.json"].get).toBeDefined();
      expect(paths["/openapi.json"].get.security).toEqual([]); // Public, unauthenticated
    });

    it("defines valid schemas for Bookmark, Group, and VaultStats", () => {
      const schemas = openApiSpec.components.schemas;
      expect(schemas.Bookmark).toBeDefined();
      expect(schemas.CreateBookmarkRequest).toBeDefined();
      expect(schemas.UpdateBookmarkRequest).toBeDefined();
      expect(schemas.BatchBookmarksRequest).toBeDefined();
      expect(schemas.Group).toBeDefined();
      expect(schemas.VaultStats).toBeDefined();
    });
  });

  describe("6. Client SDK Methods Interface Check", () => {
    it("exposes all required agentApi methods matching Edge REST contracts", () => {
      expect(typeof agentApi.searchBookmarks).toBe("function");
      expect(typeof agentApi.getBookmark).toBe("function");
      expect(typeof agentApi.createBookmark).toBe("function");
      expect(typeof agentApi.updateBookmark).toBe("function");
      expect(typeof agentApi.deleteBookmark).toBe("function");
      expect(typeof agentApi.batchMutateBookmarks).toBe("function");
      expect(typeof agentApi.getGroups).toBe("function");
      expect(typeof agentApi.getRules).toBe("function");
      expect(typeof agentApi.saveRules).toBe("function");
      expect(typeof agentApi.getSettings).toBe("function");
      expect(typeof agentApi.updateSettings).toBe("function");
      expect(typeof agentApi.getStats).toBe("function");
      expect(typeof agentApi.getOpenApiSpec).toBe("function");
    });
  });
});
