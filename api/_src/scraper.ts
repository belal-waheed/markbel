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
    const hostname = parsedUrl.hostname.toLowerCase();

    let ytId: string | null = null;
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      if (parsedUrl.pathname.startsWith("/shorts/")) {
        ytId = parsedUrl.pathname.split("/")[2]?.split("?")[0] || null;
      } else if (parsedUrl.pathname.startsWith("/watch")) {
        ytId = parsedUrl.searchParams.get("v");
      } else if (parsedUrl.pathname.startsWith("/embed/")) {
        ytId = parsedUrl.pathname.split("/")[2]?.split("?")[0] || null;
      } else if (hostname.includes("youtu.be")) {
        ytId = parsedUrl.pathname.slice(1).split("/")[0]?.split("?")[0] || null;
      }
    }

    let scrapedTitle = "";
    let scrapedDesc = "";
    let scrapedImage = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "";

    // 1. YouTube oEmbed
    if (ytId) {
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          if (oembedData.title) scrapedTitle = oembedData.title;
          if (oembedData.author_name) scrapedDesc = `By ${oembedData.author_name}`;
        }
      } catch {}
    }

    // 2. TikTok oEmbed
    if (hostname.includes("tiktok.com")) {
      try {
        const oembedRes = await fetch(
          `https://www.tiktok.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          scrapedTitle = oembedData.title || `TikTok by @${oembedData.author_unique_id || oembedData.author_name}`;
          scrapedDesc = oembedData.author_name ? `@${oembedData.author_unique_id || oembedData.author_name} on TikTok` : "TikTok Video";
          if (oembedData.thumbnail_url) scrapedImage = oembedData.thumbnail_url;
        }
      } catch {}
    }

    // 3. Twitter / X oEmbed
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      try {
        const oembedRes = await fetch(
          `https://publish.twitter.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}&omit_script=true`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          scrapedTitle = oembedData.author_name ? `Post by ${oembedData.author_name}` : "Post on X";
          scrapedDesc = (oembedData.html || "").replace(/<[^>]*>?/gm, "").trim().slice(0, 200);
        }
      } catch {}
    }

    // 4. Fetch page HTML if needed
    if (!scrapedTitle || !scrapedImage || !scrapedDesc) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        let userAgent =
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
        if (hostname.includes("instagram.com") || hostname.includes("facebook.com")) {
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
          if (!scrapedTitle) {
            scrapedTitle =
              $('meta[property="og:title"]').attr("content") ||
              $('meta[name="twitter:title"]').attr("content") ||
              $("title").text() ||
              $('meta[name="title"]').attr("content") ||
              "";
          }

          // Extract Description
          if (!scrapedDesc) {
            scrapedDesc =
              $('meta[property="og:description"]').attr("content") ||
              $('meta[name="twitter:description"]').attr("content") ||
              $('meta[name="description"]').attr("content") ||
              "";
          }

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
              } catch {}
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
