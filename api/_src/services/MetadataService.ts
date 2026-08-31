import * as cheerio from 'cheerio';
import { extractFromHtml as extractArticleFromHtml } from '@extractus/article-extractor';
import { extract as extractOembed, hasProvider } from '@extractus/oembed-extractor';

export type BookmarkContentType = 'article' | 'video' | 'audio' | 'tweet' | 'code' | 'website';

export interface BookmarkMetadata {
  url: string;
  canonicalUrl: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
  siteName: string;
  author: string;
  publishedAt: string;
  contentType: BookmarkContentType;
  readingTime: number; // in minutes
  wordCount: number;
  articleContent?: string;
}

export interface MetadataScrapeOptions {
  timeoutMs?: number;
  includeArticleContent?: boolean;
  userAgent?: string;
}

export class SSRFValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFValidationError';
  }
}

/**
 * Validates whether a target URL is safe to fetch (blocks SSRF, private CIDR ranges, metadata endpoints).
 */
export function isSafePublicUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Block localhost, loopback, and zero addresses
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '0:0:0:0:0:0:0:0' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }

    // Block cloud metadata services (AWS, GCP, Azure, DigitalOcean)
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
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
    if (hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Removes tracking parameters (UTM, fbclid, gclid, etc.) from a URL while preserving core content parameters.
 */
export function sanitizeAndCleanUrl(rawUrl: string): { targetUrl: URL; cleanUrlStr: string } {
  let formatted = rawUrl.trim();
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `https://${formatted}`;
  }

  const targetUrl = new URL(formatted);

  const TRACKING_PARAMS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'fbclid',
    'gclid',
    'gclsrc',
    'dclid',
    'wbraid',
    'gbraid',
    'igshid',
    'mc_cid',
    'mc_eid',
    'msclkid',
    'twclid',
    '_hsenc',
    '_hsmi',
    'mkt_tok',
    'vero_id',
  ];

  for (const param of TRACKING_PARAMS) {
    targetUrl.searchParams.delete(param);
  }

  // Also remove YouTube tracking if present but keep video id
  if (
    targetUrl.hostname.includes('youtube.com') ||
    targetUrl.hostname.includes('youtu.be')
  ) {
    targetUrl.searchParams.delete('si');
    targetUrl.searchParams.delete('feature');
    targetUrl.searchParams.delete('pp');
  }

  return {
    targetUrl,
    cleanUrlStr: targetUrl.toString(),
  };
}

/**
 * Cleans escaped HTML entities and normalizes whitespace.
 */
export function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Synthesizes default fallback metadata when scraping fails.
 */
export function synthesizeFallbackMetadata(targetUrl: URL): BookmarkMetadata {
  const domain = targetUrl.hostname.replace(/^www\./, '');
  const path = targetUrl.pathname.replace(/^\/|\/$/g, '');
  const segments = path.split('/').filter(Boolean);
  let derivedTitle = domain;

  if (segments.length > 0) {
    const lastSeg = decodeURIComponent(segments[segments.length - 1])
      .replace(/[-_]+/g, ' ')
      .replace(/\.[a-zA-Z0-9]+$/, '');
    if (lastSeg.length > 2) {
      derivedTitle = `${lastSeg.charAt(0).toUpperCase() + lastSeg.slice(1)} | ${domain}`;
    }
  }

  return {
    url: targetUrl.toString(),
    canonicalUrl: targetUrl.toString(),
    title: derivedTitle,
    description: `Saved link from ${domain}`,
    image: `https://www.google.com/s2/favicons?domain=${targetUrl.hostname}&sz=128`,
    favicon: `https://www.google.com/s2/favicons?domain=${targetUrl.hostname}&sz=128`,
    siteName: domain,
    author: '',
    publishedAt: '',
    contentType: 'website',
    readingTime: 0,
    wordCount: 0,
  };
}

/**
 * Unified MetadataService for comprehensive bookmark metadata extraction.
 */
export class MetadataService {
  private static defaultUserAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MarkbelApp/2.1';

  /**
   * Main entry point to extract rich metadata for a given URL.
   */
  public static async extractMetadata(
    rawUrl: string,
    options: MetadataScrapeOptions = {}
  ): Promise<BookmarkMetadata> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new Error('URL parameter is required');
    }

    const { targetUrl, cleanUrlStr } = sanitizeAndCleanUrl(rawUrl);

    if (!isSafePublicUrl(targetUrl.toString())) {
      throw new SSRFValidationError('SSRF validation failed: Access to private or loopback networks is prohibited');
    }

    const hostname = targetUrl.hostname.toLowerCase();
    const timeoutMs = options.timeoutMs ?? 5000;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TIER 1: DEDICATED MEDIA & PROVIDER ADAPTERS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // 1. YouTube Adapter (Videos, Shorts, Embeds)
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      const ytResult = await this.extractYouTube(targetUrl, timeoutMs);
      if (ytResult) return ytResult;
    }

    // 2. TikTok Adapter
    if (hostname.includes('tiktok.com')) {
      const tiktokResult = await this.extractTikTok(targetUrl, timeoutMs);
      if (tiktokResult) return tiktokResult;
    }

    // 3. Twitter / X Adapter
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      const xResult = await this.extractTwitterX(targetUrl, timeoutMs);
      if (xResult) {
        if (!xResult.image || xResult.image.includes('google.com/s2/favicons')) {
          const ml = await this.extractMicrolink(targetUrl, cleanUrlStr, timeoutMs, options);
          if (ml?.image) {
            xResult.image = ml.image;
          }
        }
        return xResult;
      }
    }

    // 4. GitHub Repository Adapter
    if (hostname === 'github.com' || hostname.endsWith('.github.com')) {
      const ghResult = await this.extractGitHub(targetUrl, timeoutMs);
      if (ghResult) return ghResult;
    }

    // 5. Wikipedia Article Adapter
    if (hostname.includes('wikipedia.org')) {
      const wikiResult = await this.extractWikipedia(targetUrl, timeoutMs);
      if (wikiResult) return wikiResult;
    }

    // 6. Reddit Adapter
    if (hostname.includes('reddit.com')) {
      const redditResult = await this.extractReddit(targetUrl, timeoutMs);
      if (redditResult) return redditResult;
    }

    // 7. Spotify Adapter
    if (hostname.includes('spotify.com')) {
      const spotifyResult = await this.extractSpotify(targetUrl, timeoutMs);
      if (spotifyResult) return spotifyResult;
    }

    // 8. Generic oEmbed Provider Check
    if (hasProvider(targetUrl.toString())) {
      try {
        const oembedData = await extractOembed(targetUrl.toString(), {}, async (url) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            return await fetch(url, { signal: controller.signal });
          } finally {
            clearTimeout(timer);
          }
        });

        if (oembedData && (oembedData.title || oembedData.thumbnail_url)) {
          let contentType: BookmarkContentType = 'website';
          if (oembedData.type === 'video') contentType = 'video';
          else if (oembedData.type === 'photo') contentType = 'article';
          else if (oembedData.type === 'rich') contentType = 'article';

          return {
            url: cleanUrlStr,
            canonicalUrl: cleanUrlStr,
            title: cleanText(oembedData.title || targetUrl.hostname),
            description: oembedData.author_name ? `By ${oembedData.author_name}` : '',
            image: oembedData.thumbnail_url || '',
            favicon: `https://www.google.com/s2/favicons?domain=${targetUrl.hostname}&sz=128`,
            siteName: oembedData.provider_name || targetUrl.hostname.replace(/^www\./, ''),
            author: oembedData.author_name || '',
            publishedAt: '',
            contentType,
            readingTime: 0,
            wordCount: 0,
          };
        }
      } catch {
        // Fall through to general HTML scraper
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TIER 2: GENERAL HTML SCRAPING & JSON-LD + OPENGRAPH + READABILITY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    let htmlResult: BookmarkMetadata | null = null;
    try {
      htmlResult = await this.scrapeHtmlAndArticle(
        targetUrl,
        cleanUrlStr,
        timeoutMs,
        options
      );
      if (htmlResult && htmlResult.image && !htmlResult.image.includes('google.com/s2/favicons')) {
        return htmlResult;
      }
    } catch {
      // Fall through to Tier 3 Microlink
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TIER 3: ANTI-BOT & HEADLESS SCREENSHOT ENGINE (MICROLINK API)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    try {
      const mlResult = await this.extractMicrolink(
        targetUrl,
        cleanUrlStr,
        timeoutMs,
        options
      );
      if (mlResult) {
        if (htmlResult) {
          // Merge rich article content from Tier 2 with rich cover image from Microlink
          return {
            ...htmlResult,
            image: mlResult.image || htmlResult.image,
            title: htmlResult.title || mlResult.title,
            description: htmlResult.description || mlResult.description,
          };
        }
        return mlResult;
      }
    } catch {
      // Fallback
    }

    if (htmlResult) {
      return htmlResult;
    }

    return synthesizeFallbackMetadata(targetUrl);
  }

  /**
   * Tier 3 Anti-Bot / Headless Cloud Renderer Fallback using Microlink API.
   */
  public static async extractMicrolink(
    targetUrl: URL,
    cleanUrlStr: string,
    timeoutMs: number = 4500,
    options: MetadataScrapeOptions = {}
  ): Promise<BookmarkMetadata | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'User-Agent': 'MarkbelMetadataEngine/2.1',
    };
    const apiKey = typeof process !== 'undefined' ? process.env?.MICROLINK_API_KEY : undefined;
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    try {
      const encoded = encodeURIComponent(targetUrl.toString());
      const res = await fetch(`https://api.microlink.io?url=${encoded}&palette=true`, {
        headers,
        signal: controller.signal,
      });

      if (!res.ok) return null;

      const body: any = await res.json();
      if (body.status !== 'success' || !body.data) return null;

      const data = body.data;
      let imageUrl = data.image?.url || '';

      // If OpenGraph image is missing, request automated page screenshot
      if (!imageUrl) {
        try {
          const shotRes = await fetch(`https://api.microlink.io?url=${encoded}&screenshot=true&meta=false`, {
            headers,
            signal: controller.signal,
          });
          if (shotRes.ok) {
            const shotBody: any = await shotRes.json();
            imageUrl = shotBody.data?.screenshot?.url || '';
          }
        } catch {}
      }

      if (!imageUrl && data.logo?.url) {
        imageUrl = data.logo.url;
      }

      const domain = targetUrl.hostname.replace(/^www\./, '');
      const title = cleanText(data.title) || domain;
      const description = cleanText(data.description).slice(0, 350) || `Saved link from ${domain}`;
      const favicon = data.logo?.url || `https://www.google.com/s2/favicons?domain=${targetUrl.hostname}&sz=128`;

      return {
        url: cleanUrlStr,
        canonicalUrl: data.url || cleanUrlStr,
        title,
        description,
        image: imageUrl || favicon,
        favicon,
        siteName: data.publisher || domain,
        author: data.author || '',
        publishedAt: data.date || '',
        contentType: 'website',
        readingTime: 0,
        wordCount: 0,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Scrapes HTML, parses JSON-LD Schema.org, OpenGraph, Twitter Cards, and extracts article content via @extractus/article-extractor.
   */
  private static async scrapeHtmlAndArticle(
    targetUrl: URL,
    cleanUrlStr: string,
    timeoutMs: number,
    options: MetadataScrapeOptions
  ): Promise<BookmarkMetadata | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let html = '';
    let resolvedUrl = targetUrl.toString();

    try {
      const userAgent =
        options.userAgent ||
        (targetUrl.hostname.includes('facebook.com') || targetUrl.hostname.includes('instagram.com')
          ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_codedoc.html)'
          : this.defaultUserAgent);

      const response = await fetch(targetUrl.toString(), {
        headers: {
          'User-Agent': userAgent,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      if (!response.ok) {
        return null;
      }

      resolvedUrl = response.url || targetUrl.toString();
      html = await response.text();
    } finally {
      clearTimeout(timer);
    }

    if (!html) return null;

    const $ = cheerio.load(html);

    // 1. Extract JSON-LD (Schema.org)
    let jsonLdTitle = '';
    let jsonLdDesc = '';
    let jsonLdImage = '';
    let jsonLdAuthor = '';
    let jsonLdSiteName = '';
    let jsonLdPublishedAt = '';
    let jsonLdType: BookmarkContentType | null = null;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const rawJson = $(el).html() || '{}';
        const parsed = JSON.parse(rawJson);
        const items = Array.isArray(parsed) ? parsed : [parsed];

        for (const item of items) {
          const type = item['@type'];
          if (type) {
            const lowerType = String(type).toLowerCase();
            if (
              lowerType.includes('article') ||
              lowerType.includes('newsarticle') ||
              lowerType.includes('blogposting')
            ) {
              jsonLdType = 'article';
            } else if (lowerType.includes('video') || lowerType.includes('videoobject')) {
              jsonLdType = 'video';
            } else if (lowerType.includes('audio') || lowerType.includes('music')) {
              jsonLdType = 'audio';
            } else if (lowerType.includes('software') || lowerType.includes('code')) {
              jsonLdType = 'code';
            }
          }

          if (!jsonLdTitle) {
            jsonLdTitle = item.headline || item.name || item.title || '';
          }
          if (!jsonLdDesc) {
            jsonLdDesc = item.description || item.abstract || '';
          }
          if (!jsonLdImage) {
            if (typeof item.image === 'string') jsonLdImage = item.image;
            else if (Array.isArray(item.image) && item.image[0]) {
              jsonLdImage = typeof item.image[0] === 'string' ? item.image[0] : item.image[0].url;
            } else if (item.image?.url) jsonLdImage = item.image.url;
            else if (item.thumbnailUrl) jsonLdImage = item.thumbnailUrl;
          }
          if (!jsonLdAuthor) {
            if (typeof item.author === 'string') jsonLdAuthor = item.author;
            else if (Array.isArray(item.author) && item.author[0]?.name) {
              jsonLdAuthor = item.author[0].name;
            } else if (item.author?.name) jsonLdAuthor = item.author.name;
          }
          if (!jsonLdSiteName) {
            if (typeof item.publisher === 'string') jsonLdSiteName = item.publisher;
            else if (item.publisher?.name) jsonLdSiteName = item.publisher.name;
          }
          if (!jsonLdPublishedAt) {
            jsonLdPublishedAt = item.datePublished || item.dateCreated || '';
          }
        }
      } catch {}
    });

    // 2. Extract OpenGraph & Twitter Meta Tags
    const ogTitle = $('meta[property="og:title"]').attr('content') || $('meta[name="og:title"]').attr('content');
    const twitterTitle = $('meta[name="twitter:title"]').attr('content') || $('meta[property="twitter:title"]').attr('content');
    const htmlTitle = $('title').first().text() || $('h1').first().text();

    const ogDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="og:description"]').attr('content');
    const twitterDesc = $('meta[name="twitter:description"]').attr('content') || $('meta[property="twitter:description"]').attr('content');
    const htmlMetaDesc = $('meta[name="description"]').attr('content') || $('meta[itemprop="description"]').attr('content');

    let ogImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="og:image:secure_url"]').attr('content') ||
      $('meta[property="og:image:url"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image:src"]').attr('content') ||
      $('meta[itemprop="image"]').attr('content') ||
      $('link[rel="image_src"]').attr('href');

    const ogSiteName = $('meta[property="og:site_name"]').attr('content') || '';
    const ogAuthor =
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      $('meta[name="twitter:creator"]').attr('content') ||
      '';
    const ogPublishedAt =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="publish_date"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      '';
    const canonicalLink = $('link[rel="canonical"]').attr('href') || resolvedUrl;
    const ogType = $('meta[property="og:type"]').attr('content') || '';

    // 3. Extract Favicon
    let favicon =
      $('link[rel="apple-touch-icon"]').attr('href') ||
      $('link[rel="apple-touch-icon-precomposed"]').attr('href') ||
      $('link[rel="icon"][type="image/svg+xml"]').attr('href') ||
      $('link[rel="icon"][type="image/png"]').attr('href') ||
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      '';

    if (favicon && !favicon.startsWith('http')) {
      try {
        favicon = new URL(favicon, targetUrl.origin).toString();
      } catch {
        favicon = '';
      }
    }
    if (!favicon) {
      favicon = `https://www.google.com/s2/favicons?domain=${targetUrl.hostname}&sz=128`;
    }

    // 4. Resolve relative Image URL
    let finalImage = jsonLdImage || ogImage || '';
    if (finalImage && !finalImage.startsWith('http')) {
      try {
        finalImage = new URL(finalImage, targetUrl.origin).toString();
      } catch {
        finalImage = '';
      }
    }

    // 5. Run @extractus/article-extractor for Reader Mode & Reading Time
    let articleData: any = null;
    try {
      articleData = await extractArticleFromHtml(html, targetUrl.toString());
    } catch {}

    // Determine Title
    const title = cleanText(
      jsonLdTitle || ogTitle || twitterTitle || articleData?.title || htmlTitle || targetUrl.hostname.replace(/^www\./, '')
    );

    // Determine Description
    let description = cleanText(
      jsonLdDesc || ogDesc || twitterDesc || articleData?.description || htmlMetaDesc || ''
    );

    // Fallback: 2-3 line body paragraph excerpt if description is too short
    if (!description || description.length < 25) {
      $('script, style, noscript, nav, header, footer, svg, button, form').remove();
      const pTexts: string[] = [];
      $('article p, main p, .content p, .post-content p, p').each((_, el) => {
        const text = cleanText($(el).text());
        if (text.length > 30 && !text.includes('cookie') && !text.includes('javascript')) {
          pTexts.push(text);
        }
      });
      if (pTexts.length > 0) {
        description = pTexts.slice(0, 3).join(' ');
      }
    }

    if (description.length > 350) {
      description = description.slice(0, 347) + '...';
    }

    // Fallback: Lead Image in HTML body
    if (!finalImage) {
      $(
        'article img, main img, figure img, [class*="cover"] img, [class*="poster"] img, [class*="thumbnail"] img, [class*="featured"] img, .content img, img'
      ).each((_, el) => {
        if (finalImage) return;
        const src =
          $(el).attr('src') ||
          $(el).attr('data-src') ||
          $(el).attr('data-lazy-src') ||
          $(el).attr('srcset');
        if (
          src &&
          !src.includes('avatar') &&
          !src.includes('logo') &&
          !src.includes('icon') &&
          !src.includes('pixel') &&
          !src.includes('badge') &&
          !src.endsWith('.svg')
        ) {
          const firstSrc = src.split(',')[0].trim().split(' ')[0];
          if (firstSrc.startsWith('http') || firstSrc.startsWith('/')) {
            finalImage = firstSrc;
          }
        }
      });

      if (finalImage && !finalImage.startsWith('http')) {
        try {
          finalImage = new URL(finalImage, targetUrl.origin).toString();
        } catch {}
      }
    }

    // Fallback image to favicon if none found
    if (!finalImage) {
      finalImage = favicon;
    }

    // Determine Content Type
    let contentType: BookmarkContentType = 'website';
    if (jsonLdType) {
      contentType = jsonLdType;
    } else if (ogType.includes('video') || targetUrl.pathname.endsWith('.mp4')) {
      contentType = 'video';
    } else if (ogType.includes('music') || ogType.includes('audio') || targetUrl.pathname.endsWith('.mp3')) {
      contentType = 'audio';
    } else if (
      ogType.includes('article') ||
      articleData?.type === 'article' ||
      $('article').length > 0 ||
      (articleData?.content && articleData.content.length > 300)
    ) {
      contentType = 'article';
    }

    // Calculate Reading Time & Word Count
    let wordCount = 0;
    let readingTime = 0;
    if (articleData?.content) {
      const textOnly = articleData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const words = textOnly.split(/\s+/).filter(Boolean);
      wordCount = words.length;
      if (articleData.ttr) {
        readingTime = Math.max(1, Math.round(articleData.ttr / 60));
      } else if (wordCount > 0) {
        readingTime = Math.max(1, Math.ceil(wordCount / 225));
      }
    }

    const author = cleanText(jsonLdAuthor || ogAuthor || articleData?.author || '');
    const siteName = cleanText(
      jsonLdSiteName || ogSiteName || articleData?.source || targetUrl.hostname.replace(/^www\./, '')
    );
    const publishedAt = jsonLdPublishedAt || ogPublishedAt || articleData?.published || '';

    return {
      url: cleanUrlStr,
      canonicalUrl: canonicalLink.startsWith('http') ? canonicalLink : cleanUrlStr,
      title: title || targetUrl.hostname.replace(/^www\./, ''),
      description,
      image: finalImage.trim(),
      favicon,
      siteName,
      author,
      publishedAt,
      contentType,
      readingTime,
      wordCount,
      articleContent: options.includeArticleContent ? articleData?.content : undefined,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SPECIFIC MEDIA ADAPTERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private static async extractYouTube(targetUrl: URL, timeoutMs: number): Promise<BookmarkMetadata | null> {
    let ytId: string | null = null;
    if (targetUrl.pathname.startsWith('/shorts/')) {
      ytId = targetUrl.pathname.split('/')[2]?.split('?')[0] || null;
    } else if (targetUrl.pathname.startsWith('/watch')) {
      ytId = targetUrl.searchParams.get('v');
    } else if (targetUrl.pathname.startsWith('/embed/')) {
      ytId = targetUrl.pathname.split('/')[2]?.split('?')[0] || null;
    } else if (targetUrl.hostname.includes('youtu.be')) {
      ytId = targetUrl.pathname.slice(1).split('/')[0]?.split('?')[0] || null;
    }

    if (!ytId) return null;

    const thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    let ytTitle = targetUrl.pathname.startsWith('/shorts/') ? 'YouTube Short' : 'YouTube Video';
    let ytAuthor = '';

    const watchUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${watchUrl}&format=json`,
        { signal: controller.signal }
      );
      clearTimeout(timer);

      if (oembedRes.ok) {
        const oembedData: any = await oembedRes.json();
        if (oembedData.title) ytTitle = oembedData.title;
        if (oembedData.author_name) ytAuthor = oembedData.author_name;
      }
    } catch {}

    return {
      url: targetUrl.toString(),
      canonicalUrl: `https://www.youtube.com/watch?v=${ytId}`,
      title: cleanText(ytTitle),
      description: ytAuthor ? `By ${ytAuthor} on YouTube` : 'YouTube Video',
      image: thumbnail,
      favicon: 'https://www.youtube.com/s/desktop/f17dc94c/img/favicon.ico',
      siteName: 'YouTube',
      author: ytAuthor,
      publishedAt: '',
      contentType: 'video',
      readingTime: 0,
      wordCount: 0,
    };
  }

  private static async extractTikTok(targetUrl: URL, timeoutMs: number): Promise<BookmarkMetadata | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const oembedRes = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl.toString())}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);

      if (oembedRes.ok) {
        const oembedData: any = await oembedRes.json();
        const author = oembedData.author_unique_id || oembedData.author_name || '';
        return {
          url: targetUrl.toString(),
          canonicalUrl: targetUrl.toString(),
          title: cleanText(oembedData.title || `TikTok by @${author}`),
          description: author ? `@${author} on TikTok` : 'TikTok Video',
          image: oembedData.thumbnail_url || '',
          favicon: 'https://sf-tb-sg.ibytedtos.com/obj/eden-sg/uomwuhz/pwa/favicon.ico',
          siteName: 'TikTok',
          author,
          publishedAt: '',
          contentType: 'video',
          readingTime: 0,
          wordCount: 0,
        };
      }
    } catch {}
    return null;
  }

  private static async extractTwitterX(targetUrl: URL, timeoutMs: number): Promise<BookmarkMetadata | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const oembedRes = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(targetUrl.toString())}&omit_script=true`,
        { signal: controller.signal }
      );
      clearTimeout(timer);

      if (oembedRes.ok) {
        const oembedData: any = await oembedRes.json();
        const plainText = (oembedData.html || '').replace(/<[^>]*>?/gm, '').trim();
        const author = oembedData.author_name || '';
        return {
          url: targetUrl.toString(),
          canonicalUrl: targetUrl.toString(),
          title: author ? `Post by ${author}` : 'Post on X',
          description: cleanText(plainText).slice(0, 300),
          image: '',
          favicon: 'https://abs.twimg.com/favicons/twitter.3.ico',
          siteName: 'X (Twitter)',
          author,
          publishedAt: '',
          contentType: 'tweet',
          readingTime: 1,
          wordCount: plainText.split(/\s+/).length,
        };
      }
    } catch {}
    return null;
  }

  private static async extractGitHub(targetUrl: URL, timeoutMs: number): Promise<BookmarkMetadata | null> {
    const pathParts = targetUrl.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      const [owner, repo] = pathParts;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { 'User-Agent': 'MarkbelApp/2.1' },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (ghRes.ok) {
          const ghData: any = await ghRes.json();
          return {
            url: targetUrl.toString(),
            canonicalUrl: `https://github.com/${owner}/${repo}`,
            title: `${owner}/${repo}`,
            description: ghData.description || `GitHub repository by ${owner}`,
            image: `https://opengraph.githubassets.com/1/${owner}/${repo}`,
            favicon: 'https://github.githubassets.com/favicons/favicon.png',
            siteName: 'GitHub',
            author: owner,
            publishedAt: ghData.created_at || '',
            contentType: 'code',
            readingTime: 0,
            wordCount: 0,
          };
        }
      } catch {}
    }
    return null;
  }

  private static async extractWikipedia(targetUrl: URL, timeoutMs: number): Promise<BookmarkMetadata | null> {
    const pathParts = targetUrl.pathname.split('/wiki/').filter(Boolean);
    if (pathParts.length >= 1) {
      const titleKey = pathParts[pathParts.length - 1];
      try {
        const lang = targetUrl.hostname.split('.')[0] || 'en';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const wikiRes = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titleKey)}`,
          {
            headers: { 'User-Agent': 'MarkbelApp/2.1' },
            signal: controller.signal,
          }
        );
        clearTimeout(timer);

        if (wikiRes.ok) {
          const wikiData: any = await wikiRes.json();
          const extract = wikiData.extract || '';
          const words = extract.split(/\s+/).filter(Boolean).length;
          return {
            url: targetUrl.toString(),
            canonicalUrl: wikiData.content_urls?.desktop?.page || targetUrl.toString(),
            title: cleanText(wikiData.title || titleKey),
            description: cleanText(extract).slice(0, 350),
            image: wikiData.originalimage?.source || wikiData.thumbnail?.source || '',
            favicon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
            siteName: 'Wikipedia',
            author: 'Wikipedia contributors',
            publishedAt: wikiData.timestamp || '',
            contentType: 'article',
            readingTime: Math.max(1, Math.ceil(words / 225)),
            wordCount: words,
          };
        }
      } catch {}
    }
    return null;
  }

  private static async extractReddit(targetUrl: URL, timeoutMs: number): Promise<BookmarkMetadata | null> {
    try {
      const jsonUrl = targetUrl.pathname.endsWith('.json')
        ? targetUrl.toString()
        : `${targetUrl.origin}${targetUrl.pathname.replace(/\/$/, '')}.json`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const redditRes = await fetch(jsonUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 MarkbelApp/2.1' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (redditRes.ok) {
        const redditData: any = await redditRes.json();
        const post = redditData?.[0]?.data?.children?.[0]?.data;
        if (post) {
          let rImage = '';
          if (post.preview?.images?.[0]?.source?.url) {
            rImage = post.preview.images[0].source.url.replace(/&amp;/g, '&');
          } else if (post.thumbnail && post.thumbnail.startsWith('http')) {
            rImage = post.thumbnail;
          }

          const desc = post.selftext
            ? cleanText(post.selftext).slice(0, 350)
            : `Reddit post in r/${post.subreddit} by u/${post.author}`;

          const words = (post.selftext || '').split(/\s+/).filter(Boolean).length;

          return {
            url: targetUrl.toString(),
            canonicalUrl: `https://www.reddit.com${post.permalink}`,
            title: cleanText(post.title || 'Reddit Post'),
            description: desc,
            image: rImage || 'https://www.redditstatic.com/shreddit/assets/favicon/192x192.png',
            favicon: 'https://www.redditstatic.com/shreddit/assets/favicon/192x192.png',
            siteName: `r/${post.subreddit}`,
            author: `u/${post.author}`,
            publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : '',
            contentType: 'article',
            readingTime: Math.max(1, Math.ceil(words / 225)),
            wordCount: words,
          };
        }
      }
    } catch {}
    return null;
  }

  private static async extractSpotify(targetUrl: URL, timeoutMs: number): Promise<BookmarkMetadata | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const spotifyRes = await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(targetUrl.toString())}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);

      if (spotifyRes.ok) {
        const spotifyData: any = await spotifyRes.json();
        return {
          url: targetUrl.toString(),
          canonicalUrl: targetUrl.toString(),
          title: cleanText(spotifyData.title || 'Spotify'),
          description: spotifyData.author_name
            ? `By ${spotifyData.author_name} on Spotify`
            : 'Listen on Spotify',
          image: spotifyData.thumbnail_url || '',
          favicon: 'https://open.spotifycdn.com/cdn/images/favicon.0f31d2ea.ico',
          siteName: 'Spotify',
          author: spotifyData.author_name || '',
          publishedAt: '',
          contentType: 'audio',
          readingTime: 0,
          wordCount: 0,
        };
      }
    } catch {}
    return null;
  }
}
