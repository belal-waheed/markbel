export function normalizeSyncRecord(record: any, entityType: string): any {
  if (!record || typeof record !== "object") return record;

  if (entityType === "bookmark") {
    const isRead =
      record.isRead !== undefined
        ? Boolean(record.isRead)
        : record.is_read !== undefined
        ? Boolean(record.is_read)
        : false;

    const isPinned =
      record.isPinned !== undefined
        ? Boolean(record.isPinned)
        : record.is_pinned !== undefined
        ? Boolean(record.is_pinned)
        : false;

    const isArchived =
      record.isArchived !== undefined
        ? Boolean(record.isArchived)
        : record.is_archived !== undefined
        ? Boolean(record.is_archived)
        : false;

    const title = record.title || "";
    const url = record.url || "";
    const description = record.description || "";
    const image = record.image || "";
    const favicon = record.favicon || "";
    const siteName = record.siteName || record.site_name || "";
    const author = record.author || "";
    const publishedAt = record.publishedAt || record.published_at || "";
    const contentType = record.contentType || record.content_type || "website";
    const readingTime = record.readingTime ?? record.reading_time ?? 0;
    const wordCount = record.wordCount ?? record.word_count ?? 0;
    const canonicalUrl = record.canonicalUrl || record.canonical_url || "";
    const articleContent = record.articleContent || record.article_content || "";
    const group = record.group || record.group_name || "Unsorted";
    const readAt = record.readAt || record.read_at || "";
    const remindAt = record.remindAt || record.remind_at || "";
    const archiveGroup = record.archiveGroup || record.archive_group || "";
    const createdAt = record.createdAt || record.created_at || "";
    const updatedAt = record.updatedAt || record.updated_at || "";
    const deletedAt = record.deletedAt || record.deleted_at || null;

    return {
      ...record,
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
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: deletedAt,
    };
  }

  if (entityType === "group") {
    const userId = record.user_id || record.userId || "";
    const createdAt = record.createdAt || record.created_at || "";
    const updatedAt = record.updatedAt || record.updated_at || "";
    const deletedAt = record.deletedAt || record.deleted_at || null;
    return {
      ...record,
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

  return record;
}
