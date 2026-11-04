import * as cheerio from "cheerio";

export interface MetadataScraperEnv {
  MICROLINK_API_KEY?: string;
  [key: string]: unknown;
}

export interface ScrapedMetadata {
  title: string;
  description: string;
  image: string;
}

export async function fetchWithTimeout(
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

export function decodeHtmlEntities(str: string): string {
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

export function cleanText(str: string): string {
  if (!str) return "";
  return decodeHtmlEntities(str.replace(/\s+/g, " ").trim());
}

export function synthesizeMetadataFromUrl(targetUrl: URL): ScrapedMetadata {
  const rawSegments = targetUrl.pathname
    .split("/")
    .filter(Boolean)
    .map((seg) => decodeURIComponent(seg).replace(/[-_+]/g, " ").replace(/\.[a-zA-Z0-9]+$/, "").trim())
    .filter((seg) => seg.length > 0);

  const domainParts = targetUrl.hostname.replace(/^www\./, "").split(".");
  const domainName = domainParts.length > 1 ? domainParts[0] : targetUrl.hostname;
  const capitalizedDomain = domainName.charAt(0).toUpperCase() + domainName.slice(1);

  if (rawSegments.length > 0) {
    const formattedSegments = rawSegments.map((s) =>
      s.replace(/\b\w/g, (l) => l.toUpperCase())
    );
    const synthesizedTitle = `${formattedSegments.join(" - ")} | ${capitalizedDomain}`;
    return {
      title: synthesizedTitle,
      description: `Saved link from ${targetUrl.hostname} (${formattedSegments.join(" / ")})`,
      image: "",
    };
  }

  return {
    title: capitalizedDomain || targetUrl.hostname.replace(/^www\./, ""),
    description: `Saved link from ${targetUrl.hostname}`,
    image: "",
  };
}

export async function fetchAnimeMetadataFromAniList(
  targetUrl: URL
): Promise<ScrapedMetadata | null> {
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
 * Extracts rich metadata for a given target URL using dedicated platform adapters,
 * OpenGraph Cheerio parsing, and fallback layers.
 */
export async function extractMetadata(
  targetUrl: URL,
  env?: MetadataScraperEnv
): Promise<ScrapedMetadata | null> {
  const hostname = targetUrl.hostname.toLowerCase();
  let metadataResult: ScrapedMetadata | null = null;

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
      const response = await fetchWithTimeout(
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
      const microlinkApiKey = (env as any)?.MICROLINK_API_KEY;
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

  return metadataResult;
}
