export interface NormalizedBookmarkRecord {
  id: string;
  user_id: string;
  userId?: string;
  title: string;
  url: string;
  description: string;
  image: string;
  favicon: string;
  siteName: string;
  site_name: string;
  author: string;
  publishedAt: string;
  published_at: string;
  contentType: string;
  content_type: string;
  readingTime: number;
  reading_time: number;
  wordCount: number;
  word_count: number;
  canonicalUrl: string;
  canonical_url: string;
  articleContent: string;
  article_content: string;
  group: string;
  group_name: string;
  isRead: boolean;
  is_read: number;
  readAt: string;
  read_at: string;
  isPinned: boolean;
  is_pinned: number;
  remindAt: string;
  remind_at: string;
  isArchived: boolean;
  is_archived: number;
  archiveGroup: string;
  archive_group: string;
  isBroken?: boolean;
  is_broken?: number;
  httpStatus?: number | null;
  http_status?: number | null;
  lastCheckedAt?: string | null;
  last_checked_at?: string | null;
  actorType: string;
  actor_type: string;
  actorName: string;
  actor_name: string;
  version: number;
  createdAt: string;
  created_at: string;
  updatedAt: string;
  updated_at: string;
  deletedAt: string | null;
  deleted_at: string | null;
  snippet?: string;
  [key: string]: unknown;
}

export interface NormalizedGroupRecord {
  id: string;
  user_id: string;
  userId: string;
  name: string;
  color: string;
  version: number;
  createdAt: string;
  created_at: string;
  updatedAt: string;
  updated_at: string;
  deletedAt: string | null;
  deleted_at: string | null;
  snippet?: string;
  [key: string]: unknown;
}

export function normalizeSyncRecord(record: Record<string, unknown>, entityType: "bookmark"): NormalizedBookmarkRecord;
export function normalizeSyncRecord(record: Record<string, unknown>, entityType: "group"): NormalizedGroupRecord;
export function normalizeSyncRecord(record: Record<string, unknown>, entityType: string): Record<string, unknown>;
export function normalizeSyncRecord(record: unknown, entityType: string): unknown {
  if (!record || typeof record !== "object") return record;
  const raw = record as Record<string, unknown>;

  if (entityType === "bookmark") {
    const isRead =
      raw.isRead !== undefined
        ? Boolean(raw.isRead)
        : raw.is_read !== undefined
        ? Boolean(raw.is_read)
        : false;

    const isPinned =
      raw.isPinned !== undefined
        ? Boolean(raw.isPinned)
        : raw.is_pinned !== undefined
        ? Boolean(raw.is_pinned)
        : false;

    const isArchived =
      raw.isArchived !== undefined
        ? Boolean(raw.isArchived)
        : raw.is_archived !== undefined
        ? Boolean(raw.is_archived)
        : false;

    const isBroken =
      raw.isBroken !== undefined
        ? Boolean(raw.isBroken)
        : raw.is_broken !== undefined
        ? Boolean(raw.is_broken)
        : false;

    const httpStatus =
      raw.httpStatus !== undefined
        ? (raw.httpStatus as number | null)
        : raw.http_status !== undefined
        ? (raw.http_status as number | null)
        : null;

    const lastCheckedAt = raw.lastCheckedAt
      ? String(raw.lastCheckedAt)
      : raw.last_checked_at
      ? String(raw.last_checked_at)
      : null;

    const title = String(raw.title || "");
    const url = String(raw.url || "");
    const description = String(raw.description || "");
    const image = String(raw.image || "");
    const favicon = String(raw.favicon || "");
    const siteName = String(raw.siteName || raw.site_name || "");
    const author = String(raw.author || "");
    const publishedAt = String(raw.publishedAt || raw.published_at || "");
    const contentType = String(raw.contentType || raw.content_type || "website");
    const readingTime = Number(raw.readingTime ?? raw.reading_time ?? 0);
    const wordCount = Number(raw.wordCount ?? raw.word_count ?? 0);
    const canonicalUrl = String(raw.canonicalUrl || raw.canonical_url || "");
    const articleContent = String(raw.articleContent || raw.article_content || "");
    const group = String(raw.group || raw.group_name || "Unsorted");
    const readAt = String(raw.readAt || raw.read_at || "");
    const remindAt = String(raw.remindAt || raw.remind_at || "");
    const archiveGroup = String(raw.archiveGroup || raw.archive_group || "");
    const actorType = String(raw.actorType || raw.actor_type || "user");
    const actorName = String(raw.actorName || raw.actor_name || "");
    const createdAt = String(raw.createdAt || raw.created_at || "");
    const updatedAt = String(raw.updatedAt || raw.updated_at || "");
    const deletedAt = raw.deletedAt ? String(raw.deletedAt) : raw.deleted_at ? String(raw.deleted_at) : null;
    const version = Number(raw.version || 0);

    return {
      ...raw,
      // camelCase fields
      title,
      url,
      description,
      image,
      favicon,
      siteName,
      author,
      publishedAt,
      contentType,
      readingTime,
      wordCount,
      canonicalUrl,
      articleContent,
      group,
      isRead,
      readAt,
      isPinned,
      remindAt,
      isArchived,
      archiveGroup,
      isBroken,
      httpStatus,
      lastCheckedAt,
      actorType,
      actorName,
      version,
      createdAt,
      updatedAt,
      deletedAt,
      // snake_case mirrors for D1 compatibility
      site_name: siteName,
      published_at: publishedAt,
      content_type: contentType,
      reading_time: readingTime,
      word_count: wordCount,
      canonical_url: canonicalUrl,
      article_content: articleContent,
      group_name: group,
      is_read: isRead ? 1 : 0,
      read_at: readAt,
      is_pinned: isPinned ? 1 : 0,
      remind_at: remindAt,
      is_archived: isArchived ? 1 : 0,
      archive_group: archiveGroup,
      is_broken: isBroken ? 1 : 0,
      http_status: httpStatus,
      last_checked_at: lastCheckedAt,
      actor_type: actorType,
      actor_name: actorName,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: deletedAt,
    };
  }

  if (entityType === "group") {
    const userId = String(raw.user_id || raw.userId || "");
    const createdAt = String(raw.createdAt || raw.created_at || "");
    const updatedAt = String(raw.updatedAt || raw.updated_at || "");
    const deletedAt = raw.deletedAt ? String(raw.deletedAt) : raw.deleted_at ? String(raw.deleted_at) : null;
    return {
      ...raw,
      userId,
      user_id: userId,
      createdAt,
      updatedAt,
      deletedAt,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: deletedAt,
    };
  }

  return raw;
}
