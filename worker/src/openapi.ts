export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Markbel Agentic Access API",
    version: "1.0.0",
    description: "Official Edge REST API for Markbel AI coding assistants and autonomous agents. Provides full sync integrity, scoped permissions, and token-efficient content controls.",
  },
  servers: [
    {
      url: "/api/agent/v1",
      description: "Markbel Edge API Sub-App",
    },
  ],
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    "/bookmarks/search": {
      get: {
        summary: "Search and filter bookmarks",
        description: "Searches bookmarks with multi-attribute ranking across title, URL, domain, description, and article content.",
        operationId: "searchBookmarks",
        parameters: [
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Search term matching title, domain, URL, description, or article content.",
          },
          {
            name: "group",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filter by group name.",
          },
          {
            name: "is_read",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["true", "false"] },
            description: "Filter by read status ('true' or 'false').",
          },
          {
            name: "is_archived",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["true", "false"], default: "false" },
            description: "Filter by archived status (defaults to 'false').",
          },
          {
            name: "is_pinned",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["true", "false"] },
            description: "Filter by pinned status ('true' or 'false').",
          },
          {
            name: "include_content",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["true", "false"], default: "false" },
            description: "When false, article_content is omitted or truncated to keep agent tokens minimal.",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
            description: "Maximum number of items to return (1-100).",
          },
          {
            name: "offset",
            in: "query",
            required: false,
            schema: { type: "integer", default: 0, minimum: 0 },
            description: "Pagination offset index.",
          },
        ],
        responses: {
          "200": {
            description: "Matching bookmarks and pagination metadata",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Bookmark" },
                    },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                  },
                  required: ["items", "total", "limit", "offset"],
                },
              },
            },
          },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'bookmarks:read' scope" },
        },
      },
    },
    "/bookmarks/{id}": {
      get: {
        summary: "Get bookmark by ID",
        description: "Retrieves complete bookmark object including full article_content.",
        operationId: "getBookmark",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Bookmark UUID",
          },
        ],
        responses: {
          "200": {
            description: "Complete bookmark object",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Bookmark" },
              },
            },
          },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'bookmarks:read' scope" },
          "404": { description: "Bookmark not found" },
        },
      },
      patch: {
        summary: "Update bookmark",
        description: "Updates bookmark metadata, reading status, group, or flags, creating a sync_changes entry.",
        operationId: "updateBookmark",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Bookmark UUID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateBookmarkRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated bookmark object",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Bookmark" },
              },
            },
          },
          "400": { description: "Invalid request payload" },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'bookmarks:write' scope" },
          "404": { description: "Bookmark not found" },
        },
      },
      delete: {
        summary: "Soft delete bookmark",
        description: "Marks bookmark as deleted and appends a delete entry to sync_changes.",
        operationId: "deleteBookmark",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Bookmark UUID",
          },
        ],
        responses: {
          "200": {
            description: "Bookmark successfully deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    id: { type: "string" },
                  },
                  required: ["success", "id"],
                },
              },
            },
          },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'bookmarks:write' scope" },
          "404": { description: "Bookmark not found" },
        },
      },
    },
    "/bookmarks": {
      post: {
        summary: "Create a new bookmark",
        description: "Creates a bookmark with automatic media heuristics and smart grouping, generating a sync_changes record.",
        operationId: "createBookmark",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateBookmarkRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Bookmark successfully created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Bookmark" },
              },
            },
          },
          "400": { description: "Invalid URL or missing required fields" },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'bookmarks:write' scope" },
        },
      },
    },
    "/bookmarks/batch": {
      post: {
        summary: "Atomic batch bookmark operations",
        description: "Executes batch updates, archives, or deletes in a single D1 transaction with sync_changes audit records.",
        operationId: "batchBookmarks",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BatchBookmarksRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Batch operations successfully executed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    processed: { type: "integer" },
                  },
                  required: ["success", "processed"],
                },
              },
            },
          },
          "400": { description: "Invalid operations payload" },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'bookmarks:write' scope" },
        },
      },
    },
    "/groups": {
      get: {
        summary: "List groups",
        description: "Returns all active groups with bookmark counts and color tokens.",
        operationId: "getGroups",
        responses: {
          "200": {
            description: "List of groups",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    groups: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Group" },
                    },
                  },
                  required: ["groups"],
                },
              },
            },
          },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'bookmarks:read' scope" },
        },
      },
    },
    "/rules": {
      get: {
        summary: "Get smart auto-categorization rules",
        description: "Retrieves user compound rules for smart grouping.",
        operationId: "getRules",
        responses: {
          "200": {
            description: "User smart grouping rules",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    rules: {
                      type: "array",
                      items: { type: "object" },
                    },
                  },
                  required: ["rules"],
                },
              },
            },
          },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'groups:manage' scope" },
        },
      },
      put: {
        summary: "Save smart auto-categorization rules",
        description: "Updates user compound rules for smart grouping.",
        operationId: "saveRules",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  rules: {
                    type: "array",
                    items: { type: "object" },
                  },
                },
                required: ["rules"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Rules successfully updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    rules: { type: "array", items: { type: "object" } },
                  },
                  required: ["success", "rules"],
                },
              },
            },
          },
          "400": { description: "Invalid rules payload" },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'groups:manage' scope" },
        },
      },
    },
    "/settings": {
      get: {
        summary: "Get workflow settings",
        description: "Retrieves user workflow preferences and categorization configurations.",
        operationId: "getSettings",
        responses: {
          "200": {
            description: "User workflow preferences",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    settings: { type: "object" },
                  },
                  required: ["settings"],
                },
              },
            },
          },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'settings:manage' scope" },
        },
      },
      patch: {
        summary: "Update workflow preferences",
        description: "Updates workflow preferences. Master account credentials and email modifications are strictly prohibited.",
        operationId: "updateSettings",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
        responses: {
          "200": {
            description: "Settings successfully updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    settings: { type: "object" },
                  },
                  required: ["success", "settings"],
                },
              },
            },
          },
          "400": { description: "Invalid settings or prohibited credential modification" },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'settings:manage' scope" },
        },
      },
    },
    "/stats": {
      get: {
        summary: "Get vault metrics and stats",
        description: "Returns summary counts for bookmarks, unread items, archived items, groups, and sync sequence.",
        operationId: "getStats",
        responses: {
          "200": {
            description: "Vault summary statistics",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VaultStats" },
              },
            },
          },
          "401": { description: "Missing or invalid authorization token" },
          "403": { description: "Forbidden: requires 'bookmarks:read' scope" },
        },
      },
    },
    "/openapi.json": {
      get: {
        summary: "Get OpenAPI 3.1 specification",
        description: "Returns the OpenAPI 3.1 schema for Markbel Agentic API. Public endpoint, no authentication required.",
        operationId: "getOpenApiSpec",
        security: [],
        responses: {
          "200": {
            description: "OpenAPI 3.1 specification document",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "mb_pat_...",
        description: "Markbel Personal Access Token (mb_pat_...) or standard user JWT session token",
      },
    },
    schemas: {
      Bookmark: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          description: { type: "string" },
          image: { type: "string" },
          favicon: { type: "string" },
          siteName: { type: "string" },
          contentType: { type: "string" },
          readingTime: { type: "integer" },
          wordCount: { type: "integer" },
          group: { type: "string" },
          isRead: { type: "boolean" },
          readAt: { type: "string" },
          isPinned: { type: "boolean" },
          remindAt: { type: "string" },
          isArchived: { type: "boolean" },
          archiveGroup: { type: "string" },
          articleContent: { type: "string" },
          version: { type: "integer" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
          deletedAt: { type: ["string", "null"] },
        },
        required: ["id", "title", "url", "group", "version", "createdAt", "updatedAt"],
      },
      CreateBookmarkRequest: {
        type: "object",
        properties: {
          url: { type: "string", description: "Target bookmark URL" },
          title: { type: "string", description: "Optional title. If omitted, resolved automatically." },
          description: { type: "string", description: "Optional summary description" },
          group: { type: "string", description: "Optional group name. If omitted, resolved via smart grouping rules." },
          isPinned: { type: "boolean", description: "Whether bookmark is pinned" },
          remindAt: { type: "string", description: "Optional ISO reminder date" },
        },
        required: ["url"],
      },
      UpdateBookmarkRequest: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          group: { type: "string" },
          isRead: { type: "boolean" },
          isPinned: { type: "boolean" },
          remindAt: { type: "string" },
          isArchived: { type: "boolean" },
        },
      },
      BatchBookmarksRequest: {
        type: "object",
        properties: {
          operations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string", enum: ["update", "archive", "delete"] },
                id: { type: "string" },
                data: { type: "object" },
              },
              required: ["action", "id"],
            },
          },
        },
        required: ["operations"],
      },
      Group: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          color: { type: "string" },
          bookmarkCount: { type: "integer" },
        },
        required: ["id", "name", "color", "bookmarkCount"],
      },
      VaultStats: {
        type: "object",
        properties: {
          totalBookmarks: { type: "integer" },
          unreadCount: { type: "integer" },
          archivedCount: { type: "integer" },
          groupsCount: { type: "integer" },
          latestSyncSequence: { type: "integer" },
        },
        required: ["totalBookmarks", "unreadCount", "archivedCount", "groupsCount", "latestSyncSequence"],
      },
    },
  },
};
