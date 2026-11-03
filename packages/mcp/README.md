# @markbel/mcp

Official Model Context Protocol (MCP) server for **Markbel** bookmarking and knowledge vault.

Connects desktop AI environments (Claude Desktop, Cursor, Antigravity, Gemini CLI) directly to your self-hosted or cloud Markbel instance over stdio or SSE transport.

---

## 1. Capabilities & Available Tools

| Tool | Category | Description |
| :--- | :--- | :--- |
| `markbel_search` | Search & Read | Ranked full-text and attribute search across titles, URLs, descriptions, groups, tags, and reader article content. |
| `markbel_get_bookmark` | Search & Read | Retrieve complete metadata, reader text, and reading metrics for a specific bookmark by ID. |
| `markbel_create_bookmark` | Bookmarks | Create a new bookmark with automated edge metadata extraction (OpenGraph, meta tags) and smart rule group assignment. |
| `markbel_update_bookmark` | Bookmarks | Update title, description, group, read status, pin, reminders, or archive state with full audit logging. |
| `markbel_delete_bookmark` | Bookmarks | Soft-delete a bookmark and propagate tombstone changes to synchronized clients. |
| `markbel_batch_mutate` | Bookmarks | Bulk atomic bookmark updates, archiving, or deletion (up to 100 operations) inside a single transaction. |
| `markbel_list_groups` | Groups & Organization | List all bookmark groups with active item counts and custom hex colors. |
| `markbel_get_rules` | Rules & Automation | Retrieve compound smart categorization rules that route incoming URLs based on domain, path, or title keywords. |
| `markbel_set_rule` | Rules & Automation | Programmatically replace or update smart auto-categorization rules. |
| `markbel_get_settings` | Settings & Health | Retrieve user workflow preferences, category toggles, and notification settings. |
| `markbel_update_settings` | Settings & Health | Update workflow preferences and category configurations (master account credentials remain protected). |
| `markbel_get_stats` | Settings & Health | Inspect vault health metrics: total links, unread count, archived count, group count, and sync sequence. |
| `markbel_list_collaborators` | Collaboration | List all collaborators and pending invitations for the vault with roles and status. |
| `markbel_invite_collaborator` | Collaboration | Invite a peer collaborator or agent to the vault with viewer or editor permissions. |

---

## 2. Authentication & Environment Variables

The server requires a Markbel Personal Access Token (PAT) with appropriate scopes. Generate a token in Markbel via **Settings > API Access Tokens**.

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `MARKBEL_API_TOKEN` | Yes | (None) | Personal Access Token formatted as `mb_pat_<base58_32_bytes>`. |
| `MARKBEL_BASE_URL` | No | `https://mark.obel.workers.dev` | Markbel Edge API URL or self-hosted Cloudflare Workers instance. |
| `PORT` | No | `3000` | Port for SSE transport when running with `--sse`. |

---

## 3. Configuration Samples

### Claude Desktop (`claude_desktop_config.json`)

File location:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "markbel": {
      "command": "npx",
      "args": ["-y", "@markbel/mcp"],
      "env": {
        "MARKBEL_BASE_URL": "https://mark.obel.workers.dev",
        "MARKBEL_API_TOKEN": "mb_pat_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

File location: Workspace root `.cursor/mcp.json` or Global Settings.

```json
{
  "mcpServers": {
    "markbel": {
      "command": "npx",
      "args": ["-y", "@markbel/mcp"],
      "env": {
        "MARKBEL_BASE_URL": "https://mark.obel.workers.dev",
        "MARKBEL_API_TOKEN": "mb_pat_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### Antigravity / Gemini CLI (`mcp_config.json`)

File location: `%USERPROFILE%\.gemini\antigravity\mcp_config.json`

```json
{
  "mcpServers": {
    "markbel": {
      "command": "npx",
      "args": ["-y", "@markbel/mcp"],
      "env": {
        "MARKBEL_BASE_URL": "https://mark.obel.workers.dev",
        "MARKBEL_API_TOKEN": "mb_pat_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

---

## 4. Local Development & SSE Mode

To run locally against a local Cloudflare Workers dev server:

```bash
# stdio mode (default)
export MARKBEL_API_TOKEN="mb_pat_your_token_here"
export MARKBEL_BASE_URL="http://127.0.0.1:8787"
node ./dist/index.js

# SSE mode (HTTP server)
node ./dist/index.js --sse
```

When started with `--sse`, the server exposes:
- `GET /sse`: Server-Sent Events stream for incoming server events.
- `POST /message?sessionId=<id>`: Client JSON-RPC dispatch endpoint.
