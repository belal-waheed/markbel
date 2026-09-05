/**
 * Markbel Extension - In-DOM Metadata Extractor (Content Script)
 * Extracts OpenGraph, Twitter card, and selection data directly from the active tab.
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
}

function getMeta(selectors: string[]): string {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const content = el.getAttribute('content') || el.getAttribute('href') || (el as HTMLElement).innerText;
      if (content && content.trim()) {
        return content.trim();
      }
    }
  }
  return '';
}

function resolveAbsoluteUrl(relativeUrl: string): string {
  if (!relativeUrl) return '';
  try {
    return new URL(relativeUrl, window.location.href).href;
  } catch {
    return relativeUrl;
  }
}

function extractYouTubeId(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v') || '';
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1]?.split('/')[0] || '';
      }
    } else if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('/')[0] || '';
    }
  } catch {}
  return '';
}

export function extractPageMetadata(): ExtractedPageMetadata {
  const url = window.location.href;
  const hostname = window.location.hostname.replace(/^www\./, '');

  // 1. Title
  const title =
    getMeta([
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[name="title"]',
      'h1'
    ]) ||
    document.title ||
    hostname;

  // 2. Selection & Description
  const selection = window.getSelection() ? window.getSelection()!.toString().trim() : '';
  const description =
    selection ||
    getMeta([
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]'
    ]);

  // 3. Image & Thumbnail
  let image = getMeta([
    'meta[property="og:image"]',
    'meta[property="og:image:secure_url"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]'
  ]);

  const ytId = extractYouTubeId(url);
  if (ytId && (!image || image.includes('default.jpg'))) {
    image = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }

  if (image) {
    image = resolveAbsoluteUrl(image);
  }

  // 4. Favicon
  let favicon = getMeta([
    'link[rel="apple-touch-icon"]',
    'link[rel="icon"][sizes="32x32"]',
    'link[rel="icon"][sizes="16x16"]',
    'link[rel="icon"]',
    'link[rel="shortcut icon"]'
  ]);

  if (favicon) {
    favicon = resolveAbsoluteUrl(favicon);
  } else {
    favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  }

  // 5. Site Name
  const siteName =
    getMeta([
      'meta[property="og:site_name"]',
      'meta[name="application-name"]'
    ]) || hostname;

  // 6. Canonical URL
  const canonical = getMeta(['link[rel="canonical"]']);
  const finalUrl = canonical ? resolveAbsoluteUrl(canonical) : url;

  return {
    url: finalUrl,
    rawUrl: url,
    title,
    description,
    image,
    favicon,
    siteName,
    selectedText: selection
  };
}

// Global listener for extraction messages from popup or background worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'MARKBEL_EXTRACT_METADATA') {
    try {
      const data = extractPageMetadata();
      sendResponse({ success: true, data });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Extraction failed' });
    }
  }
  return true;
});
