import { describe, it, expect } from 'vitest';
import {
  parseSeriesProgression,
  formatEpisodicBadge,
  isSeriesSuccessor,
  EgyDeadStrategy,
  Anime3rbStrategy,
  YouTubePlaylistStrategy,
  CrunchyrollStrategy,
  MangaStrategy,
  GenericStreamingStrategy,
} from './seriesProgression';

describe('Series Progression & Succession Engine', () => {
  describe('EgyDeadStrategy', () => {
    it('parses EgyDead series URLs with season and episode', () => {
      const url = 'https://egydead.co/episodes/breaking-bad-s01e05/';
      const info = EgyDeadStrategy.parse(url, 'Breaking Bad S01E05 - EgyDead');

      expect(info).not.toBeNull();
      expect(info?.seriesKey).toBe('egydead:breaking-bad:s1');
      expect(info?.season).toBe(1);
      expect(info?.episode).toBe(5);
      expect(info?.sourceType).toBe('egydead');
      expect(info?.nextEpisodeUrl).toBe('https://egydead.co/episodes/breaking-bad-s01e06/');
    });

    it('parses EgyDead series URLs without season prefix', () => {
      const url = 'https://egydead.live/episodes/mr-robot-e10/';
      const info = EgyDeadStrategy.parse(url);

      expect(info).not.toBeNull();
      expect(info?.seriesKey).toBe('egydead:mr-robot');
      expect(info?.episode).toBe(10);
      expect(info?.nextEpisodeUrl).toBe('https://egydead.live/episodes/mr-robot-e11/');
    });
  });

  describe('Anime3rbStrategy', () => {
    it('parses Anime3rb episode URLs and computes next episode', () => {
      const url = 'https://anime3rb.com/episode/naruto-shippuden/25/';
      const info = Anime3rbStrategy.parse(url, 'Naruto Shippuden 25 - Anime3rb');

      expect(info).not.toBeNull();
      expect(info?.seriesKey).toBe('anime3rb:naruto-shippuden');
      expect(info?.episode).toBe(25);
      expect(info?.sourceType).toBe('anime3rb');
      expect(info?.nextEpisodeUrl).toBe('https://anime3rb.com/episode/naruto-shippuden/26/');
    });
  });

  describe('YouTubePlaylistStrategy', () => {
    it('parses YouTube playlist video with index and computes next index', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123456789&index=4';
      const info = YouTubePlaylistStrategy.parse(url, 'Awesome Tutorial 4');

      expect(info).not.toBeNull();
      expect(info?.seriesKey).toBe('youtube:playlist:PL123456789');
      expect(info?.episode).toBe(4);
      expect(info?.sourceType).toBe('youtube');
      expect(info?.nextEpisodeUrl).toContain('index=5');
      expect(info?.nextEpisodeUrl).toContain('list=PL123456789');
    });
  });

  describe('CrunchyrollStrategy', () => {
    it('parses Crunchyroll episode URL and increments episode number', () => {
      const url = 'https://www.crunchyroll.com/watch/G6QW5K186/jujutsu-kaisen-episode-4';
      const info = CrunchyrollStrategy.parse(url, 'Jujutsu Kaisen Episode 4');

      expect(info).not.toBeNull();
      expect(info?.seriesKey).toBe('crunchyroll:jujutsu-kaisen');
      expect(info?.episode).toBe(4);
      expect(info?.sourceType).toBe('crunchyroll');
      expect(info?.nextEpisodeUrl).toBe('https://www.crunchyroll.com/watch/G6QW5K186/jujutsu-kaisen-episode-5');
    });
  });

  describe('MangaStrategy', () => {
    it('parses manga chapter URLs and increments chapter', () => {
      const url = 'https://mangadex.org/comic/solo-leveling/chapter-15';
      const info = MangaStrategy.parse(url, 'Solo Leveling Chapter 15');

      expect(info).not.toBeNull();
      expect(info?.seriesKey).toBe('manga:solo-leveling');
      expect(info?.episode).toBe(15);
      expect(info?.sourceType).toBe('manga');
      expect(info?.nextEpisodeUrl).toBe('https://mangadex.org/comic/solo-leveling/chapter-16');
    });
  });

  describe('GenericStreamingStrategy', () => {
    it('parses S02E08 generic patterns', () => {
      const url = 'https://example-streaming.tv/shows/stranger-things-s02e08';
      const info = GenericStreamingStrategy.parse(url);

      expect(info).not.toBeNull();
      expect(info?.season).toBe(2);
      expect(info?.episode).toBe(8);
      expect(info?.nextEpisodeUrl).toBe('https://example-streaming.tv/shows/stranger-things-s02e09');
    });

    it('parses query parameter ep=7', () => {
      const url = 'https://video.example.org/watch?title=one-piece&ep=7';
      const info = GenericStreamingStrategy.parse(url);

      expect(info).not.toBeNull();
      expect(info?.episode).toBe(7);
      expect(info?.nextEpisodeUrl).toContain('ep=8');
    });
  });

  describe('formatEpisodicBadge', () => {
    it('formats season and episode properly', () => {
      expect(formatEpisodicBadge({ season: 2, episode: 4 })).toBe('S2 EP 4');
    });

    it('formats manga chapter properly', () => {
      expect(formatEpisodicBadge({ episode: 42, sourceType: 'manga' })).toBe('CH 42');
    });

    it('formats episode only properly', () => {
      expect(formatEpisodicBadge({ episode: 12 })).toBe('EP 12');
    });
  });

  describe('isSeriesSuccessor', () => {
    it('detects when an incoming URL is from the same series', () => {
      const existing = {
        url: 'https://anime3rb.com/episode/naruto-shippuden/25/',
        seriesKey: 'anime3rb:naruto-shippuden',
        seriesEpisode: 25,
      };
      const incoming = 'https://anime3rb.com/episode/naruto-shippuden/26/';

      const result = isSeriesSuccessor(existing, incoming);
      expect(result.isSuccessor).toBe(true);
      expect(result.incomingInfo?.episode).toBe(26);
    });

    it('rejects URLs from different series or platforms', () => {
      const existing = {
        url: 'https://anime3rb.com/episode/naruto-shippuden/25/',
        seriesKey: 'anime3rb:naruto-shippuden',
        seriesEpisode: 25,
      };
      const incoming = 'https://anime3rb.com/episode/bleach/26/';

      const result = isSeriesSuccessor(existing, incoming);
      expect(result.isSuccessor).toBe(false);
    });
  });

  describe('Unified parseSeriesProgression', () => {
    it('returns null for non-series URLs', () => {
      expect(parseSeriesProgression('https://github.com/belal-waheed/markbel')).toBeNull();
      expect(parseSeriesProgression('https://news.ycombinator.com')).toBeNull();
      expect(parseSeriesProgression('')).toBeNull();
    });
  });
});
