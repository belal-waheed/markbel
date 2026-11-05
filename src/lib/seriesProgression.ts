/**
 * Markbel Series Progression Engine
 * Deterministic detection, succession, and rollback of episodic media (anime, streaming series, playlists, manga).
 */

export interface SeriesInfo {
  seriesKey: string;
  seriesTitle: string;
  episode: number;
  season?: number;
  totalEpisodes?: number;
  nextEpisodeUrl?: string;
  sourceType: 'egydead' | 'anime3rb' | 'youtube' | 'crunchyroll' | 'manga' | 'generic';
}

export interface SeriesProgressionStrategy {
  name: string;
  sourceType: SeriesInfo['sourceType'];
  matches: (url: string) => boolean;
  parse: (url: string, title?: string) => SeriesInfo | null;
  buildNextEpisodeUrl: (currentUrl: string, info: SeriesInfo) => string | null;
}

/**
 * Normalizes a slug to title case for display
 */
export function slugToTitle(slug: string): string {
  if (!slug) return '';
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

/**
 * Preserves zero-padding if original episode string had leading zeros
 */
export function formatEpisodeNumber(num: number, originalStr?: string): string {
  if (originalStr && originalStr.length > 1 && originalStr.startsWith('0')) {
    return String(num).padStart(originalStr.length, '0');
  }
  return String(num);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STRATEGY 1: EgyDead (Arabic Streaming Series)
// Patterns: /episodes/([a-z0-9-_]+)[-_/](?:s(\d+))?e(\d+)/
// Examples: https://egydead.co/episodes/breaking-bad-s01e05/
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const EgyDeadStrategy: SeriesProgressionStrategy = {
  name: 'EgyDead',
  sourceType: 'egydead',
  matches: (url: string) => {
    return url.includes('egydead') || /episodes\/[a-z0-9-_]+[-_/](?:s\d+)?e\d+/i.test(url);
  },
  parse: (url: string, title?: string): SeriesInfo | null => {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(
        /\/episodes\/([a-z0-9-_]+?)(?:[-_/]?s(\d+))?[-_/]?e(\d+)/i
      );
      if (!match) return null;

      const slug = match[1];
      const season = match[2] ? parseInt(match[2], 10) : undefined;
      const episode = parseInt(match[3], 10);
      const seriesKey = `egydead:${slug.toLowerCase()}${season ? `:s${season}` : ''}`;
      const seriesTitle = title && !title.includes('http') ? title.split(/[-–|]/)[0].trim() : slugToTitle(slug);

      const nextUrl = EgyDeadStrategy.buildNextEpisodeUrl(url, {
        seriesKey,
        seriesTitle,
        episode,
        season,
        sourceType: 'egydead',
      });

      return {
        seriesKey,
        seriesTitle,
        episode,
        season,
        nextEpisodeUrl: nextUrl || undefined,
        sourceType: 'egydead',
      };
    } catch {
      return null;
    }
  },
  buildNextEpisodeUrl: (currentUrl: string, info: SeriesInfo): string | null => {
    try {
      const parsed = new URL(currentUrl);
      const regex = /(\/episodes\/[a-z0-9-_]+?(?:[-_/]?s\d+)?[-_/]?e)(\d+)(\/?.*)$/i;
      const match = parsed.pathname.match(regex);
      if (!match) return null;

      const prefix = match[1];
      const rawEp = match[2];
      const suffix = match[3];
      const nextEpStr = formatEpisodeNumber(info.episode + 1, rawEp);

      parsed.pathname = parsed.pathname.replace(regex, `${prefix}${nextEpStr}${suffix}`);
      return parsed.toString();
    } catch {
      return null;
    }
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STRATEGY 2: Anime3rb (Arabic Anime Platform)
// Pattern: /episode/([a-z0-9-_]+)/(\d+)/
// Examples: https://anime3rb.com/episode/naruto-shippuden/25/
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const Anime3rbStrategy: SeriesProgressionStrategy = {
  name: 'Anime3rb',
  sourceType: 'anime3rb',
  matches: (url: string) => {
    return url.includes('anime3rb') || /\/episode\/[a-z0-9-_]+\/\d+/i.test(url);
  },
  parse: (url: string, title?: string): SeriesInfo | null => {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/episode\/([a-z0-9-_]+)\/(\d+)/i);
      if (!match) return null;

      const slug = match[1];
      const episode = parseInt(match[2], 10);
      const seriesKey = `anime3rb:${slug.toLowerCase()}`;
      const seriesTitle = title && !title.includes('http') ? title.split(/[-–|]/)[0].trim() : slugToTitle(slug);

      const nextUrl = Anime3rbStrategy.buildNextEpisodeUrl(url, {
        seriesKey,
        seriesTitle,
        episode,
        sourceType: 'anime3rb',
      });

      return {
        seriesKey,
        seriesTitle,
        episode,
        nextEpisodeUrl: nextUrl || undefined,
        sourceType: 'anime3rb',
      };
    } catch {
      return null;
    }
  },
  buildNextEpisodeUrl: (currentUrl: string, info: SeriesInfo): string | null => {
    try {
      const parsed = new URL(currentUrl);
      const regex = /(\/episode\/[a-z0-9-_]+\/)(\d+)(\/?.*)$/i;
      const match = parsed.pathname.match(regex);
      if (!match) return null;

      const prefix = match[1];
      const rawEp = match[2];
      const suffix = match[3];
      const nextEpStr = formatEpisodeNumber(info.episode + 1, rawEp);

      parsed.pathname = parsed.pathname.replace(regex, `${prefix}${nextEpStr}${suffix}`);
      return parsed.toString();
    } catch {
      return null;
    }
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STRATEGY 3: YouTube Playlist
// Pattern: list=([a-z0-9-_]+) and index=(\d+)
// Examples: https://www.youtube.com/watch?v=abc&list=PL12345&index=3
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const YouTubePlaylistStrategy: SeriesProgressionStrategy = {
  name: 'YouTubePlaylist',
  sourceType: 'youtube',
  matches: (url: string) => {
    try {
      const parsed = new URL(url);
      const isYt = parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be');
      return isYt && parsed.searchParams.has('list') && parsed.searchParams.has('index');
    } catch {
      return false;
    }
  },
  parse: (url: string, title?: string): SeriesInfo | null => {
    try {
      const parsed = new URL(url);
      const playlistId = parsed.searchParams.get('list');
      const indexStr = parsed.searchParams.get('index');
      if (!playlistId || !indexStr) return null;

      const episode = parseInt(indexStr, 10);
      if (isNaN(episode) || episode < 1) return null;

      const seriesKey = `youtube:playlist:${playlistId}`;
      const seriesTitle = title && !title.includes('http') ? title.split(/[-–|]/)[0].trim() : `Playlist ${playlistId.slice(0, 8)}`;

      const nextUrl = YouTubePlaylistStrategy.buildNextEpisodeUrl(url, {
        seriesKey,
        seriesTitle,
        episode,
        sourceType: 'youtube',
      });

      return {
        seriesKey,
        seriesTitle,
        episode,
        nextEpisodeUrl: nextUrl || undefined,
        sourceType: 'youtube',
      };
    } catch {
      return null;
    }
  },
  buildNextEpisodeUrl: (currentUrl: string, info: SeriesInfo): string | null => {
    try {
      const parsed = new URL(currentUrl);
      if (!parsed.searchParams.has('list') || !parsed.searchParams.has('index')) return null;
      parsed.searchParams.set('index', String(info.episode + 1));
      return parsed.toString();
    } catch {
      return null;
    }
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STRATEGY 4: Crunchyroll
// Pattern: /watch/([^/]+)/([a-z0-9-_]+)-episode-(\d+)
// Examples: https://www.crunchyroll.com/watch/G6QW5K186/jujutsu-kaisen-episode-4
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const CrunchyrollStrategy: SeriesProgressionStrategy = {
  name: 'Crunchyroll',
  sourceType: 'crunchyroll',
  matches: (url: string) => {
    return url.includes('crunchyroll.com') && /episode-\d+/i.test(url);
  },
  parse: (url: string, title?: string): SeriesInfo | null => {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/watch\/([^/]+)\/([a-z0-9-_]+)-episode-(\d+)/i);
      if (!match) {
        // Alternative Crunchyroll pattern: /watch/episode-(\d+)
        const altMatch = parsed.pathname.match(/\/watch\/(?:[^/]+\/)?([a-z0-9-_]+?)-?episode-(\d+)/i);
        if (!altMatch) return null;
        const slug = altMatch[1];
        const episode = parseInt(altMatch[2], 10);
        const seriesKey = `crunchyroll:${slug.toLowerCase()}`;
        return {
          seriesKey,
          seriesTitle: title && !title.includes('http') ? title.split(/[-–|]/)[0].trim() : slugToTitle(slug),
          episode,
          sourceType: 'crunchyroll',
        };
      }

      const slug = match[2];
      const episode = parseInt(match[3], 10);
      const seriesKey = `crunchyroll:${slug.toLowerCase()}`;
      const seriesTitle = title && !title.includes('http') ? title.split(/[-–|]/)[0].trim() : slugToTitle(slug);

      const nextUrl = CrunchyrollStrategy.buildNextEpisodeUrl(url, {
        seriesKey,
        seriesTitle,
        episode,
        sourceType: 'crunchyroll',
      });

      return {
        seriesKey,
        seriesTitle,
        episode,
        nextEpisodeUrl: nextUrl || undefined,
        sourceType: 'crunchyroll',
      };
    } catch {
      return null;
    }
  },
  buildNextEpisodeUrl: (currentUrl: string, info: SeriesInfo): string | null => {
    try {
      const parsed = new URL(currentUrl);
      const regex = /(episode-)(\d+)(\/?.*)$/i;
      const match = parsed.pathname.match(regex);
      if (!match) return null;

      const prefix = match[1];
      const rawEp = match[2];
      const suffix = match[3];
      const nextEpStr = formatEpisodeNumber(info.episode + 1, rawEp);

      parsed.pathname = parsed.pathname.replace(regex, `${prefix}${nextEpStr}${suffix}`);
      return parsed.toString();
    } catch {
      return null;
    }
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STRATEGY 5: Manga / Comics
// Pattern: /(?:series|manga|comic|read)/([a-z0-9-_]+)/chapter-(\d+)
// Examples: https://mangadex.org/comic/solo-leveling/chapter-12
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const MangaStrategy: SeriesProgressionStrategy = {
  name: 'Manga',
  sourceType: 'manga',
  matches: (url: string) => {
    return /(?:series|manga|comic|read|chapter)\/[a-z0-9-_]+.*chapter[-_]?\d+/i.test(url) ||
      /\/ch(?:apter)?[-_]?\d+/i.test(url);
  },
  parse: (url: string, title?: string): SeriesInfo | null => {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(
        /\/(?:series|manga|comic|read|title)\/([a-z0-9-_]+).*?chapter[-_]?(\d+)/i
      ) || parsed.pathname.match(/\/([a-z0-9-_]+)\/ch(?:apter)?[-_]?(\d+)/i);

      if (!match) return null;

      const slug = match[1];
      const episode = parseInt(match[2], 10);
      const seriesKey = `manga:${slug.toLowerCase()}`;
      const seriesTitle = title && !title.includes('http') ? title.split(/[-–|]/)[0].trim() : slugToTitle(slug);

      const nextUrl = MangaStrategy.buildNextEpisodeUrl(url, {
        seriesKey,
        seriesTitle,
        episode,
        sourceType: 'manga',
      });

      return {
        seriesKey,
        seriesTitle,
        episode,
        nextEpisodeUrl: nextUrl || undefined,
        sourceType: 'manga',
      };
    } catch {
      return null;
    }
  },
  buildNextEpisodeUrl: (currentUrl: string, info: SeriesInfo): string | null => {
    try {
      const parsed = new URL(currentUrl);
      const regex = /(chapter[-_]?|ch[-_]?)(\d+)(\/?.*)$/i;
      const match = parsed.pathname.match(regex);
      if (!match) return null;

      const prefix = match[1];
      const rawEp = match[2];
      const suffix = match[3];
      const nextEpStr = formatEpisodeNumber(info.episode + 1, rawEp);

      parsed.pathname = parsed.pathname.replace(regex, `${prefix}${nextEpStr}${suffix}`);
      return parsed.toString();
    } catch {
      return null;
    }
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STRATEGY 6: Generic Streaming & Media
// Fallback for s(\d+)e(\d+), /episode/(\d+), /ep-(\d+), ?ep=(\d+)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const GenericStreamingStrategy: SeriesProgressionStrategy = {
  name: 'GenericStreaming',
  sourceType: 'generic',
  matches: (url: string) => {
    return (
      /s\d+e\d+/i.test(url) ||
      /\/episode[s]?[-_/]\d+/i.test(url) ||
      /\/ep[-_/]\d+/i.test(url) ||
      /[?&](?:ep|episode)=\d+/i.test(url)
    );
  },
  parse: (url: string, title?: string): SeriesInfo | null => {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, '');

      // 1. Season + Episode: s01e05 or s1-e5
      const sMatch = parsed.pathname.match(/(?:[-_/])?s(\d+)[-_/]?e(\d+)/i) ||
                     parsed.search.match(/s(\d+)e(\d+)/i);
      if (sMatch) {
        const season = parseInt(sMatch[1], 10);
        const episode = parseInt(sMatch[2], 10);
        const slug = parsed.pathname.split('/')[1] || hostname;
        const seriesKey = `series:${hostname}:${slug.toLowerCase()}:s${season}`;
        const seriesTitle = title && !title.includes('http') ? title.split(/[-–|]/)[0].trim() : slugToTitle(slug);

        const nextUrl = GenericStreamingStrategy.buildNextEpisodeUrl(url, {
          seriesKey,
          seriesTitle,
          episode,
          season,
          sourceType: 'generic',
        });

        return {
          seriesKey,
          seriesTitle,
          episode,
          season,
          nextEpisodeUrl: nextUrl || undefined,
          sourceType: 'generic',
        };
      }

      // 2. Direct episode path: /episode/5 or /ep-5
      const epMatch = parsed.pathname.match(/\/(?:episodes?|ep)[-_/](\d+)/i) ||
                      parsed.search.match(/[?&](?:ep|episode)=(\d+)/i);
      if (epMatch) {
        const episode = parseInt(epMatch[1], 10);
        const pathSegments = parsed.pathname.split('/').filter(Boolean);
        const slug = pathSegments.length > 1 ? pathSegments[0] : hostname;
        const seriesKey = `series:${hostname}:${slug.toLowerCase()}`;
        const seriesTitle = title && !title.includes('http') ? title.split(/[-–|]/)[0].trim() : slugToTitle(slug);

        const nextUrl = GenericStreamingStrategy.buildNextEpisodeUrl(url, {
          seriesKey,
          seriesTitle,
          episode,
          sourceType: 'generic',
        });

        return {
          seriesKey,
          seriesTitle,
          episode,
          nextEpisodeUrl: nextUrl || undefined,
          sourceType: 'generic',
        };
      }

      return null;
    } catch {
      return null;
    }
  },
  buildNextEpisodeUrl: (currentUrl: string, info: SeriesInfo): string | null => {
    try {
      const parsed = new URL(currentUrl);

      // S+E pattern
      const seRegex = /(s\d+[-_/]?e)(\d+)/i;
      if (seRegex.test(parsed.pathname)) {
        const match = parsed.pathname.match(seRegex)!;
        const prefix = match[1];
        const rawEp = match[2];
        const nextEpStr = formatEpisodeNumber(info.episode + 1, rawEp);
        parsed.pathname = parsed.pathname.replace(seRegex, `${prefix}${nextEpStr}`);
        return parsed.toString();
      }

      // /episode/12 pattern
      const epPathRegex = /(\/(?:episodes?|ep)[-_/])(\d+)/i;
      if (epPathRegex.test(parsed.pathname)) {
        const match = parsed.pathname.match(epPathRegex)!;
        const prefix = match[1];
        const rawEp = match[2];
        const nextEpStr = formatEpisodeNumber(info.episode + 1, rawEp);
        parsed.pathname = parsed.pathname.replace(epPathRegex, `${prefix}${nextEpStr}`);
        return parsed.toString();
      }

      // Query param ?ep=12
      if (parsed.searchParams.has('ep')) {
        parsed.searchParams.set('ep', String(info.episode + 1));
        return parsed.toString();
      }
      if (parsed.searchParams.has('episode')) {
        parsed.searchParams.set('episode', String(info.episode + 1));
        return parsed.toString();
      }

      return null;
    } catch {
      return null;
    }
  },
};

export const SERIES_STRATEGIES: SeriesProgressionStrategy[] = [
  EgyDeadStrategy,
  Anime3rbStrategy,
  YouTubePlaylistStrategy,
  CrunchyrollStrategy,
  MangaStrategy,
  GenericStreamingStrategy,
];

/**
 * Parses any incoming URL using the registered series strategies.
 */
export function parseSeriesProgression(url?: string | null, title?: string): SeriesInfo | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  for (const strategy of SERIES_STRATEGIES) {
    if (strategy.matches(trimmed)) {
      const parsed = strategy.parse(trimmed, title);
      if (parsed) return parsed;
    }
  }

  // Fallback: Try generic strategy even if matches() was conservative
  return GenericStreamingStrategy.parse(trimmed, title);
}

/**
 * Builds the URL for the next episode in a series.
 */
export function buildNextEpisodeUrl(currentUrl: string, info: SeriesInfo): string | null {
  for (const strategy of SERIES_STRATEGIES) {
    if (strategy.sourceType === info.sourceType && strategy.matches(currentUrl)) {
      const next = strategy.buildNextEpisodeUrl(currentUrl, info);
      if (next) return next;
    }
  }
  return GenericStreamingStrategy.buildNextEpisodeUrl(currentUrl, info);
}

/**
 * Returns formatted episodic label badge (e.g. "S1 EP 5", "CH 12", "EP 4").
 */
export function formatEpisodicBadge(info: { episode: number; season?: number; sourceType?: string }): string {
  if (info.sourceType === 'manga') {
    return `CH ${info.episode}`;
  }
  if (typeof info.season === 'number' && info.season > 0) {
    return `S${info.season} EP ${info.episode}`;
  }
  return `EP ${info.episode}`;
}

/**
 * Determines whether an incoming URL represents succession of an existing bookmark.
 */
export function isSeriesSuccessor(
  existing: { url: string; seriesKey?: string; seriesEpisode?: number },
  incomingUrl: string
): { isSuccessor: boolean; incomingInfo: SeriesInfo | null } {
  const incomingInfo = parseSeriesProgression(incomingUrl);
  if (!incomingInfo) {
    return { isSuccessor: false, incomingInfo: null };
  }

  // If existing already has a seriesKey, check equality
  if (existing.seriesKey) {
    if (existing.seriesKey === incomingInfo.seriesKey) {
      return { isSuccessor: true, incomingInfo };
    }
  }

  // Otherwise, inspect existing URL
  const existingInfo = parseSeriesProgression(existing.url);
  if (existingInfo && existingInfo.seriesKey === incomingInfo.seriesKey) {
    return { isSuccessor: true, incomingInfo };
  }

  return { isSuccessor: false, incomingInfo };
}
