# Cloudflare MCP Integration Guide: Managing Markbel on Cloudflare

This guide explains how to connect and use the [Cloudflare MCP Server (`@cloudflare/mcp`)](https://github.com/cloudflare/mcp) with Antigravity / Claude Code to manage your Cloudflare infrastructure, deploy D1 migrations, and manage Workers & Pages directly.

---

## 1. Prerequisites

1. **Cloudflare Account ID**: Found on your Cloudflare Dashboard (Overview right sidebar).
2. **Cloudflare API Token**: Create an API Token with permissions:
   - `Workers Scripts: Edit`
   - `D1: Edit`
   - `Pages: Edit`
   - `KV: Edit`
   - `Account: Read`

---

## 2. Registering Cloudflare MCP in Antigravity / Cursor

Add the Cloudflare MCP configuration to your MCP settings file (`~/.gemini/antigravity/mcp/cloudflare` or your local MCP settings):

```json
{
  "mcpServers": {
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "<YOUR_CLOUDFLARE_API_TOKEN>",
        "CLOUDFLARE_ACCOUNT_ID": "<YOUR_CLOUDFLARE_ACCOUNT_ID>"
      }
    }
  }
}
```

---

## 3. Deploying Markbel with Wrangler CLI & MCP

### Step 1: Create the Cloudflare D1 Database
```bash
npx wrangler d1 create markbel-db
```
*Copy the `database_id` returned and paste it into `wrangler.toml` under `[[d1_databases]]`.*

### Step 2: Apply the SQLite Schema
```bash
# Local development simulation:
npm run d1:migrate:local

# Production Cloudflare deployment:
npm run d1:migrate:remote
```

### Step 3: Deploy the Worker Backend
```bash
npm run worker:deploy
```
*Your global edge API will now be live at `https://markbel-api.<your-subdomain>.workers.dev`.*

### Step 4: Deploy the Frontend to Cloudflare Pages
```bash
npm run build
npm run pages:deploy
```

---

## 4. MCP Tools Available

Once configured, Antigravity can execute these operations for you via MCP:
- `d1_query`: Execute queries or check status on `markbel-db`.
- `workers_deploy`: Trigger updates to the Hono edge worker.
- `pages_deploy`: Upload Vite production artifacts to Cloudflare Pages.
- `kv_get` / `kv_put`: Inspect session caches or cached tokens.
