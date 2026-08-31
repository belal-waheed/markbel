import { describe, it, expect } from 'vitest';
import { resolveSmartGroup, extractHostname, DEFAULT_SMART_GROUPS } from './smartGroups';

describe('Smart Auto-Grouper Unit Tests (AAA Pattern)', () => {
  describe('Hostname Extraction', () => {
    it('should extract clean hostname without www and protocol', () => {
      expect(extractHostname('https://www.youtube.com/watch?v=123')).toBe('youtube.com');
      expect(extractHostname('http://m.youtube.com/shorts/abc')).toBe('m.youtube.com');
      expect(extractHostname('instagram.com/p/123')).toBe('instagram.com');
      expect(extractHostname('https://x.com/user/status/789')).toBe('x.com');
    });

    it('should handle invalid or empty inputs gracefully', () => {
      expect(extractHostname('')).toBe('');
      expect(extractHostname(null as any)).toBe('');
    });
  });

  describe('YouTube Domain Matching (-> YT)', () => {
    it('should map standard YouTube watch URLs to YT', () => {
      const url = 'https://www.youtube.com/watch?v=jYFNtUYGxrY&t=414s';
      expect(resolveSmartGroup(url)).toBe('YT');
    });

    it('should map youtu.be short URLs to YT', () => {
      const url = 'https://youtu.be/jYFNtUYGxrY';
      expect(resolveSmartGroup(url)).toBe('YT');
    });

    it('should map YouTube Shorts to YT', () => {
      const url = 'https://www.youtube.com/shorts/3i_p5a_ZJ3Y';
      expect(resolveSmartGroup(url)).toBe('YT');
    });

    it('should map mobile and music YouTube URLs to YT', () => {
      expect(resolveSmartGroup('https://m.youtube.com/watch?v=123')).toBe('YT');
      expect(resolveSmartGroup('https://music.youtube.com/watch?v=456')).toBe('YT');
    });
  });

  describe('Instagram Domain Matching (-> Insta)', () => {
    it('should map Instagram posts and reels to Insta', () => {
      expect(resolveSmartGroup('https://www.instagram.com/p/C-12345/')).toBe('Insta');
      expect(resolveSmartGroup('https://instagram.com/reel/C-67890/')).toBe('Insta');
      expect(resolveSmartGroup('https://www.instagram.com/stories/user/123/')).toBe('Insta');
    });

    it('should map instagr.am short links to Insta', () => {
      expect(resolveSmartGroup('https://instagr.am/p/sample')).toBe('Insta');
      expect(resolveSmartGroup('https://ig.me/m/channel')).toBe('Insta');
    });
  });

  describe('X / Twitter Domain Matching (-> X)', () => {
    it('should map x.com and twitter.com URLs to X', () => {
      expect(resolveSmartGroup('https://x.com/levelsio/status/1890000000')).toBe('X');
      expect(resolveSmartGroup('https://twitter.com/shadcn/status/1890000001')).toBe('X');
      expect(resolveSmartGroup('https://mobile.twitter.com/user/status/123')).toBe('X');
    });

    it('should map t.co short links to X', () => {
      expect(resolveSmartGroup('https://t.co/xyz1234')).toBe('X');
    });
  });

  describe('Generic Domains (-> Unsorted)', () => {
    it('should return Unsorted for general websites and blogs', () => {
      expect(resolveSmartGroup('https://github.com/facebook/react')).toBe('Unsorted');
      expect(resolveSmartGroup('https://blog.cloudflare.com/workers')).toBe('Unsorted');
      expect(resolveSmartGroup('https://en.wikipedia.org/wiki/TypeScript')).toBe('Unsorted');
      expect(resolveSmartGroup('https://news.ycombinator.com')).toBe('Unsorted');
    });

    it('should return Unsorted for empty or invalid input', () => {
      expect(resolveSmartGroup('')).toBe('Unsorted');
      expect(resolveSmartGroup('not-a-url')).toBe('Unsorted');
    });
  });

  describe('Available Groups Scoping & Custom Case Matching', () => {
    it('should respect availableGroups list and match case-insensitively', () => {
      const activeGroups = ['YT', 'Insta', 'X', 'Work', 'Unsorted'];
      expect(resolveSmartGroup('https://youtube.com/watch?v=1', activeGroups)).toBe('YT');
      expect(resolveSmartGroup('https://instagram.com/p/1', activeGroups)).toBe('Insta');
      expect(resolveSmartGroup('https://x.com/post/1', activeGroups)).toBe('X');
    });

    it('should fallback to Unsorted if user deleted or renamed the target smart group', () => {
      // User only has 'Work' and 'Unsorted'
      const activeGroups = ['Work', 'Unsorted'];
      expect(resolveSmartGroup('https://youtube.com/watch?v=1', activeGroups)).toBe('Unsorted');
      expect(resolveSmartGroup('https://instagram.com/p/1', activeGroups)).toBe('Unsorted');
      expect(resolveSmartGroup('https://x.com/post/1', activeGroups)).toBe('Unsorted');
    });
  });
});
