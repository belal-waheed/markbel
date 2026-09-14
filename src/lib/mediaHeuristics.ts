/**
 * Pure, zero-network deterministic metadata heuristics for media platforms.
 * Extracts instant high-fidelity titles, thumbnails, and platform origins.
 */

export interface InstantMediaMetadata {
  image?: string;
  title?: string;
  description?: string;
  siteName?: string;
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

  // 1. YouTube (Watch, Shorts, Embed, youtu.be)
  if (hostname === 'youtu.be') {
    const id = pathname.slice(1).split('/')[0]?.split('?')[0];
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
    const vParam = parsed.searchParams.get('v');
    if (vParam) {
      return {
        image: `https://img.youtube.com/vi/${vParam}/hqdefault.jpg`,
        title: 'YouTube Video',
        siteName: 'YouTube',
      };
    }

    return {
      title: 'YouTube Video',
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
    };
  }

  return {};
}
