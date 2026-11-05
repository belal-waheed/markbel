/**
 * Markbel Extension - Page Metadata Extraction Subsystem
 * Extracts OpenGraph, Twitter Cards, canonical URLs, YouTube IDs, and DOM selection.
 */

import { isLowQualityImage } from '@/lib/mediaHeuristics';

export interface ExtractedPageMetadata {
  url: string;
  rawUrl: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
  siteName: string;
  selectedText: string;
  contentType?: string;
}

export function getMeta(
  selectors: string[],
  doc: Document | { querySelector(selector: string): any } = typeof document !== 'undefined' ? document : ({} as any)
): string {
  if (!doc || typeof doc.querySelector !== 'function') return '';
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    if (el) {
      const content =
        (typeof el.getAttribute === 'function' ? (el.getAttribute('content') || el.getAttribute('href')) : null) ||
        el.content ||
        el.href ||
        (el as HTMLElement).innerText ||
        el.textContent;
      if (content && typeof content === 'string' && content.trim()) {
        return content.trim();
      }
    }
  }
  return '';
}

export function resolveAbsoluteUrl(relativeUrl: string, baseHref?: string): string {
  if (!relativeUrl) return '';
  try {
    const base = baseHref || (typeof window !== 'undefined' && window.location ? window.location.href : undefined);
    return new URL(relativeUrl, base).href;
  } catch {
    return relativeUrl;
  }
}

export function extractYouTubeId(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v') || '';
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1]?.split('/')[0]?.split('?')[0] || '';
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1]?.split('/')[0]?.split('?')[0] || '';
      }
    } else if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('/')[0]?.split('?')[0] || '';
    }
  } catch {}
  return '';
}

export function extractPageMetadata(
  doc: Document | { querySelector(selector: string): any; querySelectorAll?(selector: string): any; title?: string } = typeof document !== 'undefined' ? document : ({} as any),
  win: Window | { location: { href: string; hostname: string }; getSelection?(): any } = typeof window !== 'undefined' ? window : ({} as any)
): ExtractedPageMetadata {
  const url = win.location?.href || '';
  const hostname = (win.location?.hostname || '').replace(/^www\./, '');
  const isYouTube = hostname.includes('youtube.com') || hostname === 'youtu.be';

  // 1. Title
  let title = '';
  if (isYouTube) {
    const rawDocTitle = doc.title || (typeof doc.querySelector === 'function' ? doc.querySelector('title')?.textContent || '' : '');
    title = rawDocTitle.replace(/ - YouTube$/, '');
  } else {
    title =
      getMeta([
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        'meta[name="title"]',
        'h1'
      ], doc) ||
      doc.title ||
      (typeof doc.querySelector === 'function' ? doc.querySelector('title')?.textContent || '' : '') ||
      hostname;
  }

  // 2. Selection & Description
  const selection = win.getSelection && win.getSelection() ? win.getSelection()!.toString().trim() : '';
  let description = selection;
  if (!description) {
    description = getMeta([
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]'
    ], doc);
  }

  // 3. Image & Thumbnail
  let image = getMeta([
    'meta[property="og:image"]',
    'meta[property="og:image:secure_url"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]'
  ], doc);

  if (image && isLowQualityImage(image)) {
    image = '';
  }

  // Instagram in-DOM poster extraction for dynamic SPA containers
  if (hostname.includes('instagram.com')) {
    if (typeof doc?.querySelector === 'function') {
      const posterEl = doc.querySelector(
        'article video[poster], video[poster], article img[srcset], div[role="dialog"] video[poster], div[role="dialog"] img[srcset], main img[src*="cdninstagram"]'
      );
      if (posterEl) {
        let candidate =
          (typeof posterEl.getAttribute === 'function' ? (posterEl.getAttribute('poster') || posterEl.getAttribute('src')) : null) ||
          (posterEl as any).poster ||
          (posterEl as any).src;

        if (!candidate && typeof posterEl.getAttribute === 'function') {
          const srcset = posterEl.getAttribute('srcset');
          if (srcset) {
            const entries = srcset.split(',').map((s: string) => s.trim().split(/\s+/)[0]).filter(Boolean);
            if (entries.length > 0) {
              candidate = entries[entries.length - 1];
            }
          }
        }

        if (candidate && !isLowQualityImage(candidate)) {
          image = candidate;
        }
      }
    }
  }

  // Anime3rb JSON-LD schema & in-DOM poster extraction
  if (hostname.includes('anime3rb.com') || (typeof doc?.querySelector === 'function' && doc.querySelector('script[type="application/ld+json"]'))) {
    if (typeof doc?.querySelectorAll === 'function') {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      for (let i = 0; i < scripts.length; i++) {
        try {
          const raw = scripts[i].textContent || (scripts[i] as any).innerText || '{}';
          const parsed = JSON.parse(raw);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            const seriesImg = item?.partOfSeries?.image;
            if (seriesImg) {
              const candidate = typeof seriesImg === 'string' ? seriesImg : seriesImg.url;
              if (candidate && !isLowQualityImage(candidate)) {
                image = candidate;
                break;
              }
            }
          }
        } catch {}
      }
    }

    if (!image && typeof doc?.querySelector === 'function') {
      const animePosterEl = doc.querySelector('img[alt*="بوستر"], img[alt*="poster"], .anime-poster img');
      if (animePosterEl) {
        const posterSrc =
          (typeof animePosterEl.getAttribute === 'function'
            ? (animePosterEl.getAttribute('src') || animePosterEl.getAttribute('data-src'))
            : null) || (animePosterEl as any).src;
        if (posterSrc && !isLowQualityImage(posterSrc)) {
          image = posterSrc;
        }
      }
    }
  }

  // Map video.vid3rb.com/video/<uuid> directly to thumbnails.vid3rb.com static JPEG poster
  if (image && image.includes('video.vid3rb.com/video/')) {
    const uuidMatch = image.match(/video\/([a-f0-9\-]+)/i);
    if (uuidMatch && uuidMatch[1]) {
      const prefix = uuidMatch[1].split('-')[0];
      if (prefix) {
        image = `https://thumbnails.vid3rb.com/${prefix}/thumbnail.001.jpeg`;
      }
    }
  }

  const ytId = extractYouTubeId(url);
  if (ytId) {
    image = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }

  if (image) {
    image = resolveAbsoluteUrl(image, url);
  }

  // 4. Favicon
  let favicon = getMeta([
    'link[rel="apple-touch-icon"]',
    'link[rel="icon"][sizes="32x32"]',
    'link[rel="icon"][sizes="16x16"]',
    'link[rel="icon"]',
    'link[rel="shortcut icon"]'
  ], doc);

  if (favicon) {
    favicon = resolveAbsoluteUrl(favicon, url);
  } else if (hostname) {
    favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  }

  // 5. Site Name
  const siteName =
    getMeta([
      'meta[property="og:site_name"]',
      'meta[name="application-name"]'
    ], doc) || hostname;

  // 6. Canonical URL
  const canonical = getMeta(['link[rel="canonical"]'], doc);
  let finalUrl = canonical ? resolveAbsoluteUrl(canonical, url) : url;

  if (isYouTube) {
    finalUrl = url;
  }

  let contentType: string | undefined = undefined;
  if (isYouTube) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.searchParams.has('list') || parsedUrl.pathname.startsWith('/playlist')) {
        contentType = 'playlist';
      } else if (parsedUrl.searchParams.has('v') || parsedUrl.pathname.startsWith('/shorts/') || parsedUrl.pathname.startsWith('/embed/')) {
        contentType = 'video';
      } else {
        contentType = 'video';
      }
    } catch {
      contentType = 'video';
    }
  } else if (getMeta(['meta[property="og:type"]'], doc) === 'article') {
    contentType = 'article';
  }

  return {
    url: finalUrl,
    rawUrl: url,
    title,
    description,
    image,
    favicon,
    siteName,
    selectedText: selection,
    contentType
  };
}
