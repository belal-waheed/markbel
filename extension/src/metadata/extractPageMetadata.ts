/**
 * Markbel Extension - Page Metadata Extraction Subsystem
 * Extracts OpenGraph, Twitter Cards, canonical URLs, YouTube IDs, and DOM selection.
 */

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
  doc: Document | { querySelector(selector: string): any; title?: string } = typeof document !== 'undefined' ? document : ({} as any),
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
