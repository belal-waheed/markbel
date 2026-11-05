import { Hono } from "hono";
import * as cheerio from "cheerio";
import { sniffImageMimeType, isVideoStreamUrl, isLowQualityImage } from "../../../src/lib/mediaHeuristics";
import { isSafePublicUrl } from "../../../src/lib/urlSafety";
import type { Bindings, Variables } from "../types";
import {
  extractMetadata,
  synthesizeMetadataFromUrl,
  fetchWithTimeout,
} from "../lib/metadataScraper";

export const mediaRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Upstash Redis Cache Helpers (Edge REST Protocol)
async function computeHash(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getRedisCache<T>(env: Bindings, key: string): Promise<T | null> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    const res = await fetchWithTimeout(
      env.UPSTASH_REDIS_REST_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["GET", key]),
      },
      2000
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!data || data.result === null || data.result === undefined) return null;
    return typeof data.result === "string" ? JSON.parse(data.result) : data.result;
  } catch (err) {
    console.warn("[Upstash Redis GET Error]:", err);
    return null;
  }
}

async function setRedisCache(
  env: Bindings,
  key: string,
  value: any,
  ttlSeconds = 604800 // 7 days default
): Promise<void> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return;
  try {
    await fetchWithTimeout(
      env.UPSTASH_REDIS_REST_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["SET", key, JSON.stringify(value), "EX", ttlSeconds]),
      },
      2000
    );
  } catch (err) {
    console.warn("[Upstash Redis SET Error]:", err);
  }
}

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/svg+xml",
  "application/octet-stream",
  "binary/octet-stream",
]);

export { isSafePublicUrl, sniffImageMimeType };

export function isSignedCdnExpired(url: URL): boolean {
  if (url.hostname.endsWith(".cdninstagram.com") || url.hostname.endsWith(".fbcdn.net")) {
    const oe = url.searchParams.get("oe");
    if (oe && /^[0-9a-fA-F]{8}$/.test(oe)) {
      return parseInt(oe, 16) * 1000 < Date.now();
    }
  }
  return false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MEDIA & PROXY ROUTE HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

mediaRouter.get("/api/proxy/image", async (c) => {
  const imageUrl = c.req.query("url")?.trim();
  if (!imageUrl) {
    return c.text("Image URL required", 400);
  }

  if (!isSafePublicUrl(imageUrl)) {
    return c.text("Blocked or unsafe URL", 400);
  }

  // Reject direct video stream manifests / segments upfront (except video.vid3rb.com which 302s to a JPEG poster)
  if (isVideoStreamUrl(imageUrl) && !imageUrl.includes("video.vid3rb.com/video/")) {
    return c.text("Unsupported image media type: video stream", 415, {
      "Access-Control-Allow-Origin": "*",
    });
  }

  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return c.text("Invalid protocol", 400);
    }

    if (isSignedCdnExpired(parsed)) {
      return c.text("Signed CDN URL has expired", 410, {
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      });
    }

    // Attempt cache match using Cloudflare edge cache
    const cache = (caches as any).default;
    const cacheKey = new Request(c.req.url, { method: "GET" });
    if (cache) {
      try {
        const cachedRes = await cache.match(cacheKey);
        if (cachedRes) {
          return cachedRes;
        }
      } catch (cacheMatchErr) {
        console.warn("[Image Proxy Cache Match Warning]:", cacheMatchErr);
      }
    }

    // Determine smart referer (support query param, or fallback to site domain or hostname)
    const customReferer = c.req.query("referer")?.trim();
    let referer = customReferer || `${parsed.protocol}//${parsed.hostname}/`;
    if (parsed.hostname.includes("vid3rb.com") || parsed.hostname.includes("anime3rb.com")) {
      referer = "https://anime3rb.com/";
    } else if (parsed.hostname.includes("cdninstagram.com") || parsed.hostname.includes("instagram.com")) {
      referer = "https://www.instagram.com/";
    } else if (parsed.hostname.includes("twimg.com") || parsed.hostname.includes("x.com") || parsed.hostname.includes("twitter.com")) {
      referer = "https://x.com/";
    } else if (parsed.hostname.includes("fbcdn.net") || parsed.hostname.includes("facebook.com")) {
      referer = "https://www.facebook.com/";
    } else if (parsed.hostname.includes("redditmedia.com") || parsed.hostname.includes("redd.it")) {
      referer = "https://www.reddit.com/";
    }

    // Fetch upstream image with desktop browser headers and origin referer to bypass hotlink protection.
    // Use manual redirects to prevent Cloudflare/fetch from dropping custom Referer headers across domains.
    let upstreamRes = await fetch(imageUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": referer,
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
      },
    });

    // If initial fetch returned 403 on Instagram CDN, retry once without Referer header
    if (upstreamRes.status === 403 && parsed.hostname.includes("cdninstagram.com")) {
      upstreamRes = await fetch(imageUrl, {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });
    }

    // Follow up to 3 redirect hops manually while strictly preserving Referer and validating target URL safety
    let currentRedirectUrl = imageUrl;
    let redirectHops = 0;
    while (
      redirectHops < 3 &&
      (upstreamRes.status === 301 ||
        upstreamRes.status === 302 ||
        upstreamRes.status === 307 ||
        upstreamRes.status === 308)
    ) {
      const location = upstreamRes.headers.get("location");
      if (!location) break;

      const redirectedUrl = new URL(location, currentRedirectUrl).href;
      if (!isSafePublicUrl(redirectedUrl)) {
        return c.text("Blocked or unsafe redirect URL", 400);
      }
      if (isVideoStreamUrl(redirectedUrl) && !redirectedUrl.includes("thumbnail")) {
        return c.text("Unsupported image media type: video stream", 415, {
          "Access-Control-Allow-Origin": "*",
        });
      }

      currentRedirectUrl = redirectedUrl;
      redirectHops++;

      upstreamRes = await fetch(currentRedirectUrl, {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": referer,
          "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Sec-Fetch-Dest": "image",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "cross-site",
        },
      });
    }

    if (!upstreamRes.ok) {
      return c.text(`Upstream image failed with status ${upstreamRes.status}`, 404, {
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      });
    }

    const rawContentType = (upstreamRes.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
    const isGenericMime =
      !rawContentType ||
      rawContentType === "application/octet-stream" ||
      rawContentType === "binary/octet-stream";

    let finalContentType: string;
    let responseBody: BodyInit;

    if (isGenericMime) {
      const buffer = await upstreamRes.arrayBuffer();
      const sniffed = sniffImageMimeType(new Uint8Array(buffer));
      if (!sniffed) {
        return c.text("Unsupported image media type", 415, {
          "Access-Control-Allow-Origin": "*",
        });
      }
      finalContentType = sniffed;
      responseBody = buffer;
    } else if (ALLOWED_IMAGE_MIMES.has(rawContentType)) {
      finalContentType = rawContentType;
      responseBody = upstreamRes.body!;
    } else {
      return c.text("Unsupported image media type", 415, {
        "Access-Control-Allow-Origin": "*",
      });
    }

    const headers = new Headers();
    headers.set("Content-Type", finalContentType);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=604800, s-maxage=2592000, immutable");
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");

    const proxyResponse = new Response(responseBody, {
      status: 200,
      headers,
    });

    if (cache) {
      try {
        c.executionCtx.waitUntil(cache.put(cacheKey, proxyResponse.clone()));
      } catch (cachePutErr) {
        console.warn("[Image Proxy Cache Put Warning]:", cachePutErr);
      }
    }

    return proxyResponse;
  } catch (err: any) {
    return c.text(`Proxy error: ${err?.message || err}`, 500);
  }
});

mediaRouter.get("/api/metadata", async (c) => {
  let targetUrl: URL | null = null;
  try {
    const rawReqUrl = c.req.url;
    let rawUrl = (c.req.query("url") || "").trim();

    const forceRefresh =
      c.req.query("refresh") === "1" ||
      c.req.query("nocache") === "1" ||
      c.req.query("forceRefresh") === "true" ||
      rawReqUrl.includes("refresh=1") ||
      rawReqUrl.includes("nocache=1") ||
      rawReqUrl.includes("forceRefresh=true");

    const urlParamIdx = rawReqUrl.indexOf("url=");
    if (urlParamIdx !== -1) {
      let extracted = rawReqUrl.slice(urlParamIdx + 4);
      extracted = extracted.replace(/&(refresh|nocache|forceRefresh)=[^&]*/g, "");
      try {
        rawUrl = decodeURIComponent(extracted);
      } catch {
        rawUrl = extracted;
      }
    }

    if (!rawUrl) {
      return c.json({ error: "URL is required" }, 400);
    }

    try {
      const formatted = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
        ? rawUrl
        : `https://${rawUrl}`;
      targetUrl = new URL(formatted);
      if (!isSafePublicUrl(targetUrl.href)) {
        return c.json({ error: "Blocked or unsafe URL" }, 400);
      }
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }

    // 0. Cloudflare Worker L1 Edge Metadata Cache
    const cache = (caches as any).default;
    const edgeCacheKey = new Request(c.req.url, { method: "GET" });

    if (!forceRefresh && cache) {
      try {
        const edgeCached = await cache.match(edgeCacheKey);
        if (edgeCached) {
          const edgeResponse = new Response(edgeCached.body, edgeCached);
          edgeResponse.headers.set("X-Cache", "HIT-L1-EDGE");
          return edgeResponse;
        }
      } catch (cacheMatchErr) {
        console.warn("[Metadata L1 Edge Cache Match Warning]:", cacheMatchErr);
      }
    }

    const urlHash = await computeHash(targetUrl.toString());
    const cacheKey = `markbel:metadata:${urlHash}`;

    // 1. Check Upstash Redis Cache first (unless forceRefresh is requested)
    if (!forceRefresh) {
      const cached = await getRedisCache<{ title: string; description: string; image: string }>(
        c.env,
        cacheKey
      );

      const isSynthesizedFallback =
        cached &&
        ((cached.description && cached.description.startsWith("Saved link from")) ||
          (cached.image && cached.image.includes("google.com/s2/favicons")));

      if (
        cached &&
        !isSynthesizedFallback &&
        cached.title &&
        cached.title !== targetUrl.hostname &&
        (cached.image || cached.description)
      ) {
        c.header("X-Cache", "HIT");
        c.header(
          "Cache-Control",
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
        );
        const redisHitResponse = c.json(cached);
        if (cache) {
          try {
            c.executionCtx.waitUntil(cache.put(edgeCacheKey, redisHitResponse.clone()));
          } catch (cachePutErr) {
            console.warn("[Metadata L1 Edge Cache Put Warning from Redis]:", cachePutErr);
          }
        }
        return redisHitResponse;
      }
    }

    c.header("X-Cache", "MISS");

    // Call modular metadata extraction engine
    let metadataResult = await extractMetadata(targetUrl, c.env);

    // Smart fallback if anti-bot/CAPTCHA blocked live scraping
    if (!metadataResult) {
      metadataResult = synthesizeMetadataFromUrl(targetUrl);
    }

    // Only cache high-quality results in Redis & L1 Edge (NEVER cache empty/failed fallback results)
    const isHighQualityResult =
      metadataResult.title &&
      metadataResult.title !== targetUrl.hostname.replace(/^www\./, "") &&
      (metadataResult.image || metadataResult.description);

    if (isHighQualityResult) {
      setRedisCache(c.env, cacheKey, metadataResult, 604800).catch(() => {});
      c.header(
        "Cache-Control",
        "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
      );
    }

    const response = c.json(metadataResult);

    if (isHighQualityResult && cache) {
      try {
        c.executionCtx.waitUntil(cache.put(edgeCacheKey, response.clone()));
      } catch (cachePutErr) {
        console.warn("[Metadata L1 Edge Cache Put Warning]:", cachePutErr);
      }
    }

    return response;
  } catch (err: any) {
    console.error("[Metadata Endpoint Exception]:", err);
    if (targetUrl) {
      return c.json(synthesizeMetadataFromUrl(targetUrl));
    }
    return c.json({ title: "Link", description: "", image: "" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EDGE ARTICLE EXTRACTION ENDPOINT (READER MODE)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

mediaRouter.get("/api/article", async (c) => {
  let targetUrl: URL | null = null;
  try {
    const rawReqUrl = c.req.url;
    let rawUrl = (c.req.query("url") || "").trim();

    const forceRefresh =
      c.req.query("refresh") === "1" ||
      c.req.query("nocache") === "1" ||
      c.req.query("forceRefresh") === "true" ||
      rawReqUrl.includes("refresh=1") ||
      rawReqUrl.includes("nocache=1") ||
      rawReqUrl.includes("forceRefresh=true");

    const urlParamIdx = rawReqUrl.indexOf("url=");
    if (urlParamIdx !== -1) {
      let extracted = rawReqUrl.slice(urlParamIdx + 4);
      extracted = extracted.replace(/&(refresh|nocache|forceRefresh)=[^&]*/g, "");
      try {
        rawUrl = decodeURIComponent(extracted);
      } catch {
        rawUrl = extracted;
      }
    }

    if (!rawUrl) {
      return c.json({ error: "URL is required" }, 400);
    }

    try {
      const formatted =
        rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
          ? rawUrl
          : `https://${rawUrl}`;
      targetUrl = new URL(formatted);
      if (!isSafePublicUrl(targetUrl.href)) {
        return c.json({ error: "Blocked or unsafe URL" }, 400);
      }
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }

    // 0. Cloudflare Worker L1 Edge Cache Check
    const cache = (caches as any).default;
    const edgeCacheKey = new Request(c.req.url, { method: "GET" });

    if (!forceRefresh && cache) {
      try {
        const edgeCached = await cache.match(edgeCacheKey);
        if (edgeCached) {
          const edgeResponse = new Response(edgeCached.body, edgeCached);
          edgeResponse.headers.set("X-Cache", "HIT-L1-EDGE");
          return edgeResponse;
        }
      } catch (cacheMatchErr) {
        console.warn("[Article L1 Edge Cache Match Warning]:", cacheMatchErr);
      }
    }

    const urlHash = await computeHash(targetUrl.toString());
    const redisKey = `markbel:article:${urlHash}`;

    // 1. Upstash Redis Cache Check
    if (!forceRefresh) {
      const cached = await getRedisCache<{
        title: string;
        author: string;
        publishedAt: string;
        readingTime: number;
        wordCount: number;
        content: string;
      }>(c.env, redisKey);

      if (cached && cached.content) {
        c.header("X-Cache", "HIT");
        c.header(
          "Cache-Control",
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
        );
        const redisHitResponse = c.json(cached);
        if (cache) {
          try {
            c.executionCtx.waitUntil(cache.put(edgeCacheKey, redisHitResponse.clone()));
          } catch (cachePutErr) {
            console.warn("[Article L1 Edge Cache Put Warning from Redis]:", cachePutErr);
          }
        }
        return redisHitResponse;
      }
    }

    c.header("X-Cache", "MISS");

    // 2. Upstream HTML Fetch with 7s timeout
    let upstreamRes: Response;
    try {
      upstreamRes = await fetchWithTimeout(targetUrl.href, {}, 7000);
    } catch (fetchErr: any) {
      return c.json(
        { error: `Failed to fetch target URL: ${fetchErr?.message || fetchErr}` },
        502
      );
    }

    if (!upstreamRes.ok) {
      return c.json({ error: `Upstream returned status ${upstreamRes.status}` }, 502);
    }

    const html = await upstreamRes.text();
    const $ = cheerio.load(html);

    // Strip junk and distracting elements
    $(
      "script, style, noscript, nav, footer, header, aside, iframe, form, button, " +
      ".ad, .ads, .advertisement, .sidebar, .menu, .cookie-banner, .popup, " +
      "[role='banner'], [role='navigation'], [role='complementary'], [aria-hidden='true']"
    ).remove();

    // Extract title
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      targetUrl.hostname;

    // Extract author
    const author =
      $('meta[name="author"]').attr("content") ||
      $('meta[property="article:author"]').attr("content") ||
      $('meta[name="twitter:creator"]').attr("content") ||
      $('[rel="author"]').first().text().trim() ||
      $(".byline, .author").first().text().trim() ||
      "";

    // Extract published date
    const publishedAt =
      $('meta[property="article:published_time"]').attr("content") ||
      $('meta[name="date"]').attr("content") ||
      $('meta[name="pubdate"]').attr("content") ||
      $("time[datetime]").first().attr("datetime") ||
      $("time").first().text().trim() ||
      "";

    // Candidate article containers
    let $content = $("article");
    if (!$content.length) {
      $content = $("main");
    }
    if (!$content.length) {
      $content = $('[role="main"]');
    }
    if (!$content.length) {
      $content = $(".post-content, .article-content, .entry-content, .content");
    }
    if (!$content.length) {
      $content = $("body");
    }

    // Extract clean paragraphs, headings, blockquotes, code blocks, lists
    const extractedParts: string[] = [];
    $content
      .find("h1, h2, h3, h4, h5, h6, p, blockquote, ul, ol, pre")
      .each((_, el) => {
        const tagName = (el as any).tagName?.toLowerCase() || "";
        const $el = $(el);
        const text = $el.text().trim();
        if (!text) return;

        // Skip children if inside blockquote/ul/ol unless list item
        if ($el.parents("blockquote, ul, ol").length > 0 && tagName !== "li") {
          return;
        }

        if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
          extractedParts.push(`<${tagName}>${escapeHtml(text)}</${tagName}>`);
        } else if (tagName === "blockquote") {
          extractedParts.push(`<blockquote><p>${escapeHtml(text)}</p></blockquote>`);
        } else if (tagName === "pre") {
          extractedParts.push(`<pre><code>${escapeHtml(text)}</code></pre>`);
        } else if (tagName === "ul" || tagName === "ol") {
          const items: string[] = [];
          $el.children("li").each((_, li) => {
            const liText = $(li).text().trim();
            if (liText) items.push(`<li>${escapeHtml(liText)}</li>`);
          });
          if (items.length > 0) {
            extractedParts.push(`<${tagName}>${items.join("")}</${tagName}>`);
          }
        } else if (tagName === "p") {
          extractedParts.push(`<p>${escapeHtml(text)}</p>`);
        }
      });

    let cleanContent = extractedParts.join("\n");
    if (!cleanContent) {
      const rawText = $content.text().replace(/\s+/g, " ").trim();
      cleanContent = rawText
        ? `<p>${escapeHtml(rawText)}</p>`
        : "<p>No readable article content could be extracted.</p>";
    }

    // Compute word count and reading time (Math.max(1, Math.ceil(words / 200)))
    const plainText = cleanContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    const readingTime = Math.max(1, Math.ceil(words / 200));

    const result = {
      title: title.trim(),
      author: author.trim(),
      publishedAt: publishedAt.trim(),
      readingTime,
      wordCount: words,
      content: cleanContent,
    };

    if (words > 20) {
      setRedisCache(c.env, redisKey, result, 604800).catch(() => {});
      c.header(
        "Cache-Control",
        "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
      );
    }

    const response = c.json(result);

    if (words > 20 && cache) {
      try {
        c.executionCtx.waitUntil(cache.put(edgeCacheKey, response.clone()));
      } catch (cachePutErr) {
        console.warn("[Article L1 Edge Cache Put Warning]:", cachePutErr);
      }
    }

    return response;
  } catch (err: any) {
    console.error("[Article Extraction Exception]:", err);
    return c.json(
      {
        error: `Article extraction failed: ${err?.message || err}`,
      },
      500
    );
  }
});
