import Bookmark from "./models/Bookmark.js";
import SyncChange from "./models/SyncChange.js";
import { MetadataService } from "./services/MetadataService.js";

export const scrapeBookmarkMetadata = async (bookmark: {
  id: string;
  url: string;
  title?: string;
  image?: string;
  description?: string;
  userId?: string;
}) => {
  const { id, url, title, image, description, userId } = bookmark;

  const finalTitle = title ? title.trim() : "";
  const finalImage = image ? image.trim() : "";
  const finalDescription = description ? description.trim() : "";

  const shouldScrapeTitle = !finalTitle || finalTitle === url;
  const shouldScrapeImage = !finalImage;
  const shouldScrapeDesc = !finalDescription;

  if (!shouldScrapeTitle && !shouldScrapeImage && !shouldScrapeDesc) {
    return;
  }

  try {
    const meta = await MetadataService.extractMetadata(url, {
      timeoutMs: 6000,
      includeArticleContent: true,
    });

    const existing = await Bookmark.findOne({ id });
    if (!existing) return;

    let hasChanges = false;
    if (shouldScrapeTitle && meta.title && meta.title !== existing.title) {
      existing.title = meta.title;
      hasChanges = true;
    }
    if (shouldScrapeImage && meta.image && meta.image !== existing.image) {
      existing.image = meta.image;
      hasChanges = true;
    }
    if (shouldScrapeDesc && meta.description && meta.description !== existing.description) {
      existing.description = meta.description;
      hasChanges = true;
    }
    if (meta.favicon && !existing.favicon) {
      existing.favicon = meta.favicon;
      hasChanges = true;
    }
    if (meta.siteName && !existing.siteName) {
      existing.siteName = meta.siteName;
      hasChanges = true;
    }
    if (meta.author && !existing.author) {
      existing.author = meta.author;
      hasChanges = true;
    }
    if (meta.publishedAt && !existing.publishedAt) {
      existing.publishedAt = meta.publishedAt;
      hasChanges = true;
    }
    if (meta.contentType && existing.contentType !== meta.contentType) {
      existing.contentType = meta.contentType;
      hasChanges = true;
    }
    if (meta.readingTime && existing.readingTime !== meta.readingTime) {
      existing.readingTime = meta.readingTime;
      hasChanges = true;
    }
    if (meta.wordCount && existing.wordCount !== meta.wordCount) {
      existing.wordCount = meta.wordCount;
      hasChanges = true;
    }
    if (meta.canonicalUrl && !existing.canonicalUrl) {
      existing.canonicalUrl = meta.canonicalUrl;
      hasChanges = true;
    }
    if (meta.articleContent && !existing.articleContent) {
      existing.articleContent = meta.articleContent;
      hasChanges = true;
    }

    if (!hasChanges) {
      return;
    }

    const newVersion = (existing.version || 0) + 1;
    const now = new Date().toISOString();

    existing.version = newVersion;
    existing.updatedAt = now;
    await existing.save();

    const targetUserId = userId || existing.userId;

    // Log SyncChange so clients pull the updated metadata seamlessly
    if (targetUserId) {
      const syncChange = new SyncChange({
        userId: targetUserId,
        entityType: "bookmark",
        entityId: id,
        operation: "update",
        entityVersion: newVersion,
        clientChangeId: `server-scrape-${id}-${newVersion}`,
        record: existing.toJSON(),
        changedAt: now,
      });
      await syncChange.save();
    }

    console.log(
      `[Scraper] Successfully enriched bookmark ${id} (v${newVersion}) - "${existing.title}"`
    );
  } catch (err) {
    console.error(`[Scraper] Error scraping ${url}:`, err);
  }
};
