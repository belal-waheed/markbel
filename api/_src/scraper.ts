import * as cheerio from "cheerio";
import Bookmark from "./models/Bookmark.js";
import SyncChange from "./models/SyncChange.js";

export const scrapeBookmarkMetadata = async (bookmark: {
  id: string;
  url: string;
  title?: string;
  image?: string;
  description?: string;
  userId?: string;
}) => {
  const { id, url, title, image, description, userId } = bookmark;

  let finalTitle = title ? title.trim() : "";
  let finalImage = image ? image.trim() : "";
  let finalDescription = description ? description.trim() : "";

  const shouldScrapeTitle = !finalTitle || finalTitle === url;
  const shouldScrapeImage = !finalImage;
  const shouldScrapeDesc = !finalDescription;

  if (!shouldScrapeTitle && !shouldScrapeImage && !shouldScrapeDesc) {
    return;
  }

  try {
    const parsedUrl = new URL(url);

    // 1. YouTube video ID extraction for fast thumbnail
    let ytId: string | null = null;
    if (parsedUrl.hostname.includes("youtube.com")) {
      if (parsedUrl.pathname.startsWith("/watch")) {
        ytId = parsedUrl.searchParams.get("v");
      } else if (parsedUrl.pathname.startsWith("/embed/")) {
        ytId = parsedUrl.pathname.split("/")[2];
      } else if (parsedUrl.pathname.startsWith("/shorts/")) {
        ytId = parsedUrl.pathname.split("/")[2];
      }
    } else if (parsedUrl.hostname.includes("youtu.be")) {
      const parts = parsedUrl.pathname.slice(1).split("/");
      ytId = parts[0];
    }

    let scrapedTitle = "";
    let scrapedDesc = "";
    let scrapedImage = ytId
      ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
      : "";

    // 2. Fetch page HTML if needed
    if (!ytId || shouldScrapeTitle || shouldScrapeDesc || (!scrapedImage && shouldScrapeImage)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        let userAgent =
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        if (parsedUrl.hostname.includes("instagram.com")) {
          userAgent =
            "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_codedoc.html)";
        }

        const response = await fetch(parsedUrl.toString(), {
          headers: {
            "User-Agent": userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);

          // Extract Title
          scrapedTitle =
            $('meta[property="og:title"]').attr("content") ||
            $('meta[name="twitter:title"]').attr("content") ||
            $("title").text() ||
            $('meta[name="title"]').attr("content") ||
            "";

          // Extract Description
          scrapedDesc =
            $('meta[property="og:description"]').attr("content") ||
            $('meta[name="twitter:description"]').attr("content") ||
            $('meta[name="description"]').attr("content") ||
            "";

          // Extract Image
          if (!scrapedImage) {
            let img =
              $('meta[property="og:image"]').attr("content") ||
              $('meta[property="og:image:secure_url"]').attr("content") ||
              $('meta[name="twitter:image"]').attr("content") ||
              $('meta[name="twitter:image:src"]').attr("content") ||
              $('link[rel="image_src"]').attr("href") ||
              "";

            if (img && !img.startsWith("http")) {
              try {
                img = new URL(img, parsedUrl.origin).toString();
              } catch {
                // Ignore url parse error
              }
            }
            scrapedImage = img;
          }
        }
      } catch (fetchErr) {
        console.warn(
          `[Scraper] Fetch warning for ${url}:`,
          fetchErr instanceof Error ? fetchErr.message : fetchErr
        );
      }
    }

    let updatedTitle = finalTitle;
    let updatedImage = finalImage;
    let updatedDescription = finalDescription;

    if (shouldScrapeTitle && scrapedTitle) {
      updatedTitle = scrapedTitle.trim();
    } else if (
      shouldScrapeTitle &&
      ytId &&
      (!updatedTitle || updatedTitle === url || updatedTitle === parsedUrl.hostname)
    ) {
      updatedTitle = "YouTube Video";
    }

    if (shouldScrapeImage && scrapedImage) {
      updatedImage = scrapedImage.trim();
    }
    if (shouldScrapeDesc && scrapedDesc) {
      updatedDescription = scrapedDesc.trim();
    }

    // Only update if there are meaningful changes
    if (
      updatedTitle === finalTitle &&
      updatedImage === finalImage &&
      updatedDescription === finalDescription
    ) {
      return;
    }

    // Fetch existing document to bump version and get userId if missing
    const existing = await Bookmark.findOne({ id });
    if (!existing) return;

    const newVersion = (existing.version || 0) + 1;
    const now = new Date().toISOString();

    existing.title = updatedTitle || existing.title;
    existing.image = updatedImage || existing.image;
    existing.description = updatedDescription || existing.description;
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
