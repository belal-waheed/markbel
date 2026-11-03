import React from "react";
import {
  BookOpen,
  Camera,
  Code,
  FileText,
  Layers,
  MessageSquare,
  Share2,
  Sparkles,
  Video,
} from "lucide-react";
import { ConstraintOperator } from "../../lib/smartGroups.js";

export const COLOR_OPTIONS = [
  { name: "blue", label: "Blue", bg: "bg-blue-500" },
  { name: "emerald", label: "Emerald", bg: "bg-emerald-500" },
  { name: "amber", label: "Amber", bg: "bg-amber-500" },
  { name: "red", label: "Red", bg: "bg-red-500" },
  { name: "purple", label: "Purple", bg: "bg-purple-500" },
  { name: "pink", label: "Pink", bg: "bg-pink-500" },
  { name: "orange", label: "Orange", bg: "bg-orange-500" },
  { name: "slate", label: "Slate", bg: "bg-slate-500" },
];

export const COLOR_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  red: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  green: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30" },
  pink: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400", border: "border-pink-500/30" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
  slate: { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", border: "border-slate-500/30" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/30" },
};

export function getGroupBadgeClass(colorName?: string): string {
  const c = (colorName || "blue").toLowerCase();
  const style = COLOR_STYLES[c] || COLOR_STYLES.blue;
  return `${style.bg} ${style.text} ${style.border}`;
}

export const OPERATOR_CONFIG: Record<
  ConstraintOperator,
  { label: string; placeholder: string; prefix: string }
> = {
  domain_equals: {
    label: "Domain equals",
    placeholder: "e.g. youtube.com or github.com",
    prefix: "Domain =",
  },
  domain_contains: {
    label: "Domain contains",
    placeholder: "e.g. substack or notion",
    prefix: "Domain contains",
  },
  url_contains: {
    label: "URL contains",
    placeholder: "e.g. list= or /playlist or .pdf",
    prefix: "URL contains",
  },
  path_starts_with: {
    label: "Path starts with",
    placeholder: "e.g. /watch or /pull/ or /r/",
    prefix: "Path starts with",
  },
  query_param_exists: {
    label: "Query parameter",
    placeholder: "e.g. list or v=123",
    prefix: "Query param",
  },
};

export const OPERATOR_OPTIONS = (Object.keys(OPERATOR_CONFIG) as ConstraintOperator[]).map((key) => ({
  value: key,
  label: OPERATOR_CONFIG[key].label,
}));

export function getPresetIcon(presetId: string): React.ReactElement {
  switch (presetId) {
    case "preset-yt-playlists":
      return <Layers className="w-4 h-4 text-amber-500" />;
    case "preset-yt-videos":
      return <Video className="w-4 h-4 text-red-500" />;
    case "preset-github-repos":
      return <Code className="w-4 h-4 text-emerald-500" />;
    case "preset-reddit":
      return <MessageSquare className="w-4 h-4 text-orange-500" />;
    case "preset-x-twitter":
      return <Share2 className="w-4 h-4 text-slate-500" />;
    case "preset-newsletters":
      return <BookOpen className="w-4 h-4 text-purple-500" />;
    case "preset-academic-pdf":
      return <FileText className="w-4 h-4 text-blue-500" />;
    case "preset-instagram":
      return <Camera className="w-4 h-4 text-pink-500" />;
    default:
      return <Sparkles className="w-4 h-4 text-indigo-500" />;
  }
}

export const TOKEN_SCOPES_CONFIG = [
  {
    id: "bookmarks:read",
    name: "bookmarks:read",
    description: "Search and retrieve bookmarks and article contents.",
  },
  {
    id: "bookmarks:write",
    name: "bookmarks:write",
    description: "Create, edit, and organize bookmarks.",
  },
  {
    id: "groups:manage",
    name: "groups:manage",
    description: "Manage groups and smart categorization rules.",
  },
  {
    id: "shares:manage",
    name: "shares:manage",
    description: "Create and manage shared vaults and collaborative links.",
  },
  {
    id: "settings:manage",
    name: "settings:manage",
    description: "Read and update workflow preferences and notification schedules.",
  },
];

export interface McpClientConfig {
  id: string;
  name: string;
  configFile: string;
  pathHint: string;
  getConfig: (tok: string) => string;
}

export const MCP_CLIENTS: McpClientConfig[] = [
  {
    id: "claude",
    name: "Claude Desktop",
    configFile: "claude_desktop_config.json",
    pathHint: "Mac: ~/Library/Application Support/Claude/claude_desktop_config.json | Win: %APPDATA%\\Claude\\claude_desktop_config.json",
    getConfig: (tok: string) =>
      JSON.stringify(
        {
          mcpServers: {
            markbel: {
              command: "npx",
              args: ["-y", "@markbel/mcp"],
              env: {
                MARKBEL_API_TOKEN: tok,
                MARKBEL_BASE_URL: "https://mark.obel.workers.dev",
              },
            },
          },
        },
        null,
        2
      ),
  },
  {
    id: "cursor",
    name: "Cursor IDE",
    configFile: ".cursor/mcp.json",
    pathHint: "Workspace root: .cursor/mcp.json or Cursor Settings > Features > MCP",
    getConfig: (tok: string) =>
      JSON.stringify(
        {
          mcpServers: {
            markbel: {
              command: "npx",
              args: ["-y", "@markbel/mcp"],
              env: {
                MARKBEL_API_TOKEN: tok,
                MARKBEL_BASE_URL: "https://mark.obel.workers.dev",
              },
            },
          },
        },
        null,
        2
      ),
  },
  {
    id: "zed",
    name: "Zed Editor",
    configFile: "settings.json",
    pathHint: "~/.config/zed/settings.json or Command Palette > Zed: Open Settings",
    getConfig: (tok: string) =>
      JSON.stringify(
        {
          context_servers: {
            markbel: {
              command: {
                env: {
                  MARKBEL_API_TOKEN: tok,
                  MARKBEL_BASE_URL: "https://mark.obel.workers.dev",
                },
                path: "npx",
                args: ["-y", "@markbel/mcp"],
              },
            },
          },
        },
        null,
        2
      ),
  },
  {
    id: "antigravity",
    name: "Antigravity / Gemini CLI",
    configFile: "mcp_config.json",
    pathHint: "~/.gemini/antigravity/mcp_config.json or workspace .gemini/mcp_config.json",
    getConfig: (tok: string) =>
      JSON.stringify(
        {
          mcpServers: {
            markbel: {
              command: "npx",
              args: ["-y", "@markbel/mcp"],
              env: {
                MARKBEL_API_TOKEN: tok,
                MARKBEL_BASE_URL: "https://mark.obel.workers.dev",
              },
            },
          },
        },
        null,
        2
      ),
  },
  {
    id: "cli",
    name: "Generic CLI",
    configFile: "Terminal / Shell",
    pathHint: "Run directly in bash, zsh, or PowerShell",
    getConfig: (tok: string) => `# Stdio mode (Direct process stdio pipe)
MARKBEL_API_TOKEN="${tok}" npx -y @markbel/mcp

# SSE mode (Local HTTP background daemon on port 3000)
PORT=3000 MARKBEL_API_TOKEN="${tok}" npx -y @markbel/mcp --sse`,
  },
];
