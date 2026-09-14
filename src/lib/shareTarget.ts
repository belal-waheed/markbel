/**
 * PWA Web Share Target Processing & Sanitization Utilities
 */

import { extractInstantMediaMetadata } from './mediaHeuristics';

/**
 * Strips tracking and referral parameters commonly injected by social platforms
 * (e.g. Instagram ?igsh=..., YouTube ?si=..., Twitter ?ref_src=..., UTM tags).
 */
export function sanitizeSharedUrl(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim().replace(/[),.;]+$/, '');
  try {
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = `https://${cleaned}`;
    }
    const parsed = new URL(cleaned);
    const trackingParams = [
      'igsh',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ig_rid',
      'fbclid',
      'gclid',
      'si',
      'feature',
      'ref',
      'ref_src',
    ];
    for (const p of trackingParams) {
      parsed.searchParams.delete(p);
    }
    return parsed.toString();
  } catch {
    return cleaned;
  }
}

/**
 * Extracts clean target URL, fallback title, image, siteName, and notes from raw share target parameters.
 */
export function extractSharePayload(params: {
  rawUrl?: string | null;
  rawText?: string | null;
  rawTitle?: string | null;
}): {
  targetUrl: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
} {
  const rawUrl = (params.rawUrl || '').trim();
  const rawText = (params.rawText || '').trim();
  const rawTitle = (params.rawTitle || '').trim();

  // 1. Detect URL from either 'url' or embedded within 'text'
  let detectedUrl = rawUrl;
  if (!detectedUrl && rawText) {
    const match = rawText.match(/(https?:\/\/[^\s]+)/i);
    if (match) {
      detectedUrl = match[0];
    }
  }

  const targetUrl = sanitizeSharedUrl(detectedUrl);
  const instant = extractInstantMediaMetadata(targetUrl);

  // 2. Resolve Title
  let title = rawTitle;
  if (!title && rawText) {
    const textWithoutUrl = rawText.replace(detectedUrl, '').replace(targetUrl, '').trim();
    if (textWithoutUrl.length > 0) {
      title = textWithoutUrl;
    }
  }

  if (!title && instant.title) {
    title = instant.title;
  }

  if (!title && targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      title = parsed.hostname.replace(/^www\./, '');
    } catch {
      title = targetUrl;
    }
  }

  return {
    targetUrl,
    title,
    description: instant.description || '',
    image: instant.image || '',
    siteName: instant.siteName || '',
  };
}
