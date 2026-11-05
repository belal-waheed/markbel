/**
 * High-resolution vector gradient card data URI for Instagram media fallbacks.
 * Prevents broken icon states when Instagram SPA obscures raw poster assets.
 */
export const INSTAGRAM_FALLBACK_POSTER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4f5bd5"/>
      <stop offset="25%" stop-color="#962fbf"/>
      <stop offset="50%" stop-color="#d62976"/>
      <stop offset="75%" stop-color="#fa7e1e"/>
      <stop offset="100%" stop-color="#feda75"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#ig-grad)"/>
  <rect width="640" height="360" fill="rgba(0,0,0,0.2)"/>
  <g fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" transform="translate(270, 130)">
    <rect x="0" y="0" width="100" height="100" rx="26" ry="26"/>
    <circle cx="50" cy="50" r="23"/>
    <circle cx="76" cy="24" r="3" fill="#ffffff" stroke="none"/>
  </g>
</svg>`.trim()
  );

/**
 * Pure, zero-network deterministic metadata heuristics for media platforms.
 * Extracts instant high-fidelity titles, thumbnails, and platform origins.
 */

export interface InstantMediaMetadata {
  image?: string;
  title?: string;
  description?: string;
  siteName?: string;
  contentType?: 'article' | 'video' | 'audio' | 'tweet' | 'code' | 'website' | 'playlist';
}

const GITHUB_RESERVED_SEGMENTS = new Set([
  'settings',
  'orgs',
  'features',
  'pricing',
  'explore',
  'topics',
  'trending',
  'collections',
  'events',
  'about',
  'contact',
  'security',
  'login',
  'signup',
  'marketplace',
  'notifications',
  'search',
  'pulls',
  'issues',
]);

/**
 * Upgrades insecure http:// image URLs to https:// to prevent mixed-content blocks
 * in strict environments such as Android WebViews and HTTPS PWA contexts.
 * Preserves local/private loopback origins (localhost, 127.0.0.1) as HTTP.
 */
export function upgradeInsecureImageUrl(imageUrl?: string | null): string | undefined {
  if (!imageUrl || typeof imageUrl !== 'string') return undefined;
  const trimmed = imageUrl.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith('http://')) {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.endsWith('.local')
      ) {
        return trimmed;
      }
      return trimmed.replace(/^http:\/\//i, 'https://');
    } catch {
      return trimmed.replace(/^http:\/\//i, 'https://');
    }
  }

  return trimmed;
}

/**
 * Detects whether a URL represents a video stream or manifest rather than an image asset.
 * Catches HLS (.m3u8), MPEG-DASH (.mpd), MPEG-TS (.ts) segments, and streaming manifests.
 */
export function isVideoStreamUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed, 'https://example.com');
    const pathname = parsed.pathname;

    // Direct stream manifest or video segment extensions
    if (
      pathname.endsWith('.m3u8') ||
      pathname.endsWith('.mpd') ||
      pathname.endsWith('.ts') ||
      trimmed.includes('.m3u8') ||
      trimmed.includes('.mpd')
    ) {
      return true;
    }

    // Direct video stream manifests on video delivery networks
    if (
      parsed.hostname.includes('videodelivery.net') &&
      (pathname.includes('/manifest/') || pathname.endsWith('.m3u8'))
    ) {
      return true;
    }
  } catch {
    if (trimmed.includes('.m3u8') || trimmed.includes('.mpd')) {
      return true;
    }
  }

  return false;
}

/**
 * Detects whether a URL represents a low-quality image (favicon, platform logo, channel avatar,
 * small brand badge, or tiny thumbnail) or a non-image video stream rather than a high-fidelity
 * media cover/poster.
 */
export function isLowQualityImage(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return true;

  // Vector data URI cards and generated previews are valid high-fidelity assets
  if (trimmed.startsWith('data:image/')) return false;

  // Anime3rb & Vid3rb posters and thumbnails are valid high-fidelity cover assets
  if (
    trimmed.includes('thumbnails.vid3rb.com') ||
    trimmed.includes('images.anime3rb.com') ||
    trimmed.includes('video.vid3rb.com/video/')
  ) {
    return false;
  }

  // Video streams are not valid image assets
  if (isVideoStreamUrl(trimmed)) return true;

  // Google S2 favicon service
  if (trimmed.includes('google.com/s2/favicons')) return true;

  // Generic favicon references
  if (trimmed.includes('favicon')) return true;

  // Instagram / Facebook static shell resources
  if (trimmed.includes('static.cdninstagram.com/rsrc.php')) return true;

  try {
    const parsed = new URL(trimmed, 'https://example.com');
    const pathname = parsed.pathname.toLowerCase();

    // Wikimedia Commons encyclopedic illustrations and article media are valid cover assets
    if (parsed.hostname.endsWith('wikimedia.org') && !trimmed.includes('favicon')) {
      return false;
    }

    // Icon assets by extension
    if (pathname.endsWith('.ico') || pathname.endsWith('.svg')) return true;

    // Small dimension hints in query params (e.g., sz=32, s=64, w=32, h=32)
    const searchParams = parsed.searchParams;
    for (const key of ['sz', 's', 'w', 'h', 'width', 'height', 'size']) {
      const val = searchParams.get(key);
      if (val && /^\d+$/.test(val)) {
        const num = parseInt(val, 10);
        if (num > 0 && num <= 64) {
          return true;
        }
      }
    }

    // Site logo, brand badge, or user avatar file paths
    // e.g. /avatar/foo.png, /avatars/u1.jpg, /images/logo.png, /badge.png
    if (/(?:^|\/|_|-)(?:avatar|avatars|badge|badges|logo|logos|app-icon|site-icon)(?:[._\/-]|$)/i.test(pathname)) {
      return true;
    }
  } catch {}

  return false;
}

/**
 * Alias for isLowQualityImage for backwards compatibility across existing callers.
 */
export const isFaviconUrl = isLowQualityImage;

/**
 * Sniffs image format from binary magic bytes.
 * Returns standard MIME type or null if unrecognized.
 */
export function sniffImageMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon';
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === 'avif' || brand === 'avis') {
      return 'image/avif';
    }
  }
  try {
    const head = new TextDecoder('utf-8').decode(bytes.subarray(0, Math.min(bytes.length, 128))).trimStart().toLowerCase();
    if (head.startsWith('<svg') || head.startsWith('<?xml')) {
      return 'image/svg+xml';
    }
  } catch {}

  return null;
}

/**
 * Extracts immediate metadata without network requests based on platform URL patterns.
 */
export function extractInstantMediaMetadata(url: string): InstantMediaMetadata {
  if (!url || typeof url !== 'string') {
    return {};
  }

  let cleaned = url.trim();
  if (!cleaned) {
    return {};
  }

  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return {};
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = parsed.pathname;

  // 1. YouTube (Watch, Shorts, Embed, youtu.be, Playlists)
  if (hostname === 'youtu.be') {
    const id = pathname.slice(1).split('/')[0]?.split('?')[0];
    const listParam = parsed.searchParams.get('list');
    if (listParam) {
      return {
        ...(id && id.length > 0 ? { image: `https://img.youtube.com/vi/${id}/hqdefault.jpg` } : {}),
        title: 'YouTube Playlist',
        siteName: 'YouTube',
        contentType: 'playlist',
      };
    }
    if (id && id.length > 0) {
      return {
        image: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        title: 'YouTube Video',
        siteName: 'YouTube',
      };
    }
    return {
      title: 'YouTube Video',
      siteName: 'YouTube',
    };
  }

  if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
    const listParam = parsed.searchParams.get('list');
    const vParam = parsed.searchParams.get('v');

    // Playlist (with or without video ID) or dedicated /playlist path
    if (listParam || pathname.startsWith('/playlist')) {
      const vid = vParam || (pathname.startsWith('/v/') ? pathname.match(/^\/v\/([^/?#]+)/i)?.[1] : undefined);
      return {
        ...(vid ? { image: `https://img.youtube.com/vi/${vid}/hqdefault.jpg` } : {}),
        title: 'YouTube Playlist',
        siteName: 'YouTube',
        contentType: 'playlist',
      };
    }

    // Shorts
    const shortsMatch = pathname.match(/^\/shorts\/([^/?#]+)/i);
    if (shortsMatch && shortsMatch[1]) {
      const id = shortsMatch[1];
      return {
        image: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        title: 'YouTube Short',
        siteName: 'YouTube',
      };
    }

    // Embed
    const embedMatch = pathname.match(/^\/embed\/([^/?#]+)/i);
    if (embedMatch && embedMatch[1]) {
      const id = embedMatch[1];
      return {
        image: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        title: 'YouTube Video',
        siteName: 'YouTube',
      };
    }

    // Direct /v/
    const vPathMatch = pathname.match(/^\/v\/([^/?#]+)/i);
    if (vPathMatch && vPathMatch[1]) {
      const id = vPathMatch[1];
      return {
        image: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        title: 'YouTube Video',
        siteName: 'YouTube',
      };
    }

    // Standard Watch
    if (vParam) {
      return {
        image: `https://img.youtube.com/vi/${vParam}/hqdefault.jpg`,
        title: 'YouTube Video',
        siteName: 'YouTube',
        contentType: 'video'
      };
    }

    return {
      title: 'YouTube',
      siteName: 'YouTube',
    };
  }

  // 2. GitHub (Repositories and profiles)
  if (hostname === 'github.com') {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const owner = segments[0];
      const repo = segments[1].replace(/\.git$/, '');
      if (!GITHUB_RESERVED_SEGMENTS.has(owner.toLowerCase())) {
        return {
          title: `${owner}/${repo}`,
          image: `https://opengraph.githubassets.com/1/${owner}/${repo}`,
          siteName: 'GitHub',
        };
      }
    }
    return {
      title: 'GitHub',
      siteName: 'GitHub',
    };
  }

  // 3. TikTok
  if (hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')) {
    return {
      title: 'TikTok Video',
      siteName: 'TikTok',
    };
  }

  // 4. Vimeo
  if (hostname === 'vimeo.com' || hostname.endsWith('.vimeo.com')) {
    return {
      title: 'Vimeo Video',
      siteName: 'Vimeo',
    };
  }

  // 5. X / Twitter
  if (
    hostname === 'x.com' ||
    hostname === 'twitter.com' ||
    hostname.endsWith('.x.com') ||
    hostname.endsWith('.twitter.com')
  ) {
    return {
      title: 'X Post',
      siteName: 'X',
    };
  }

  // 6. Reddit
  if (hostname === 'reddit.com' || hostname.endsWith('.reddit.com')) {
    const subMatch = pathname.match(/\/r\/([^/?#]+)/i);
    const sub = subMatch ? subMatch[1] : '';
    return {
      title: sub ? `r/${sub}` : 'Reddit',
      siteName: 'Reddit',
    };
  }

  // 7. Instagram
  if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
    const isReel = pathname.includes('/reel/') || pathname.includes('/reels/');
    return {
      title: isReel ? 'Instagram Reel' : 'Instagram Post',
      siteName: 'Instagram',
      image: INSTAGRAM_FALLBACK_POSTER,
      contentType: isReel ? 'video' : 'article',
    };
  }

  return {};
}
