export interface BookmarkRecord {
  id: string;
  url: string;
  title: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  site_name?: string;
  author?: string;
  publishedAt?: string;
  contentType?: string;
  readingTime?: number;
  wordCount?: number;
  canonicalUrl?: string;
  articleContent?: string;
  article_content?: string;
  group?: string;
  groupName?: string;
  group_name?: string;
  isRead?: boolean;
  is_read?: number | boolean;
  readAt?: string;
  isPinned?: boolean;
  is_pinned?: number | boolean;
  remindAt?: string;
  remind_at?: string;
  isArchived?: boolean;
  is_archived?: number | boolean;
  archiveGroup?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface SearchBookmarksParams {
  q?: string;
  group?: string;
  is_read?: boolean;
  is_archived?: boolean | "all";
  is_pinned?: boolean;
  include_content?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  items: BookmarkRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateBookmarkInput {
  url: string;
  title?: string;
  description?: string;
  group?: string;
  isPinned?: boolean;
  remindAt?: string;
}

export interface UpdateBookmarkInput {
  title?: string;
  description?: string;
  group?: string;
  isRead?: boolean;
  isPinned?: boolean;
  remindAt?: string;
  isArchived?: boolean;
}

export interface BatchOperation {
  action: "update" | "archive" | "delete";
  id: string;
  data?: Partial<UpdateBookmarkInput>;
}

export interface GroupItem {
  id: string;
  name: string;
  color: string;
  bookmarkCount: number;
}

export interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

export interface RuleItem {
  id?: string;
  group: string;
  conditions: RuleCondition[];
  matchType?: "all" | "any";
}

export interface VaultStats {
  totalBookmarks: number;
  unreadCount: number;
  archivedCount: number;
  groupsCount: number;
  latestSyncSequence: number;
}

export interface CollaboratorRecord {
  id: string;
  owner_id: string;
  collaborator_user_id: string | null;
  collaborator_email: string;
  role: "viewer" | "editor";
  status: "pending" | "accepted";
  invite_token: string;
  invite_link?: string;
  created_at: string;
  accepted_at?: string | null;
}

export interface InviteCollaboratorInput {
  email: string;
  role?: "viewer" | "editor";
}

export interface MarkbelClientOptions {
  baseUrl?: string;
  token: string;
  fetchFn?: typeof fetch;
}

export class MarkbelClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: MarkbelClientOptions) {
    if (!options.token || typeof options.token !== "string" || !options.token.trim()) {
      throw new Error("Markbel API token is required (format: mb_pat_...)");
    }
    this.baseUrl = (options.baseUrl || "https://mark.obel.workers.dev").replace(/\/+$/, "");
    this.token = options.token.trim();
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    let res: Response;
    try {
      res = await this.fetchFn(url, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new Error(`Failed to connect to Markbel API at ${this.baseUrl}: ${err?.message || err}`);
    }

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status} ${res.statusText}`;
      try {
        const errorBody: any = await res.json();
        if (errorBody && typeof errorBody === "object" && (errorBody.error || errorBody.message)) {
          errorMessage = errorBody.error || errorBody.message;
        }
      } catch {
        const text = await res.text().catch(() => "");
        if (text) errorMessage = text;
      }
      throw new Error(errorMessage);
    }

    return (await res.json()) as T;
  }

  async searchBookmarks(params: SearchBookmarksParams = {}): Promise<SearchResult> {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set("q", params.q);
    if (params.group) searchParams.set("group", params.group);
    if (params.is_read !== undefined) searchParams.set("is_read", String(params.is_read));
    if (params.is_archived !== undefined) searchParams.set("is_archived", String(params.is_archived));
    if (params.is_pinned !== undefined) searchParams.set("is_pinned", String(params.is_pinned));
    if (params.include_content) searchParams.set("include_content", "true");
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.offset !== undefined) searchParams.set("offset", String(params.offset));

    const qs = searchParams.toString();
    const endpoint = `/api/agent/v1/bookmarks/search${qs ? `?${qs}` : ""}`;
    return this.request<SearchResult>(endpoint, { method: "GET" });
  }

  async getBookmark(id: string): Promise<BookmarkRecord> {
    if (!id || typeof id !== "string") {
      throw new Error("Bookmark id is required");
    }
    return this.request<BookmarkRecord>(`/api/agent/v1/bookmarks/${encodeURIComponent(id)}`, {
      method: "GET",
    });
  }

  async createBookmark(data: CreateBookmarkInput): Promise<BookmarkRecord> {
    if (!data || !data.url) {
      throw new Error("URL is required to create a bookmark");
    }
    return this.request<BookmarkRecord>("/api/agent/v1/bookmarks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBookmark(id: string, data: UpdateBookmarkInput): Promise<BookmarkRecord> {
    if (!id || typeof id !== "string") {
      throw new Error("Bookmark id is required");
    }
    return this.request<BookmarkRecord>(`/api/agent/v1/bookmarks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteBookmark(id: string): Promise<{ success: boolean; id: string }> {
    if (!id || typeof id !== "string") {
      throw new Error("Bookmark id is required");
    }
    return this.request<{ success: boolean; id: string }>(`/api/agent/v1/bookmarks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async batchMutate(operations: BatchOperation[]): Promise<{ success: boolean; processed: number }> {
    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      throw new Error("Operations array must not be empty");
    }
    return this.request<{ success: boolean; processed: number }>("/api/agent/v1/bookmarks/batch", {
      method: "POST",
      body: JSON.stringify({ operations }),
    });
  }

  async listGroups(): Promise<{ groups: GroupItem[] }> {
    return this.request<{ groups: GroupItem[] }>("/api/agent/v1/groups", {
      method: "GET",
    });
  }

  async getRules(): Promise<{ rules: RuleItem[] }> {
    return this.request<{ rules: RuleItem[] }>("/api/agent/v1/rules", {
      method: "GET",
    });
  }

  async setRule(rules: RuleItem[]): Promise<{ success: boolean; rules: RuleItem[] }> {
    if (!Array.isArray(rules)) {
      throw new Error("Rules must be an array");
    }
    return this.request<{ success: boolean; rules: RuleItem[] }>("/api/agent/v1/rules", {
      method: "PUT",
      body: JSON.stringify({ rules }),
    });
  }

  async getSettings(): Promise<{ settings: Record<string, any> }> {
    return this.request<{ settings: Record<string, any> }>("/api/agent/v1/settings", {
      method: "GET",
    });
  }

  async updateSettings(settings: Record<string, any>): Promise<{ success: boolean; settings: Record<string, any> }> {
    if (!settings || typeof settings !== "object") {
      throw new Error("Settings payload must be an object");
    }
    return this.request<{ success: boolean; settings: Record<string, any> }>("/api/agent/v1/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }

  async getStats(): Promise<VaultStats> {
    return this.request<VaultStats>("/api/agent/v1/stats", {
      method: "GET",
    });
  }

  async listCollaborators(): Promise<{ collaborators: CollaboratorRecord[] }> {
    return this.request<{ collaborators: CollaboratorRecord[] }>("/api/agent/v1/collaborators", {
      method: "GET",
    });
  }

  async inviteCollaborator(input: InviteCollaboratorInput): Promise<CollaboratorRecord> {
    if (!input || !input.email) {
      throw new Error("Collaborator email is required");
    }
    return this.request<CollaboratorRecord>("/api/agent/v1/collaborators", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
