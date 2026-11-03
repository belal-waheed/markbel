export interface BookmarkRecord {
  id: string;
  url: string;
  title: string;
  description?: string;
  snippet?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  author?: string;
  publishedAt?: string;
  contentType?: string;
  readingTime?: number;
  wordCount?: number;
  canonicalUrl?: string;
  articleContent?: string;
  groupName?: string;
  isRead?: boolean;
  readAt?: string;
  isPinned?: boolean;
  remindAt?: string;
  isArchived?: boolean;
  archiveGroup?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export function normalizeBookmark(raw: any): BookmarkRecord {
  if (!raw || typeof raw !== "object") {
    return raw as BookmarkRecord;
  }

  const groupName =
    raw.groupName !== undefined && raw.groupName !== null
      ? String(raw.groupName)
      : raw.group !== undefined && raw.group !== null
      ? String(raw.group)
      : raw.group_name !== undefined && raw.group_name !== null
      ? String(raw.group_name)
      : undefined;

  const isRead =
    raw.isRead !== undefined
      ? Boolean(raw.isRead)
      : raw.is_read !== undefined
      ? Boolean(Number(raw.is_read))
      : undefined;

  const isPinned =
    raw.isPinned !== undefined
      ? Boolean(raw.isPinned)
      : raw.is_pinned !== undefined
      ? Boolean(Number(raw.is_pinned))
      : undefined;

  const isArchived =
    raw.isArchived !== undefined
      ? Boolean(raw.isArchived)
      : raw.is_archived !== undefined
      ? Boolean(Number(raw.is_archived))
      : undefined;

  const siteName =
    raw.siteName !== undefined && raw.siteName !== null
      ? String(raw.siteName)
      : raw.site_name !== undefined && raw.site_name !== null
      ? String(raw.site_name)
      : undefined;

  const articleContent =
    raw.articleContent !== undefined && raw.articleContent !== null
      ? String(raw.articleContent)
      : raw.article_content !== undefined && raw.article_content !== null
      ? String(raw.article_content)
      : undefined;

  const publishedAt =
    raw.publishedAt !== undefined && raw.publishedAt !== null
      ? String(raw.publishedAt)
      : raw.published_at !== undefined && raw.published_at !== null
      ? String(raw.published_at)
      : undefined;

  const contentType =
    raw.contentType !== undefined && raw.contentType !== null
      ? String(raw.contentType)
      : raw.content_type !== undefined && raw.content_type !== null
      ? String(raw.content_type)
      : undefined;

  const readingTime =
    typeof raw.readingTime === "number"
      ? raw.readingTime
      : typeof raw.reading_time === "number"
      ? raw.reading_time
      : undefined;

  const wordCount =
    typeof raw.wordCount === "number"
      ? raw.wordCount
      : typeof raw.word_count === "number"
      ? raw.word_count
      : undefined;

  const canonicalUrl =
    raw.canonicalUrl !== undefined && raw.canonicalUrl !== null
      ? String(raw.canonicalUrl)
      : raw.canonical_url !== undefined && raw.canonical_url !== null
      ? String(raw.canonical_url)
      : undefined;

  const readAt =
    raw.readAt !== undefined && raw.readAt !== null
      ? String(raw.readAt)
      : raw.read_at !== undefined && raw.read_at !== null
      ? String(raw.read_at)
      : undefined;

  const remindAt =
    raw.remindAt !== undefined && raw.remindAt !== null
      ? String(raw.remindAt)
      : raw.remind_at !== undefined && raw.remind_at !== null
      ? String(raw.remind_at)
      : undefined;

  const archiveGroup =
    raw.archiveGroup !== undefined && raw.archiveGroup !== null
      ? String(raw.archiveGroup)
      : raw.archive_group !== undefined && raw.archive_group !== null
      ? String(raw.archive_group)
      : undefined;

  const createdAt =
    raw.createdAt !== undefined && raw.createdAt !== null
      ? String(raw.createdAt)
      : raw.created_at !== undefined && raw.created_at !== null
      ? String(raw.created_at)
      : undefined;

  const updatedAt =
    raw.updatedAt !== undefined && raw.updatedAt !== null
      ? String(raw.updatedAt)
      : raw.updated_at !== undefined && raw.updated_at !== null
      ? String(raw.updated_at)
      : undefined;

  const deletedAt =
    raw.deletedAt !== undefined
      ? (raw.deletedAt as string | null)
      : raw.deleted_at !== undefined
      ? (raw.deleted_at as string | null)
      : undefined;

  return {
    id: String(raw.id ?? ""),
    url: String(raw.url ?? ""),
    title: String(raw.title ?? ""),
    description: raw.description !== undefined && raw.description !== null ? String(raw.description) : undefined,
    snippet: raw.snippet !== undefined && raw.snippet !== null ? String(raw.snippet) : undefined,
    image: raw.image !== undefined && raw.image !== null ? String(raw.image) : undefined,
    favicon: raw.favicon !== undefined && raw.favicon !== null ? String(raw.favicon) : undefined,
    siteName,
    author: raw.author !== undefined && raw.author !== null ? String(raw.author) : undefined,
    publishedAt,
    contentType,
    readingTime,
    wordCount,
    canonicalUrl,
    articleContent,
    groupName,
    isRead,
    readAt,
    isPinned,
    remindAt,
    isArchived,
    archiveGroup,
    version: typeof raw.version === "number" ? raw.version : undefined,
    createdAt,
    updatedAt,
    deletedAt,
  };
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to connect to Markbel API at ${this.baseUrl}: ${msg}`);
    }

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status} ${res.statusText}`;
      try {
        const errorBody = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (errorBody && typeof errorBody === "object") {
          const errText = typeof errorBody.error === "string" ? errorBody.error : typeof errorBody.message === "string" ? errorBody.message : "";
          if (errText) errorMessage = errText;
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
    const result = await this.request<any>(endpoint, { method: "GET" });
    return {
      items: Array.isArray(result?.items) ? result.items.map(normalizeBookmark) : [],
      total: typeof result?.total === "number" ? result.total : 0,
      limit: typeof result?.limit === "number" ? result.limit : (params.limit ?? 20),
      offset: typeof result?.offset === "number" ? result.offset : (params.offset ?? 0),
    };
  }

  async getBookmark(id: string): Promise<BookmarkRecord> {
    if (!id || typeof id !== "string") {
      throw new Error("Bookmark id is required");
    }
    const res = await this.request<any>(`/api/agent/v1/bookmarks/${encodeURIComponent(id)}`, {
      method: "GET",
    });
    return normalizeBookmark(res);
  }

  async createBookmark(data: CreateBookmarkInput): Promise<BookmarkRecord> {
    if (!data || !data.url) {
      throw new Error("URL is required to create a bookmark");
    }
    const res = await this.request<any>("/api/agent/v1/bookmarks", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return normalizeBookmark(res);
  }

  async updateBookmark(id: string, data: UpdateBookmarkInput): Promise<BookmarkRecord> {
    if (!id || typeof id !== "string") {
      throw new Error("Bookmark id is required");
    }
    const res = await this.request<any>(`/api/agent/v1/bookmarks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return normalizeBookmark(res);
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
