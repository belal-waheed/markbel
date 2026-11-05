import { describe, it, expect, beforeEach } from "vitest";
import {
  MCP_CLIENTS,
  TOKEN_SCOPES_CONFIG,
  OPERATOR_CONFIG,
  OPERATOR_OPTIONS,
  COLOR_OPTIONS,
  COLOR_STYLES,
  getGroupBadgeClass,
  getPresetIcon,
} from "./settingsConstants.js";

describe("Settings Feature Cards & Constants Suite", () => {

  describe("1. MCP Studio Client Configurations", () => {
    const testToken = "mb_pat_secret_abc123";

    it("defines all 5 required AI agent client presets", () => {
      const clientIds = MCP_CLIENTS.map((c) => c.id);
      expect(clientIds).toContain("claude");
      expect(clientIds).toContain("cursor");
      expect(clientIds).toContain("zed");
      expect(clientIds).toContain("antigravity");
      expect(clientIds).toContain("cli");
    });

    it("interpolates tokens accurately for Claude Desktop config", () => {
      const claude = MCP_CLIENTS.find((c) => c.id === "claude");
      expect(claude).toBeDefined();
      const config = JSON.parse(claude!.getConfig(testToken));
      expect(config.mcpServers.markbel.env.MARKBEL_API_TOKEN).toBe(testToken);
      expect(config.mcpServers.markbel.command).toBe("npx");
      expect(config.mcpServers.markbel.args).toEqual(["-y", "@markbel/mcp"]);
    });

    it("interpolates tokens accurately for Cursor IDE config", () => {
      const cursor = MCP_CLIENTS.find((c) => c.id === "cursor");
      expect(cursor).toBeDefined();
      const config = JSON.parse(cursor!.getConfig(testToken));
      expect(config.mcpServers.markbel.env.MARKBEL_API_TOKEN).toBe(testToken);
    });

    it("interpolates tokens accurately for Zed Editor config", () => {
      const zed = MCP_CLIENTS.find((c) => c.id === "zed");
      expect(zed).toBeDefined();
      const config = JSON.parse(zed!.getConfig(testToken));
      expect(config.context_servers.markbel.command.env.MARKBEL_API_TOKEN).toBe(testToken);
      expect(config.context_servers.markbel.command.path).toBe("npx");
    });

    it("interpolates tokens accurately for Antigravity / Gemini CLI config", () => {
      const antigravity = MCP_CLIENTS.find((c) => c.id === "antigravity");
      expect(antigravity).toBeDefined();
      const config = JSON.parse(antigravity!.getConfig(testToken));
      expect(config.mcpServers.markbel.env.MARKBEL_API_TOKEN).toBe(testToken);
    });

    it("interpolates tokens accurately for Generic CLI snippets", () => {
      const cli = MCP_CLIENTS.find((c) => c.id === "cli");
      expect(cli).toBeDefined();
      const snippet = cli!.getConfig(testToken);
      expect(snippet).toContain(`MARKBEL_API_TOKEN="${testToken}"`);
      expect(snippet).toContain("--sse");
    });
  });

  describe("2. Settings Constants & Scopes", () => {
    it("defines the 5 core PAT scopes required for agent isolation", () => {
      const scopeIds = TOKEN_SCOPES_CONFIG.map((s) => s.id);
      expect(scopeIds).toEqual([
        "bookmarks:read",
        "bookmarks:write",
        "groups:manage",
        "shares:manage",
        "settings:manage",
      ]);
    });

    it("defines valid operators for smart group constraint evaluation", () => {
      expect(OPERATOR_CONFIG.domain_equals).toBeDefined();
      expect(OPERATOR_CONFIG.domain_contains).toBeDefined();
      expect(OPERATOR_CONFIG.url_contains).toBeDefined();
      expect(OPERATOR_CONFIG.path_starts_with).toBeDefined();
      expect(OPERATOR_CONFIG.query_param_exists).toBeDefined();
      expect(OPERATOR_CONFIG.title_contains).toBeDefined();
      expect(OPERATOR_CONFIG.content_type_equals).toBeDefined();
      expect(OPERATOR_OPTIONS.length).toBe(7);
    });

    it("maps group badge classes and colors accurately with graceful fallback", () => {
      const emeraldBadge = getGroupBadgeClass("emerald");
      expect(emeraldBadge).toContain("bg-emerald-500/10");
      expect(emeraldBadge).toContain("text-emerald-600");

      const blueBadge = getGroupBadgeClass("blue");
      expect(blueBadge).toContain("bg-blue-500/10");

      const fallbackBadge = getGroupBadgeClass("unknown_palette");
      expect(fallbackBadge).toBe(getGroupBadgeClass("blue"));
    });

    it("returns valid React elements for all preset icons", () => {
      const icon = getPresetIcon("preset-yt-playlists");
      expect(icon).toBeDefined();
      expect(typeof icon).toBe("object");

      const defaultIcon = getPresetIcon("unknown-preset");
      expect(defaultIcon).toBeDefined();
    });
  });
});
