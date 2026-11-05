import { describe, it, expect } from 'vitest';
import {
  extractInstantMediaMetadata,
  upgradeInsecureImageUrl,
  isFaviconUrl,
  isLowQualityImage,
  isVideoStreamUrl,
  INSTAGRAM_FALLBACK_POSTER,
} from './mediaHeuristics';

describe('extractInstantMediaMetadata Unit Tests', () => {
  describe('YouTube Heuristics', () => {
    it('should extract metadata from standard watch URL', () => {
      const result = extractInstantMediaMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toEqual({
        title: 'YouTube Video',
        image: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        siteName: 'YouTube',
        contentType: 'video'
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
        title: 'YouTube',
        siteName: 'YouTube',
      });
    });

    it('should identify YouTube Playlist from watch URL with list param', () => {
      const result = extractInstantMediaMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOdP_8GztsuKi9nrraNbKKp4');
      expect(result).toEqual({
        title: 'YouTube Playlist',
        image: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        siteName: 'YouTube',
        contentType: 'playlist'
      });
    });

    it('should identify pure YouTube Playlist URL', () => {
      const result = extractInstantMediaMetadata('https://www.youtube.com/playlist?list=PLrAXtmErZgOdP_8GztsuKi9nrraNbKKp4');
      expect(result).toEqual({
        title: 'YouTube Playlist',
        siteName: 'YouTube',
        contentType: 'playlist'
      });
    });

    it('should identify YouTube Playlist from youtu.be with list param', () => {
      const result = extractInstantMediaMetadata('https://youtu.be/dQw4w9WgXcQ?list=PLrAXtmErZgOdP_8GztsuKi9nrraNbKKp4');
      expect(result).toEqual({
        title: 'YouTube Playlist',
        image: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        siteName: 'YouTube',
        contentType: 'playlist'
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
        image: INSTAGRAM_FALLBACK_POSTER,
        contentType: 'video',
      });

      const post = extractInstantMediaMetadata('https://www.instagram.com/p/DFghjkL123/');
      expect(post).toEqual({
        title: 'Instagram Post',
        siteName: 'Instagram',
        image: INSTAGRAM_FALLBACK_POSTER,
        contentType: 'article',
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

  describe('upgradeInsecureImageUrl Tests', () => {
    it('upgrades http:// URLs to https://', () => {
      expect(upgradeInsecureImageUrl('http://example.com/image.png')).toBe('https://example.com/image.png');
      expect(upgradeInsecureImageUrl('http://cdn.site.org/assets/pic.jpg?w=100')).toBe('https://cdn.site.org/assets/pic.jpg?w=100');
    });

    it('upgrades protocol-relative // URLs to https://', () => {
      expect(upgradeInsecureImageUrl('//cdn.example.com/image.webp')).toBe('https://cdn.example.com/image.webp');
    });

    it('leaves https:// URLs untouched', () => {
      expect(upgradeInsecureImageUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
    });

    it('preserves localhost and 127.0.0.1 http development URLs', () => {
      expect(upgradeInsecureImageUrl('http://localhost:3000/image.jpg')).toBe('http://localhost:3000/image.jpg');
      expect(upgradeInsecureImageUrl('http://127.0.0.1:8080/image.png')).toBe('http://127.0.0.1:8080/image.png');
    });

    it('handles empty, null, and undefined values cleanly', () => {
      expect(upgradeInsecureImageUrl('')).toBeUndefined();
      expect(upgradeInsecureImageUrl('   ')).toBeUndefined();
      expect(upgradeInsecureImageUrl(null)).toBeUndefined();
      expect(upgradeInsecureImageUrl(undefined)).toBeUndefined();
    });
  });

  describe('isVideoStreamUrl Tests', () => {
    it('returns false for falsy or empty values', () => {
      expect(isVideoStreamUrl(null)).toBe(false);
      expect(isVideoStreamUrl(undefined)).toBe(false);
      expect(isVideoStreamUrl('')).toBe(false);
      expect(isVideoStreamUrl('   ')).toBe(false);
    });

    it('identifies HLS .m3u8 stream manifests', () => {
      expect(isVideoStreamUrl('https://stream.example.com/live/master.m3u8')).toBe(true);
      expect(isVideoStreamUrl('https://stream.example.com/playlist.m3u8?token=xyz')).toBe(true);
    });

    it('identifies MPEG-DASH .mpd stream manifests', () => {
      expect(isVideoStreamUrl('https://stream.example.com/live/manifest.mpd')).toBe(true);
      expect(isVideoStreamUrl('https://stream.example.com/dash/video.mpd?hd=1')).toBe(true);
    });

    it('identifies MPEG-TS .ts transport stream segments', () => {
      expect(isVideoStreamUrl('https://stream.example.com/hls/segment104.ts')).toBe(true);
      expect(isVideoStreamUrl('https://stream.example.com/video/chunk.ts?time=120')).toBe(true);
    });

    it('identifies streaming manifests on video delivery networks while permitting 302 image endpoints', () => {
      expect(isVideoStreamUrl('https://videodelivery.net/manifest/video.m3u8')).toBe(true);
      expect(isVideoStreamUrl('https://video.vid3rb.com/video/b515cf5f-6a75-4ee4-b6d9-cf6368d40be6')).toBe(false);
    });

    it('returns false for legitimate images and non-video assets', () => {
      expect(isVideoStreamUrl('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')).toBe(false);
      expect(isVideoStreamUrl('https://thumbnails.vid3rb.com/b515cf5f/thumbnail.001.jpeg')).toBe(false);
      expect(isVideoStreamUrl('https://example.com/images/hero.webp')).toBe(false);
    });
  });

  describe('isLowQualityImage & isFaviconUrl Tests', () => {
    it('identifies falsy or empty inputs as low quality / favicon URLs', () => {
      expect(isLowQualityImage(null)).toBe(true);
      expect(isLowQualityImage(undefined)).toBe(true);
      expect(isLowQualityImage('')).toBe(true);
      expect(isLowQualityImage('   ')).toBe(true);
      expect(isFaviconUrl(null)).toBe(true);
      expect(isFaviconUrl('')).toBe(true);
    });

    it('identifies Google S2 favicon service URLs', () => {
      expect(isLowQualityImage('https://www.google.com/s2/favicons?domain=youtube.com&sz=128')).toBe(true);
      expect(isLowQualityImage('http://google.com/s2/favicons?domain=github.com')).toBe(true);
      expect(isFaviconUrl('https://www.google.com/s2/favicons?domain=youtube.com&sz=128')).toBe(true);
    });

    it('identifies generic URLs containing favicon', () => {
      expect(isLowQualityImage('https://example.com/assets/favicon.png')).toBe(true);
      expect(isLowQualityImage('https://example.com/favicons/apple-touch-icon.png')).toBe(true);
      expect(isFaviconUrl('https://example.com/assets/favicon.png')).toBe(true);
    });

    it('identifies .ico and .svg icon assets', () => {
      expect(isLowQualityImage('https://example.com/logo.ico')).toBe(true);
      expect(isLowQualityImage('https://example.com/icon.svg')).toBe(true);
      expect(isLowQualityImage('https://example.com/icon.svg?v=2')).toBe(true);
      expect(isLowQualityImage('https://example.com/app.ico?cache=1')).toBe(true);
      expect(isFaviconUrl('https://example.com/logo.ico')).toBe(true);
    });

    it('identifies Instagram / Meta shell static resources', () => {
      expect(isLowQualityImage('https://static.cdninstagram.com/rsrc.php/v3/yI/r/something.png')).toBe(true);
    });

    it('identifies URLs with small dimension hints (sz=32, s=64, w=32, h=32)', () => {
      expect(isLowQualityImage('https://example.com/photo.jpg?sz=32')).toBe(true);
      expect(isLowQualityImage('https://avatars.githubusercontent.com/u/1234?s=64')).toBe(true);
      expect(isLowQualityImage('https://example.com/avatar.jpg?w=32&h=32')).toBe(true);
      expect(isLowQualityImage('https://example.com/pic.png?size=48')).toBe(true);
      // Large dimensions should not be rejected by dimension check
      expect(isLowQualityImage('https://images.unsplash.com/photo?w=1200&h=800')).toBe(false);
    });

    it('identifies platform logos, brand badges, and user avatars in paths', () => {
      expect(isLowQualityImage('https://example.com/assets/logo.png')).toBe(true);
      expect(isLowQualityImage('https://example.com/static/brand-badge.png')).toBe(true);
      expect(isLowQualityImage('https://example.com/user/avatar/john.jpg')).toBe(true);
      expect(isLowQualityImage('https://example.com/logos/header-logo.jpg')).toBe(true);
    });

    it('identifies video stream URLs as low quality images', () => {
      expect(isLowQualityImage('https://stream.example.com/playlist.m3u8')).toBe(true);
      expect(isLowQualityImage('https://stream.example.com/segment.ts')).toBe(true);
    });

    it('recognizes anime3rb and vid3rb posters as high quality images', () => {
      expect(isLowQualityImage('https://video.vid3rb.com/video/b515cf5f-6a75-4ee4-b6d9-cf6368d40be6')).toBe(false);
      expect(isLowQualityImage('https://thumbnails.vid3rb.com/b515cf5f/thumbnail.001.jpeg')).toBe(false);
      expect(isLowQualityImage('https://images.anime3rb.com/titles/poster.jpg')).toBe(false);
    });

    it('returns false for real cover and banner images', () => {
      expect(isLowQualityImage('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')).toBe(false);
      expect(isLowQualityImage('https://opengraph.githubassets.com/1/facebook/react')).toBe(false);
      expect(isLowQualityImage('https://cdn.site.com/covers/hero-banner.webp')).toBe(false);
      expect(isLowQualityImage('https://images.unsplash.com/photo-1579546929518-9e396f3cc809')).toBe(false);
      expect(isLowQualityImage('https://thumbnails.vid3rb.com/b515cf5f/thumbnail.001.jpeg')).toBe(false);
      expect(isLowQualityImage(INSTAGRAM_FALLBACK_POSTER)).toBe(false);
    });
  });
});
