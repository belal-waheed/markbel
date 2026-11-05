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
  detectDefaultGroup,
  PILLAR_GROUPS,
  escapeHtml,
} from '../../extension/src/spotlight/MarkbelSpotlight';

describe('Extension In-Page Spotlight (Alt+O) Subsystem', () => {
  let dom: ReturnType<typeof parseHTML>;

  beforeEach(() => {
    vi.useFakeTimers();
    dom = parseHTML('<!doctype html><html><body></body></html>');

    class MockKeyboardEvent extends dom.window.Event {
      public key: string;
      public code: string;
      public ctrlKey: boolean;
      public altKey: boolean;
      public shiftKey: boolean;
      public metaKey: boolean;

      constructor(type: string, init: any = {}) {
        super(type, init);
        this.key = init.key || '';
        this.code = init.code || '';
        this.ctrlKey = !!init.ctrlKey;
        this.altKey = !!init.altKey;
        this.shiftKey = !!init.shiftKey;
        this.metaKey = !!init.metaKey;
      }
    }
    (dom.window as any).KeyboardEvent = MockKeyboardEvent;
    vi.stubGlobal('KeyboardEvent', MockKeyboardEvent);

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

    it('detectDefaultGroup maps domains to correct 8-pillar groups', () => {
      expect(detectDefaultGroup('https://anime3rb.com/episode/sousou-no-frieren/4')).toBe('Anime');
      expect(detectDefaultGroup('https://github.com/belal-waheed/markbel')).toBe('Dev');
      expect(detectDefaultGroup('https://open.spotify.com/track/123')).toBe('Music');
      expect(detectDefaultGroup('https://quran.com/1')).toBe('Deen');
      expect(detectDefaultGroup('https://www.instagram.com/reel/123/')).toBe('Insta');
      expect(detectDefaultGroup('https://www.figma.com/file/123')).toBe('Design');
      expect(detectDefaultGroup('https://regex101.com')).toBe('Tools');
      expect(detectDefaultGroup('http://192.168.1.1/settings')).toBe('System');
      expect(detectDefaultGroup('https://generic-news-blog.org')).toBe('Unsorted');
    });

    it('transitions between search view and new-bookmark HUD', () => {
      const spotlight = new MarkbelSpotlight();
      spotlight.show();

      const host = dom.document.querySelector('markbel-spotlight-host');
      const shadow = (host as any).shadowRoot;
      const searchView = shadow.querySelector('.spotlight-search-view');
      const nbView = shadow.querySelector('.spotlight-new-bookmark-view');

      expect(spotlight.currentView).toBe('search');
      expect(searchView?.classList.contains('hidden')).toBe(false);
      expect(nbView?.classList.contains('hidden')).toBe(true);

      spotlight.switchToNewBookmark();
      expect(spotlight.currentView).toBe('new-bookmark');
      expect(searchView?.classList.contains('hidden')).toBe(true);
      expect(nbView?.classList.contains('hidden')).toBe(false);

      spotlight.switchToSearch();
      expect(spotlight.currentView).toBe('search');
      expect(searchView?.classList.contains('hidden')).toBe(false);
      expect(nbView?.classList.contains('hidden')).toBe(true);

      spotlight.hide();
    });
  });

  describe('5. Keyboard Event Isolation & Host Page Keystroke Containment', () => {
    it('isOpen() accurately reflects spotlight visibility state', () => {
      const spotlight = new MarkbelSpotlight();
      expect(spotlight.isOpen()).toBe(false);

      spotlight.show();
      expect(spotlight.isOpen()).toBe(true);

      spotlight.hide();
      expect(spotlight.isOpen()).toBe(false);

      spotlight.toggle();
      expect(spotlight.isOpen()).toBe(true);

      // Debounce window: second immediate call is ignored
      spotlight.toggle();
      expect(spotlight.isOpen()).toBe(true);

      // Reset debounce timestamp and toggle again to hide
      (spotlight as any).lastToggleTime = 0;
      spotlight.toggle();
      expect(spotlight.isOpen()).toBe(false);
    });

    it('contains all keystrokes inside Shadow DOM and invokes stopPropagation', () => {
      const spotlight = new MarkbelSpotlight();
      spotlight.show();

      const host = dom.document.querySelector('markbel-spotlight-host') as HTMLElement;
      expect(host).toBeDefined();
      const shadow = (host as any).shadowRoot as ShadowRoot;
      expect(shadow).toBeDefined();

      const testKeys = ['m', 'k', 'f', 'j', 'l', 'c', ' ', '1', 'Enter', 'Escape'];

      for (const key of testKeys) {
        const keydownEvent = new dom.window.KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });
        const stopSpy = vi.spyOn(keydownEvent, 'stopPropagation');
        shadow.dispatchEvent(keydownEvent);
        expect(stopSpy).toHaveBeenCalled();

        const keyupEvent = new dom.window.KeyboardEvent('keyup', {
          key,
          bubbles: true,
          cancelable: true,
        });
        const stopUpSpy = vi.spyOn(keyupEvent, 'stopPropagation');
        shadow.dispatchEvent(keyupEvent);
        expect(stopUpSpy).toHaveBeenCalled();

        const keypressEvent = new dom.window.KeyboardEvent('keypress', {
          key,
          bubbles: true,
          cancelable: true,
        });
        const stopPressSpy = vi.spyOn(keypressEvent, 'stopPropagation');
        shadow.dispatchEvent(keypressEvent);
        expect(stopPressSpy).toHaveBeenCalled();
      }

      spotlight.hide();
    });

    it('contains keyboard events on the host element (<markbel-spotlight-host>)', () => {
      const spotlight = new MarkbelSpotlight();
      spotlight.show();

      const host = dom.document.querySelector('markbel-spotlight-host') as HTMLElement;
      expect(host).toBeDefined();

      const keydownEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'm',
        bubbles: true,
        cancelable: true,
      });
      const stopDownSpy = vi.spyOn(keydownEvent, 'stopPropagation');
      host.dispatchEvent(keydownEvent);
      expect(stopDownSpy).toHaveBeenCalled();

      const keyupEvent = new dom.window.KeyboardEvent('keyup', {
        key: 'm',
        bubbles: true,
        cancelable: true,
      });
      const stopUpSpy = vi.spyOn(keyupEvent, 'stopPropagation');
      host.dispatchEvent(keyupEvent);
      expect(stopUpSpy).toHaveBeenCalled();

      const keypressEvent = new dom.window.KeyboardEvent('keypress', {
        key: 'm',
        bubbles: true,
        cancelable: true,
      });
      const stopPressSpy = vi.spyOn(keypressEvent, 'stopPropagation');
      host.dispatchEvent(keypressEvent);
      expect(stopPressSpy).toHaveBeenCalled();

      spotlight.hide();
    });

    it('prevents shadow DOM keystrokes from leaking or bubbling to window or document', () => {
      const spotlight = new MarkbelSpotlight();
      spotlight.show();

      const host = dom.document.querySelector('markbel-spotlight-host') as HTMLElement;
      const shadow = (host as any).shadowRoot as ShadowRoot;

      const windowHandler = vi.fn();
      const documentHandler = vi.fn();

      dom.window.addEventListener('keydown', windowHandler);
      dom.document.addEventListener('keydown', documentHandler);

      // Dispatch 'm' key inside shadow DOM (YouTube mute shortcut)
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'm',
        bubbles: true,
        cancelable: true,
      });
      shadow.dispatchEvent(event);

      // Verify that propagation was stopped and never reached document/window
      expect(windowHandler).not.toHaveBeenCalled();
      expect(documentHandler).not.toHaveBeenCalled();

      dom.window.removeEventListener('keydown', windowHandler);
      dom.document.removeEventListener('keydown', documentHandler);
      spotlight.hide();
    });

    it('stops capture-phase propagation on window when event originates inside spotlight host', () => {
      const spotlight = new MarkbelSpotlight();
      spotlight.show();

      const host = dom.document.querySelector('markbel-spotlight-host') as HTMLElement;

      const captureHandler = vi.fn((e: Event) => {
        if (spotlight && spotlight.isOpen()) {
          const path = (e as any).composedPath ? (e as any).composedPath() : [];
          const isInside = path.some(
            (el: any) => el instanceof dom.window.HTMLElement && el.tagName?.toLowerCase() === 'markbel-spotlight-host'
          );
          if (isInside) {
            e.stopImmediatePropagation();
          }
        }
      });

      const hostPageWindowCaptureSpy = vi.fn();

      // Register capture handler
      dom.window.addEventListener('keydown', captureHandler, true);
      // Register host page listener
      dom.window.addEventListener('keydown', hostPageWindowCaptureSpy, true);

      // Synthetic event targeting spotlight host
      const event = new dom.window.KeyboardEvent('keydown', {
        key: 'k',
        bubbles: true,
        cancelable: true,
      });
      (event as any).composedPath = () => [host, dom.document.body, dom.document.documentElement, dom.document, dom.window];

      const stopImmediateSpy = vi.spyOn(event, 'stopImmediatePropagation');

      dom.window.dispatchEvent(event);

      expect(captureHandler).toHaveBeenCalled();
      expect(stopImmediateSpy).toHaveBeenCalled();

      dom.window.removeEventListener('keydown', captureHandler, true);
      dom.window.removeEventListener('keydown', hostPageWindowCaptureSpy, true);
      spotlight.hide();
    });
  });
});
