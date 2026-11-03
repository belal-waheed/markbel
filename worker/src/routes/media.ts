import { Hono } from "hono";
import * as cheerio from "cheerio";
import { sniffImageMimeType } from "../../../src/lib/mediaHeuristics";
import type { Bindings, Variables } from "../types";

export const mediaRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Upstash Redis Cache Helpers (Edge REST Protocol)
async function computeHash(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const reqHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ...((options.headers as any) || {}),
  };
  try {
    return await fetch(url, {
      ...options,
      headers: reqHeaders,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
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

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…");
}

function cleanText(str: string): string {
  if (!str) return "";
  return decodeHtmlEntities(str.replace(/\s+/g, " ").trim());
}

function synthesizeMetadataFromUrl(targetUrl: URL): { title: string; description: string; image: string } {
  const rawSegments = targetUrl.pathname
    .split("/")
    .filter(Boolean)
    .map((seg) => decodeURIComponent(seg).replace(/[-_+]/g, " ").replace(/\.[a-zA-Z0-9]+$/, "").trim())
    .filter((seg) => seg.length > 0);

  const domainParts = targetUrl.hostname.replace(/^www\./, "").split(".");
  const domainName = domainParts.length > 1 ? domainParts[0] : targetUrl.hostname;
  const capitalizedDomain = domainName.charAt(0).toUpperCase() + domainName.slice(1);

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${targetUrl.hostname}&sz=128`;

  if (rawSegments.length > 0) {
    const formattedSegments = rawSegments.map((s) =>
      s.replace(/\b\w/g, (l) => l.toUpperCase())
    );
    const synthesizedTitle = `${formattedSegments.join(" - ")} | ${capitalizedDomain}`;
    return {
      title: synthesizedTitle,
      description: `Saved link from ${targetUrl.hostname} (${formattedSegments.join(" / ")})`,
      image: faviconUrl,
    };
  }

  return {
    title: capitalizedDomain || targetUrl.hostname.replace(/^www\./, ""),
    description: `Saved link from ${targetUrl.hostname}`,
    image: faviconUrl,
  };
}

async function fetchAnimeMetadataFromAniList(
  targetUrl: URL
): Promise<{ title: string; description: string; image: string } | null> {
  const hostname = targetUrl.hostname.toLowerCase();
  const isAnimeSite =
    hostname.includes("anime3rb.com") ||
    hostname.includes("crunchyroll.com") ||
    hostname.includes("gogoanime") ||
    hostname.includes("aniwatch") ||
    hostname.includes("animepahe") ||
    hostname.includes("myanimelist.net") ||
    hostname.includes("kitsu.io") ||
    hostname.includes("9anime") ||
    hostname.includes("anitaku") ||
    hostname.includes("animedao") ||
    hostname.includes("kickassanime") ||
    targetUrl.pathname.includes("/episode/") ||
    targetUrl.pathname.includes("/anime/");

  if (!isAnimeSite) return null;

  const pathParts = targetUrl.pathname.split("/").filter(Boolean);
  let potentialTitle = "";
  let episodeNum = "";

  for (let i = 0; i < pathParts.length; i++) {
    const part = decodeURIComponent(pathParts[i]).replace(/[-_+]/g, " ").trim();
    if (/^\d+$/.test(part)) {
      episodeNum = part;
    } else if (
      part.toLowerCase() !== "episode" &&
      part.toLowerCase() !== "anime" &&
      part.toLowerCase() !== "watch" &&
      part.toLowerCase() !== "series" &&
      part.length > 2
    ) {
      if (!potentialTitle) potentialTitle = part;
    }
  }

  if (!potentialTitle) return null;

  // 1. Try AniList GraphQL API
  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          title {
            english
            romaji
            native
          }
          coverImage {
            extraLarge
            large
          }
          bannerImage
          description
        }
      }
    `;

    const res = await fetchWithTimeout(
      "https://graphql.anilist.co",
      {
        method: "POST",
        headers: {
          "User-Agent": "MarkbelApp/2.1 (+https://markbel.app)",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { search: potentialTitle },
        }),
      },
      4500
    );

    if (res.ok) {
      const data: any = await res.json();
      const media = data?.data?.Media;
      if (media) {
        const mainTitle =
          media.title?.english || media.title?.romaji || media.title?.native || potentialTitle;
        const titleWithEpisode = episodeNum
          ? `${mainTitle} - Episode ${episodeNum}`
          : mainTitle;

        const cleanSynopsis = media.description
          ? media.description
              .replace(/<[^>]*>?/gm, "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 320) + (media.description.length > 320 ? "..." : "")
          : `Watch ${mainTitle} online.`;

        const image =
          media.coverImage?.extraLarge ||
          media.coverImage?.large ||
          media.bannerImage ||
          "";

        if (image) {
          return {
            title: cleanText(titleWithEpisode),
            description: cleanText(cleanSynopsis),
            image: image.trim(),
          };
        }
      }
    }
  } catch (err) {
    console.warn("[AniList GraphQL Fetch Error]:", err);
  }

  // 2. Try Kitsu REST API Fallback
  try {
    const kitsuRes = await fetchWithTimeout(
      `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(potentialTitle)}&page[limit]=1`,
      {
        headers: {
          "User-Agent": "MarkbelApp/2.1 (+https://markbel.app)",
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
        },
      },
      4500
    );

    if (kitsuRes.ok) {
      const kitsuData: any = await kitsuRes.json();
      const anime = kitsuData.data?.[0];
      if (anime && anime.attributes) {
        const mainTitle = anime.attributes.canonicalTitle || potentialTitle;
        const titleWithEpisode = episodeNum
          ? `${mainTitle} - Episode ${episodeNum}`
          : mainTitle;

        const cleanSynopsis = anime.attributes.synopsis
          ? anime.attributes.synopsis
              .replace(/<[^>]*>?/gm, "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 320) + (anime.attributes.synopsis.length > 320 ? "..." : "")
          : `Watch ${mainTitle} online.`;

        const image =
          anime.attributes.posterImage?.large ||
          anime.attributes.posterImage?.original ||
          anime.attributes.coverImage?.large ||
          "";

        if (image) {
          return {
            title: cleanText(titleWithEpisode),
            description: cleanText(cleanSynopsis),
            image: image.trim(),
          };
        }
      }
    }
  } catch (err) {
    console.warn("[Kitsu REST Fetch Error]:", err);
  }

  return null;
}

/**
 * Validates whether a target URL is safe to fetch (blocks SSRF, loopbacks, link-local metadata, and private CIDR ranges).
 */
export function isSafePublicUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

    // Block localhost, loopback, and zero addresses
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "0:0:0:0:0:0:0:0" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return false;
    }

    // Block cloud metadata services (AWS, GCP, Azure, DigitalOcean)
    if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
      return false;
    }

    // Check IPv4 private and link-local ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    if (ipMatch) {
      const octets = [
        parseInt(ipMatch[1], 10),
        parseInt(ipMatch[2], 10),
        parseInt(ipMatch[3], 10),
        parseInt(ipMatch[4], 10),
      ];

      // 10.0.0.0/8
      if (octets[0] === 10) return false;
      // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;
      // 192.168.0.0/16
      if (octets[0] === 192 && octets[1] === 168) return false;
      // 127.0.0.0/8 (Loopback)
      if (octets[0] === 127) return false;
      // 169.254.0.0/16 (Link-local)
      if (octets[0] === 169 && octets[1] === 254) return false;
      // 0.0.0.0/8
      if (octets[0] === 0) return false;
    }

    // Block IPv6 private ranges (fc00::/7, fe80::/10)
    if (hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:")) {
      return false;
    }

    return true;
  } catch {
    return false;
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

export { sniffImageMimeType };

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

    // Fetch upstream image with desktop browser headers and origin referer to bypass hotlink protection
    let upstreamRes = await fetch(imageUrl, {
      redirect: "follow",
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
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });
    }

    // If initial fetch returned 301/302 that wasn't automatically followed
    if ((upstreamRes.status === 301 || upstreamRes.status === 302) && upstreamRes.headers.get("location")) {
      const redirectedUrl = new URL(upstreamRes.headers.get("location")!, imageUrl).href;
      if (!isSafePublicUrl(redirectedUrl)) {
        return c.text("Blocked or unsafe redirect URL", 400);
      }
      upstreamRes = await fetch(redirectedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": referer,
          "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
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
      finalContentType = sniffImageMimeType(new Uint8Array(buffer)) || "image/jpeg";
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

    const hostname = targetUrl.hostname.toLowerCase();
    let metadataResult: { title: string; description: string; image: string } | null = null;

    // 1. YouTube Adapter (Videos, Shorts, Embeds, Playlists)
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      let ytId: string | null = null;
      if (targetUrl.pathname.startsWith("/shorts/")) {
        ytId = targetUrl.pathname.split("/")[2]?.split("?")[0] || null;
      } else if (targetUrl.pathname.startsWith("/watch")) {
        ytId = targetUrl.searchParams.get("v");
      } else if (targetUrl.pathname.startsWith("/embed/")) {
        ytId = targetUrl.pathname.split("/")[2]?.split("?")[0] || null;
      } else if (hostname.includes("youtu.be")) {
        ytId = targetUrl.pathname.slice(1).split("/")[0]?.split("?")[0] || null;
      }

      const listParam = targetUrl.searchParams.get("list");
      const isPlaylist = Boolean(listParam || targetUrl.pathname.startsWith("/playlist"));

      if (ytId || isPlaylist) {
        let thumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "";
        let ytTitle = isPlaylist && !ytId 
          ? "YouTube Playlist" 
          : (targetUrl.pathname.startsWith("/shorts/") ? "YouTube Short" : "YouTube Video");
        let ytAuthor = "";

        const queryUrl = ytId
          ? `https://www.youtube.com/watch?v=${ytId}${listParam ? `&list=${listParam}` : ""}`
          : `https://www.youtube.com/playlist?list=${listParam || ""}`;
        const encodedUrl = encodeURIComponent(queryUrl);

        try {
          const oembedRes = await fetchWithTimeout(
            `https://www.youtube.com/oembed?url=${encodedUrl}&format=json`,
            {},
            4000
          );
          if (oembedRes.ok) {
            const oembedData: any = await oembedRes.json();
            if (oembedData.title) ytTitle = oembedData.title;
            if (oembedData.author_name) ytAuthor = oembedData.author_name;
            if (oembedData.thumbnail_url && !thumbnail) thumbnail = oembedData.thumbnail_url;
          } else {
            const noembedRes = await fetchWithTimeout(
              `https://noembed.com/embed?url=${encodedUrl}`,
              {},
              4000
            );
            if (noembedRes.ok) {
              const noembedData: any = await noembedRes.json();
              if (noembedData.title) ytTitle = noembedData.title;
              if (noembedData.author_name) ytAuthor = noembedData.author_name;
              if (noembedData.thumbnail_url && !thumbnail) thumbnail = noembedData.thumbnail_url;
            }
          }
        } catch {}

        metadataResult = {
          title: cleanText(ytTitle),
          description: ytAuthor ? `By ${ytAuthor} on YouTube` : (isPlaylist ? "YouTube Playlist" : "YouTube Video"),
          image: thumbnail,
        };
      }
    }

    // 2. Instagram & Threads / Meta Adapter (facebookexternalhit crawler engine)
    if (
      !metadataResult &&
      (hostname.includes("instagram.com") ||
        hostname.includes("instagr.am") ||
        hostname.includes("threads.net") ||
        hostname.includes("facebook.com"))
    ) {
      try {
        const metaRes = await fetchWithTimeout(
          targetUrl.toString(),
          {
            headers: {
              "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_codedoc.html)",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "none",
            },
          },
          5000
        );

        if (metaRes.ok) {
          const html = await metaRes.text();
          const $ = cheerio.load(html);

          let ogTitle =
            $('meta[property="og:title"]').attr("content") ||
            $('meta[name="twitter:title"]').attr("content") ||
            $("title").text() ||
            "";
          let ogDesc =
            $('meta[property="og:description"]').attr("content") ||
            $('meta[name="twitter:description"]').attr("content") ||
            $('meta[name="description"]').attr("content") ||
            "";
          let ogImage =
            $('meta[property="og:image"]').attr("content") ||
            $('meta[property="og:image:secure_url"]').attr("content") ||
            $('meta[name="twitter:image"]').attr("content") ||
            $('meta[name="twitter:image:src"]').attr("content") ||
            "";

          ogTitle = cleanText(ogTitle);
          if (!ogTitle || (ogTitle.toLowerCase().includes("instagram") && targetUrl.pathname.includes("/reel/"))) {
            ogTitle = ogTitle || "Instagram Reel";
          }

          if (ogImage || ogTitle) {
            metadataResult = {
              title: ogTitle,
              description: cleanText(ogDesc).slice(0, 350) || (targetUrl.pathname.includes("/reel/") ? "Instagram Reel" : "Instagram Post"),
              image: ogImage.replace(/&amp;/g, '&').trim(),
            };
          }
        }

        // Instagram Engine Layer 2: Public oEmbed
        if (!metadataResult?.image) {
          try {
            const igOembedRes = await fetchWithTimeout(
              `https://api.instagram.com/oembed/?url=${encodeURIComponent(targetUrl.toString())}`,
              {},
              3000
            );
            if (igOembedRes.ok) {
              const oembedData: any = await igOembedRes.json();
              if (oembedData.thumbnail_url) {
                metadataResult = {
                  title: metadataResult?.title || cleanText(oembedData.title || (targetUrl.pathname.includes("/reel/") ? "Instagram Reel" : "Instagram Post")),
                  description: metadataResult?.description || (oembedData.author_name ? `@${oembedData.author_name} on Instagram` : "Instagram Post"),
                  image: oembedData.thumbnail_url,
                };
              }
            }
          } catch {}
        }

        // Instagram Engine Layer 3: Microlink Visual Engine Fallback
        if (!metadataResult?.image) {
          try {
            const mlRes = await fetchWithTimeout(
              `https://api.microlink.io/?url=${encodeURIComponent(targetUrl.toString())}`,
              {},
              3500
            );
            if (mlRes.ok) {
              const mlData: any = await mlRes.json();
              const mlImg = mlData.data?.image?.url || mlData.data?.logo?.url || "";
              if (mlImg) {
                metadataResult = {
                  title: metadataResult?.title || cleanText(mlData.data?.title || (targetUrl.pathname.includes("/reel/") ? "Instagram Reel" : "Instagram Post")),
                  description: metadataResult?.description || cleanText(mlData.data?.description || "Instagram Post"),
                  image: mlImg,
                };
              }
            }
          } catch {}
        }
      } catch (igErr) {
        console.warn("[Instagram Scrape Adapter Error]:", igErr);
      }
    }

    // 3. TikTok Adapter (oEmbed)
    if (!metadataResult && hostname.includes("tiktok.com")) {
      try {
        const oembedRes = await fetchWithTimeout(
          `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl.toString())}`,
          {},
          4000
        );
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          metadataResult = {
            title: cleanText(
              oembedData.title || `TikTok by @${oembedData.author_unique_id || oembedData.author_name}`
            ),
            description: oembedData.author_name
              ? `@${oembedData.author_unique_id || oembedData.author_name} on TikTok`
              : "TikTok Video",
            image: oembedData.thumbnail_url || "",
          };
        }
      } catch {}
    }

    // 4. Twitter / X Adapter (Publish oEmbed)
    if (!metadataResult && (hostname.includes("twitter.com") || hostname.includes("x.com"))) {
      try {
        const oembedRes = await fetchWithTimeout(
          `https://publish.twitter.com/oembed?url=${encodeURIComponent(targetUrl.toString())}&omit_script=true`,
          {},
          4000
        );
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          const plainText = (oembedData.html || "").replace(/<[^>]*>?/gm, "").trim();
          metadataResult = {
            title: oembedData.author_name ? `Post by ${oembedData.author_name}` : "Post on X",
            description: cleanText(plainText).slice(0, 300),
            image: "",
          };
        }
      } catch {}
    }

    // 5. GitHub Repository Adapter
    if (!metadataResult && (hostname === "github.com" || hostname.endsWith(".github.com"))) {
      const pathParts = targetUrl.pathname.split("/").filter(Boolean);
      if (pathParts.length >= 2) {
        const [owner, repo] = pathParts;
        try {
          const ghRes = await fetchWithTimeout(
            `https://api.github.com/repos/${owner}/${repo}`,
            { headers: { "User-Agent": "MarkbelApp/2.1" } },
            4000
          );
          if (ghRes.ok) {
            const ghData: any = await ghRes.json();
            metadataResult = {
              title: `${owner}/${repo}: ${ghData.description || "GitHub Repository"}`,
              description: ghData.description || `GitHub repository by ${owner}`,
              image: `https://opengraph.githubassets.com/1/${owner}/${repo}`,
            };
          }
        } catch {}
      }
    }

    // 6. Wikipedia Article Adapter
    if (!metadataResult && hostname.includes("wikipedia.org")) {
      const pathParts = targetUrl.pathname.split("/wiki/").filter(Boolean);
      if (pathParts.length >= 1) {
        const titleKey = pathParts[pathParts.length - 1];
        try {
          const lang = hostname.split(".")[0] || "en";
          const wikiRes = await fetchWithTimeout(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titleKey)}`,
            { headers: { "User-Agent": "MarkbelApp/2.1" } },
            4000
          );
          if (wikiRes.ok) {
            const wikiData: any = await wikiRes.json();
            metadataResult = {
              title: wikiData.title || titleKey,
              description: wikiData.extract ? wikiData.extract.slice(0, 350) : "Wikipedia Article",
              image: wikiData.originalimage?.source || wikiData.thumbnail?.source || "",
            };
          }
        } catch {}
      }
    }

    // 7. Reddit Post Adapter
    if (!metadataResult && hostname.includes("reddit.com")) {
      try {
        const jsonUrl = targetUrl.pathname.endsWith(".json")
          ? targetUrl.toString()
          : `${targetUrl.origin}${targetUrl.pathname.replace(/\/$/, "")}.json`;
        const redditRes = await fetchWithTimeout(
          jsonUrl,
          { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Markbel/2.1" } },
          4000
        );
        if (redditRes.ok) {
          const redditData: any = await redditRes.json();
          const post = redditData?.[0]?.data?.children?.[0]?.data;
          if (post) {
            let rImage = "";
            if (post.preview?.images?.[0]?.source?.url) {
              rImage = post.preview.images[0].source.url.replace(/&amp;/g, "&");
            } else if (post.thumbnail && post.thumbnail.startsWith("http")) {
              rImage = post.thumbnail;
            }
            metadataResult = {
              title: post.title ? cleanText(post.title) : `Reddit Post`,
              description: post.selftext
                ? cleanText(post.selftext).slice(0, 350)
                : `Reddit post in r/${post.subreddit} by u/${post.author}`,
              image: rImage,
            };
          }
        }
      } catch {}
    }

    // 8. Spotify Adapter
    if (!metadataResult && hostname.includes("spotify.com")) {
      try {
        const spotifyRes = await fetchWithTimeout(
          `https://open.spotify.com/oembed?url=${encodeURIComponent(targetUrl.toString())}`,
          {},
          4000
        );
        if (spotifyRes.ok) {
          const spotifyData: any = await spotifyRes.json();
          metadataResult = {
            title: cleanText(spotifyData.title || "Spotify"),
            description: spotifyData.author_name
              ? `By ${spotifyData.author_name} on Spotify`
              : "Listen on Spotify",
            image: spotifyData.thumbnail_url || "",
          };
        }
      } catch {}
    }

    // 9. Anime & Manga Dedicated Adapter (AniList GraphQL Engine)
    if (!metadataResult) {
      try {
        const animeMeta = await fetchAnimeMetadataFromAniList(targetUrl);
        if (animeMeta && (animeMeta.image || animeMeta.description)) {
          metadataResult = animeMeta;
        }
      } catch {}
    }

    // 10. Standard Web Pages & Enhanced Multi-Source Scraper
    if (!metadataResult) {
      try {
        let response = await fetchWithTimeout(
          targetUrl.toString(),
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
              "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
              "Sec-Ch-Ua-Mobile": "?0",
              "Sec-Ch-Ua-Platform": '"Windows"',
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "cross-site",
              "Sec-Fetch-User": "?1",
              "Upgrade-Insecure-Requests": "1",
            },
          },
          7500
        );

        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);

          let title = "";
          let description = "";
          let image = "";

          // A. Parse JSON-LD Schema.org metadata
          $('script[type="application/ld+json"]').each((_, el) => {
            if (title && description && image) return;
            try {
              const rawJson = $(el).html() || "{}";
              const parsed = JSON.parse(rawJson);
              const items = Array.isArray(parsed) ? parsed : [parsed];

              for (const item of items) {
                if (!title) {
                  title = item.name || item.headline || item.title || "";
                }
                if (!description) {
                  description = item.description || item.abstract || "";
                }
                if (!image) {
                  if (typeof item.image === "string") image = item.image;
                  else if (Array.isArray(item.image) && item.image[0]) {
                    image = typeof item.image[0] === "string" ? item.image[0] : item.image[0].url;
                  } else if (item.image?.url) image = item.image.url;
                  else if (item.thumbnailUrl) image = item.thumbnailUrl;
                  else if (item.video?.[0]?.thumbnailUrl) image = item.video[0].thumbnailUrl;
                }
              }
            } catch {}
          });

          // B. OpenGraph & Twitter Meta Tags (Priority)
          if (!title) {
            title =
              $('meta[property="og:title"]').attr("content") ||
              $('meta[name="og:title"]').attr("content") ||
              $('meta[name="twitter:title"]').attr("content") ||
              $('meta[property="twitter:title"]').attr("content") ||
              $('meta[name="title"]').attr("content") ||
              $("title").first().text() ||
              $("h1").first().text() ||
              targetUrl.hostname.replace(/^www\./, "");
          }

          if (!description) {
            description =
              $('meta[property="og:description"]').attr("content") ||
              $('meta[name="og:description"]').attr("content") ||
              $('meta[name="twitter:description"]').attr("content") ||
              $('meta[property="twitter:description"]').attr("content") ||
              $('meta[name="description"]').attr("content") ||
              $('meta[itemprop="description"]').attr("content") ||
              "";
          }

          if (!image) {
            image =
              $('meta[property="og:image"]').attr("content") ||
              $('meta[property="og:image:secure_url"]').attr("content") ||
              $('meta[property="og:image:url"]').attr("content") ||
              $('meta[name="og:image"]').attr("content") ||
              $('meta[name="twitter:image"]').attr("content") ||
              $('meta[name="twitter:image:src"]').attr("content") ||
              $('meta[itemprop="image"]').attr("content") ||
              $('link[rel="image_src"]').attr("href") ||
              $('link[rel="apple-touch-icon"]').attr("href") ||
              "";
          }

          // C. Fallback: 2-3 Line Description from Article / Main Content
          if (!description || description.length < 25) {
            $("script, style, noscript, nav, header, footer, svg, button, form").remove();
            const paragraphTexts: string[] = [];
            $("article p, main p, .content p, .post-content p, p").each((_, el) => {
              const text = cleanText($(el).text());
              if (text.length > 30 && !text.includes("cookie") && !text.includes("javascript")) {
                paragraphTexts.push(text);
              }
            });
            if (paragraphTexts.length > 0) {
              description = paragraphTexts.slice(0, 3).join(" ");
            }
          }

          // D. Fallback: High Quality Image on Page
          if (!image) {
            $(
              "article img, main img, figure img, [class*='cover'] img, [class*='poster'] img, [class*='thumbnail'] img, [class*='featured'] img, .content img, img"
            ).each((_, el) => {
              if (image) return;
              const src =
                $(el).attr("src") ||
                $(el).attr("data-src") ||
                $(el).attr("data-lazy-src") ||
                $(el).attr("srcset");
              if (
                src &&
                !src.includes("avatar") &&
                !src.includes("logo") &&
                !src.includes("icon") &&
                !src.includes("pixel") &&
                !src.includes("badge") &&
                !src.endsWith(".svg")
              ) {
                const firstSrc = src.split(",")[0].trim().split(" ")[0];
                if (firstSrc.startsWith("http") || firstSrc.startsWith("/")) {
                  image = firstSrc;
                }
              }
            });
          }

          // Resolve relative image URLs
          if (image && !image.startsWith("http")) {
            try {
              image = new URL(image, targetUrl.origin).toString();
            } catch {}
          }

          // Format description to clean 2-3 line length (~250-350 chars)
          let formattedDescription = cleanText(description);
          if (formattedDescription.length > 350) {
            formattedDescription = formattedDescription.slice(0, 347) + "...";
          }

          metadataResult = {
            title: cleanText(title) || targetUrl.hostname.replace(/^www\./, ""),
            description: formattedDescription,
            image: image.trim(),
          };
        }
      } catch {}
    }

    // 11. Anti-Bot / Headless Cloud Renderer Fallback (Microlink API with Screenshot Fallback)
    if (!metadataResult || !metadataResult.image) {
      try {
        const mlHeaders: Record<string, string> = {
          "User-Agent": "MarkbelApp/2.1",
        };
        const microlinkApiKey = (c.env as any).MICROLINK_API_KEY;
        if (microlinkApiKey) {
          mlHeaders["x-api-key"] = microlinkApiKey;
        }

        const encodedUrl = encodeURIComponent(targetUrl.toString());
        const microlinkRes = await fetchWithTimeout(
          `https://api.microlink.io?url=${encodedUrl}&palette=true`,
          { headers: mlHeaders },
          4500
        );

        if (microlinkRes.ok) {
          const mlData: any = await microlinkRes.json();
          if (mlData?.status === "success" && mlData?.data) {
            const ml = mlData.data;
            let mlImage = ml.image?.url || "";

            // If OpenGraph image is missing, request automated page screenshot
            if (!mlImage) {
              try {
                const shotRes = await fetchWithTimeout(
                  `https://api.microlink.io?url=${encodedUrl}&screenshot=true&meta=false`,
                  { headers: mlHeaders },
                  4500
                );
                if (shotRes.ok) {
                  const shotData: any = await shotRes.json();
                  mlImage = shotData.data?.screenshot?.url || "";
                }
              } catch {}
            }

            // If still no image, use high-res publisher logo
            if (!mlImage && ml.logo?.url) {
              mlImage = ml.logo.url;
            }

            const mlTitle = ml.title || (metadataResult ? metadataResult.title : "");
            const mlDesc = ml.description || (metadataResult ? metadataResult.description : "");

            if (mlImage || mlTitle) {
              metadataResult = {
                title: cleanText(mlTitle) || (metadataResult?.title || targetUrl.hostname),
                description: cleanText(mlDesc).slice(0, 350) || (metadataResult?.description || ""),
                image: mlImage || (metadataResult?.image || ""),
              };
            }
          }
        }
      } catch (mlErr) {
        console.warn("[Microlink Fetch Warning]:", mlErr);
      }
    }

    // Smart fallback if anti-bot/CAPTCHA blocked live scraping
    if (!metadataResult) {
      metadataResult = synthesizeMetadataFromUrl(targetUrl);
    }

    // Always ensure high-res favicon if image is still missing
    if (metadataResult && !metadataResult.image) {
      metadataResult.image = `https://www.google.com/s2/favicons?domain=${targetUrl.hostname}&sz=128`;
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
