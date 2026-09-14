import { describe, it, expect } from 'vitest';
import { extractInstantMediaMetadata } from './mediaHeuristics';

describe('extractInstantMediaMetadata Unit Tests', () => {
  describe('YouTube Heuristics', () => {
    it('should extract metadata from standard watch URL', () => {
      const result = extractInstantMediaMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toEqual({
        title: 'YouTube Video',
        image: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        siteName: 'YouTube',
      });
    });

    it('should extract metadata from YouTube Shorts', () => {
      const result = extractInstantMediaMetadata('https://youtube.com/shorts/3xyzABC123?feature=share');
      expect(result).toEqual({
        title: 'YouTube Short',
        image: 'https://img.youtube.com/vi/3xyzABC123/hqdefault.jpg',
        siteName: 'YouTube',
      });
    });

    it('should extract metadata from YouTube Embed URL', () => {
      const result = extractInstantMediaMetadata('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(result).toEqual({
        title: 'YouTube Video',
        image: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        siteName: 'YouTube',
      });
    });

    it('should extract metadata from youtu.be shortlinks', () => {
      const result = extractInstantMediaMetadata('https://youtu.be/dQw4w9WgXcQ?t=42');
      expect(result).toEqual({
        title: 'YouTube Video',
        image: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        siteName: 'YouTube',
      });
    });

    it('should handle YouTube URL without video ID', () => {
      const result = extractInstantMediaMetadata('https://www.youtube.com/');
      expect(result).toEqual({
        title: 'YouTube Video',
        siteName: 'YouTube',
      });
    });
  });

  describe('GitHub Heuristics', () => {
    it('should extract repository name and OpenGraph preview image', () => {
      const result = extractInstantMediaMetadata('https://github.com/facebook/react');
      expect(result).toEqual({
        title: 'facebook/react',
        image: 'https://opengraph.githubassets.com/1/facebook/react',
        siteName: 'GitHub',
      });
    });

    it('should strip .git suffix from repository', () => {
      const result = extractInstantMediaMetadata('https://github.com/torvalds/linux.git');
      expect(result).toEqual({
        title: 'torvalds/linux',
        image: 'https://opengraph.githubassets.com/1/torvalds/linux',
        siteName: 'GitHub',
      });
    });

    it('should handle reserved top-level GitHub paths', () => {
      const result = extractInstantMediaMetadata('https://github.com/explore');
      expect(result).toEqual({
        title: 'GitHub',
        siteName: 'GitHub',
      });
    });
  });

  describe('Social and Video Platforms', () => {
    it('should extract metadata for TikTok videos', () => {
      const result = extractInstantMediaMetadata('https://www.tiktok.com/@scout2015/video/6718335390845095173');
      expect(result).toEqual({
        title: 'TikTok Video',
        siteName: 'TikTok',
      });
    });

    it('should extract metadata for Vimeo videos', () => {
      const result = extractInstantMediaMetadata('https://vimeo.com/76979871');
      expect(result).toEqual({
        title: 'Vimeo Video',
        siteName: 'Vimeo',
      });
    });

    it('should extract metadata for X posts', () => {
      const result = extractInstantMediaMetadata('https://x.com/jack/status/20');
      expect(result).toEqual({
        title: 'X Post',
        siteName: 'X',
      });
    });

    it('should extract metadata for Twitter posts', () => {
      const result = extractInstantMediaMetadata('https://twitter.com/jack/status/20');
      expect(result).toEqual({
        title: 'X Post',
        siteName: 'X',
      });
    });

    it('should extract subreddit metadata for Reddit links', () => {
      const result = extractInstantMediaMetadata('https://www.reddit.com/r/programming/comments/12345/foo');
      expect(result).toEqual({
        title: 'r/programming',
        siteName: 'Reddit',
      });
    });

    it('should extract Instagram Reel and Post metadata', () => {
      const reel = extractInstantMediaMetadata('https://www.instagram.com/reel/DFghjkL123/');
      expect(reel).toEqual({
        title: 'Instagram Reel',
        siteName: 'Instagram',
      });

      const post = extractInstantMediaMetadata('https://www.instagram.com/p/DFghjkL123/');
      expect(post).toEqual({
        title: 'Instagram Post',
        siteName: 'Instagram',
      });
    });
  });

  describe('Edge Cases and Fallbacks', () => {
    it('should handle empty or null/undefined inputs', () => {
      expect(extractInstantMediaMetadata('')).toEqual({});
      expect(extractInstantMediaMetadata(null as any)).toEqual({});
      expect(extractInstantMediaMetadata(undefined as any)).toEqual({});
    });

    it('should handle URLs without protocol schemes', () => {
      const result = extractInstantMediaMetadata('youtu.be/dQw4w9WgXcQ');
      expect(result).toEqual({
        title: 'YouTube Video',
        image: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        siteName: 'YouTube',
      });
    });

    it('should return empty object for generic website without heuristics', () => {
      const result = extractInstantMediaMetadata('https://example.com/some/article');
      expect(result).toEqual({});
    });
  });
});
