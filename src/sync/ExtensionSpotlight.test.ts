/**
 * Extension In-Page Spotlight Command Palette Unit Tests
 * Follows AAA (Arrange-Act-Assert) pattern.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseHTML } from 'linkedom';
import {
  MarkbelSpotlight,
  getGroupColorToken,
  inferContentType,
  detectSeriesBadge,
  escapeHtml,
} from '../../extension/src/spotlight/MarkbelSpotlight';

describe('Extension In-Page Spotlight (Alt+O) Subsystem', () => {
  let dom: ReturnType<typeof parseHTML>;

  beforeEach(() => {
    vi.useFakeTimers();
    dom = parseHTML('<!doctype html><html><body></body></html>');
    vi.stubGlobal('document', dom.document);
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } });

    // Mock chrome APIs
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn(),
        onMessage: { addListener: vi.fn() },
      },
      storage: {
        local: {
          get: vi.fn((_keys, cb) => cb && cb({})),
          set: vi.fn(),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('1. Design System Group Color Tokens', () => {
    it('maps anime groups to indigo tokens', () => {
      const token = getGroupColorToken('Anime');
      expect(token.color).toBe('#818cf8');
      expect(token.bg).toContain('rgba(99, 102, 241');
    });

    it('maps developer groups to emerald tokens', () => {
      const token = getGroupColorToken('Dev');
      expect(token.color).toBe('#34d399');
      expect(token.bg).toContain('rgba(16, 185, 129');
    });

    it('maps music/audio groups to amber tokens', () => {
      const token = getGroupColorToken('Music');
      expect(token.color).toBe('#fbbf24');
      expect(token.bg).toContain('rgba(245, 158, 11');
    });

    it('maps instagram/social groups to pink tokens', () => {
      const token = getGroupColorToken('Insta');
      expect(token.color).toBe('#f472b6');
      expect(token.bg).toContain('rgba(236, 72, 153');
    });

    it('maps islamic/deen groups to teal tokens', () => {
      const token = getGroupColorToken('Deen');
      expect(token.color).toBe('#2dd4bf');
      expect(token.bg).toContain('rgba(20, 184, 166');
    });

    it('maps tools to cyan tokens', () => {
      const token = getGroupColorToken('Tools');
      expect(token.color).toBe('#38bdf8');
      expect(token.bg).toContain('rgba(6, 182, 212');
    });

    it('maps design to rose tokens', () => {
      const token = getGroupColorToken('Design');
      expect(token.color).toBe('#fb7185');
      expect(token.bg).toContain('rgba(244, 63, 94');
    });

    it('falls back to slate tokens for undefined or generic groups', () => {
      const token = getGroupColorToken(undefined);
      expect(token.color).toBe('#94a3b8');
      expect(token.bg).toContain('rgba(148, 163, 184');
    });
  });

  describe('2. Content Type Inference', () => {
    it('infers Video for streaming platforms', () => {
      expect(inferContentType({ id: '1', title: 'Video', url: 'https://www.youtube.com/watch?v=123' })).toBe('Video');
      expect(inferContentType({ id: '2', title: 'Anime', url: 'https://anime3rb.com/episode/sousou-no-frieren/4' })).toBe('Video');
      expect(inferContentType({ id: '3', title: 'EgyDead', url: 'https://egydead.co/episodes/breaking-bad-s01e05/' })).toBe('Video');
    });

    it('infers Code for repository hosts', () => {
      expect(inferContentType({ id: '4', title: 'Repo', url: 'https://github.com/belal-waheed/markbel' })).toBe('Code');
    });

    it('infers Social for social networks', () => {
      expect(inferContentType({ id: '5', title: 'Reel', url: 'https://www.instagram.com/reel/123/' })).toBe('Social');
      expect(inferContentType({ id: '6', title: 'Post', url: 'https://x.com/user/status/123' })).toBe('Social');
    });

    it('respects explicit contentType on the bookmark', () => {
      expect(inferContentType({ id: '7', title: 'Doc', url: 'https://example.com', contentType: 'article' })).toBe('Article');
      expect(inferContentType({ id: '8', title: 'Music', url: 'https://example.com', contentType: 'audio' })).toBe('Audio');
    });
  });

  describe('3. Series Episode Badge Detection', () => {
    it('formats badge from seriesEpisode & seriesSeason metadata', () => {
      const badge = detectSeriesBadge({
        id: '1',
        title: 'Anime Ep',
        url: 'https://example.com',
        seriesSeason: 2,
        seriesEpisode: 14,
      });
      expect(badge).toBe('S2 EP 14');
    });

    it('parses series progression from episodic URLs', () => {
      const badge = detectSeriesBadge({
        id: '2',
        title: 'Frieren 4',
        url: 'https://anime3rb.com/episode/sousou-no-frieren/4',
      });
      expect(badge).toBe('EP 4');
    });

    it('returns null for non-episodic bookmarks', () => {
      const badge = detectSeriesBadge({
        id: '3',
        title: 'Google Search',
        url: 'https://google.com',
      });
      expect(badge).toBeNull();
    });
  });

  describe('4. MarkbelSpotlight Lifecycle, Theming & Dual-Mode Rendering', () => {
    it('mounts into Shadow DOM and toggles light and dark modes', () => {
      const spotlight = new MarkbelSpotlight();
      spotlight.show();

      const host = dom.document.querySelector('markbel-spotlight-host');
      expect(host).toBeDefined();

      const shadow = (host as any).shadowRoot;
      expect(shadow).toBeDefined();

      const overlay = shadow.querySelector('.spotlight-overlay');
      expect(overlay).toBeDefined();

      // Test theme switching
      spotlight.setTheme('light');
      expect(host?.getAttribute('data-theme')).toBe('light');
      expect(overlay?.classList.contains('theme-light')).toBe(true);

      spotlight.setTheme('dark');
      expect(host?.getAttribute('data-theme')).toBe('dark');
      expect(overlay?.classList.contains('theme-dark')).toBe(true);

      spotlight.hide();
      expect((host as HTMLElement)?.style.display).toBe('none');
    });

    it('switches between Visual Cards and Compact List view modes', () => {
      const spotlight = new MarkbelSpotlight();
      spotlight.show();

      const host = dom.document.querySelector('markbel-spotlight-host');
      const shadow = (host as any).shadowRoot;
      const resultsList = shadow.querySelector('.spotlight-results');

      spotlight.setViewMode('visual');
      expect(resultsList?.classList.contains('view-visual')).toBe(true);
      expect(resultsList?.classList.contains('view-compact')).toBe(false);

      spotlight.setViewMode('compact');
      expect(resultsList?.classList.contains('view-compact')).toBe(true);
      expect(resultsList?.classList.contains('view-visual')).toBe(false);

      spotlight.hide();
    });
  });
});
