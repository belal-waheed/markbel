import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isExpiredSocialCdnUrl,
  getInitialStage,
  type ImageStage,
} from './BookmarkImage';

describe('BookmarkImage 4-Stage Fallback FSM & Social CDN Expired Check', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      onLine: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isExpiredSocialCdnUrl', () => {
    it('returns false for standard non-social URLs', () => {
      expect(isExpiredSocialCdnUrl('https://images.unsplash.com/photo-123')).toBe(false);
      expect(isExpiredSocialCdnUrl('https://example.com/image.png')).toBe(false);
      expect(isExpiredSocialCdnUrl('https://i.ytimg.com/vi/abc/hqdefault.jpg')).toBe(false);
    });

    it('returns false for invalid or empty URLs', () => {
      expect(isExpiredSocialCdnUrl('')).toBe(false);
      expect(isExpiredSocialCdnUrl('not-a-url')).toBe(false);
    });

    it('returns false for Instagram/Facebook URLs without oe parameter', () => {
      expect(isExpiredSocialCdnUrl('https://scontent.cdninstagram.com/v/t51.2885-15/pic.jpg')).toBe(false);
      expect(isExpiredSocialCdnUrl('https://scontent.xx.fbcdn.net/v/t1.15718-9/pic.jpg')).toBe(false);
    });

    it('returns false for Instagram/Facebook URLs with non-hex oe parameter', () => {
      expect(isExpiredSocialCdnUrl('https://scontent.cdninstagram.com/v/pic.jpg?oe=invalid')).toBe(false);
      expect(isExpiredSocialCdnUrl('https://scontent.cdninstagram.com/v/pic.jpg?oe=123')).toBe(false);
    });

    it('returns true for expired Instagram CDN URLs with past oe hex timestamp', () => {
      // 0x5f8b2c00 is 1602956288 (October 2020)
      const expiredUrl = 'https://scontent.cdninstagram.com/v/t51.2885-15/photo.jpg?oe=5F8B2C00&_nc_ht=scontent.cdninstagram.com';
      expect(isExpiredSocialCdnUrl(expiredUrl)).toBe(true);
    });

    it('returns true for expired Facebook CDN URLs with past oe hex timestamp', () => {
      const expiredFbUrl = 'https://scontent.xx.fbcdn.net/v/t1.15718-9/photo.jpg?oe=5F8B2C00';
      expect(isExpiredSocialCdnUrl(expiredFbUrl)).toBe(true);
    });

    it('returns false for future valid Instagram CDN URLs', () => {
      // Calculate hex timestamp 7 days in the future
      const futureSeconds = Math.floor(Date.now() / 1000) + 7 * 86400;
      const futureHex = futureSeconds.toString(16).toUpperCase();
      const validUrl = `https://scontent.cdninstagram.com/v/t51.2885-15/photo.jpg?oe=${futureHex}`;
      expect(isExpiredSocialCdnUrl(validUrl)).toBe(false);
    });
  });

  describe('getInitialStage (Zero-Cost Pre-Skipping)', () => {
    it('initializes to DIRECT for normal valid images when online', () => {
      const stage = getInitialStage('https://example.com/banner.jpg', 'https://example.com/favicon.ico');
      expect(stage).toBe('DIRECT');
    });

    it('short-circuits directly to FAVICON when image is missing but fallbackSrc is provided', () => {
      const stage = getInitialStage('', 'https://example.com/favicon.ico');
      expect(stage).toBe('FAVICON');
    });

    it('short-circuits directly to PLACEHOLDER when both src and fallbackSrc are missing', () => {
      const stage = getInitialStage(null, null);
      expect(stage).toBe('PLACEHOLDER');
    });

    it('short-circuits to FAVICON with 0 network requests for expired social CDN URLs', () => {
      const expiredInstagram = 'https://scontent.cdninstagram.com/v/photo.jpg?oe=5F8B2C00';
      const fallbackFavicon = 'https://www.google.com/s2/favicons?domain=instagram.com';
      const stage = getInitialStage(expiredInstagram, fallbackFavicon);
      expect(stage).toBe('FAVICON');
    });

    it('short-circuits to PLACEHOLDER for expired social CDN URLs if no fallbackSrc is provided', () => {
      const expiredInstagram = 'https://scontent.cdninstagram.com/v/photo.jpg?oe=5F8B2C00';
      const stage = getInitialStage(expiredInstagram, undefined);
      expect(stage).toBe('PLACEHOLDER');
    });

    it('skips directly to PLACEHOLDER when offline to prevent socket storms and connection pool exhaustion', () => {
      vi.stubGlobal('navigator', {
        onLine: false,
      });

      const stage = getInitialStage('https://example.com/banner.jpg', 'https://example.com/favicon.ico');
      expect(stage).toBe('PLACEHOLDER');
    });
  });

  describe('FSM Transition Logic Simulation', () => {
    // Pure simulation of the BookmarkImage onError state machine transitions
    function simulateTransition(
      currentStage: ImageStage,
      src: string | null | undefined,
      fallbackSrc: string | null | undefined,
      isOnline: boolean = true
    ): ImageStage {
      if (!isOnline) {
        return 'PLACEHOLDER';
      }

      const trimmedSrc = src?.trim();
      const trimmedFallback = fallbackSrc?.trim();

      if (currentStage === 'DIRECT') {
        if (trimmedSrc) return 'PROXY';
        if (trimmedFallback) return 'FAVICON';
        return 'PLACEHOLDER';
      }

      if (currentStage === 'PROXY') {
        if (trimmedFallback && trimmedFallback !== trimmedSrc) {
          return 'FAVICON';
        }
        return 'PLACEHOLDER';
      }

      return 'PLACEHOLDER';
    }

    it('transitions DIRECT -> PROXY -> FAVICON -> PLACEHOLDER on consecutive failures', () => {
      const src = 'https://example.com/image.jpg';
      const fallback = 'https://example.com/favicon.ico';

      // 1. Initial stage is DIRECT
      let stage: ImageStage = 'DIRECT';

      // 2. Error on DIRECT triggers PROXY
      stage = simulateTransition(stage, src, fallback);
      expect(stage).toBe('PROXY');

      // 3. Error on PROXY triggers FAVICON
      stage = simulateTransition(stage, src, fallback);
      expect(stage).toBe('FAVICON');

      // 4. Error on FAVICON triggers terminal PLACEHOLDER
      stage = simulateTransition(stage, src, fallback);
      expect(stage).toBe('PLACEHOLDER');

      // 5. Further errors stay at terminal PLACEHOLDER
      stage = simulateTransition(stage, src, fallback);
      expect(stage).toBe('PLACEHOLDER');
    });

    it('transitions directly to PLACEHOLDER from PROXY if fallbackSrc is identical to src', () => {
      const sameSrc = 'https://example.com/favicon.ico';
      const stage = simulateTransition('PROXY', sameSrc, sameSrc);
      expect(stage).toBe('PLACEHOLDER');
    });

    it('transitions directly to PLACEHOLDER from PROXY if fallbackSrc is missing', () => {
      const src = 'https://example.com/image.jpg';
      const stage = simulateTransition('PROXY', src, null);
      expect(stage).toBe('PLACEHOLDER');
    });

    it('drops immediately to PLACEHOLDER on error when offline', () => {
      const src = 'https://example.com/image.jpg';
      const fallback = 'https://example.com/favicon.ico';

      const stage = simulateTransition('DIRECT', src, fallback, false);
      expect(stage).toBe('PLACEHOLDER');
    });
  });
});
