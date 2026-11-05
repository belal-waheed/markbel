/**
 * Extension Content Script & In-DOM Metadata Extractor Unit Tests
 * Follows AAA (Arrange-Act-Assert) pattern.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractPageMetadata,
  extractYouTubeId,
  resolveAbsoluteUrl,
  getMeta,
  type ExtractedPageMetadata,
} from '../../extension/src/metadata/extractPageMetadata';

describe('ExtensionContent - extractPageMetadata & DOM Extraction Subsystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('1. OpenGraph Protocol Extraction', () => {
    it('extracts complete OpenGraph metadata with canonical URL and article type', () => {
      // Arrange
      const url = 'https://techblog.example.com/posts/deep-learning-2026?utm_source=feed';
      const mockSelectors: Record<string, string> = {
        'meta[property="og:title"]': 'Deep Learning Frontiers 2026',
        'meta[property="og:description"]': 'A comprehensive survey of current LLM and agentic architectures.',
        'meta[property="og:image"]': 'https://cdn.example.com/assets/og-cover.png',
        'meta[property="og:site_name"]': 'TechBlog Engineering',
        'link[rel="canonical"]': 'https://techblog.example.com/posts/deep-learning-2026',
        'meta[property="og:type"]': 'article',
      };

      const doc = {
        title: 'Deep Learning Frontiers 2026 | TechBlog',
        querySelector: (sel: string) => {
          const val = mockSelectors[sel];
          if (!val) return null;
          return {
            getAttribute: (attr: string) => (attr === 'content' || attr === 'href' ? val : null),
            textContent: val,
            innerText: val,
          };
        },
      };

      const win = {
        location: {
          href: url,
          hostname: 'techblog.example.com',
        },
        getSelection: () => ({ toString: () => '' }),
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.title).toBe('Deep Learning Frontiers 2026');
      expect(result.description).toBe('A comprehensive survey of current LLM and agentic architectures.');
      expect(result.image).toBe('https://cdn.example.com/assets/og-cover.png');
      expect(result.siteName).toBe('TechBlog Engineering');
      expect(result.url).toBe('https://techblog.example.com/posts/deep-learning-2026');
      expect(result.rawUrl).toBe(url);
      expect(result.contentType).toBe('article');
    });

    it('falls back to secure_url when standard og:image is not provided', () => {
      // Arrange
      const mockSelectors: Record<string, string> = {
        'meta[property="og:title"]': 'Secure Asset Article',
        'meta[property="og:image:secure_url"]': 'https://secure.example.com/og.png',
      };

      const doc = {
        title: 'Fallback Secure Image',
        querySelector: (sel: string) => {
          const val = mockSelectors[sel];
          return val ? { getAttribute: () => val } : null;
        },
      };

      const win = {
        location: { href: 'https://example.com/page', hostname: 'example.com' },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.image).toBe('https://secure.example.com/og.png');
    });
  });

  describe('2. Twitter Card Fallback Tags', () => {
    it('falls back to twitter card meta tags when OpenGraph tags are missing', () => {
      // Arrange
      const mockSelectors: Record<string, string> = {
        'meta[name="twitter:title"]': 'Twitter Card Title',
        'meta[name="twitter:description"]': '140 character summary of the modern web platform.',
        'meta[name="twitter:image"]': 'https://pbs.twimg.com/media/banner.jpg',
      };

      const doc = {
        title: 'Original Tab Title',
        querySelector: (sel: string) => {
          const val = mockSelectors[sel];
          return val ? { getAttribute: (attr: string) => (attr === 'content' ? val : null) } : null;
        },
      };

      const win = {
        location: { href: 'https://news.example.com/story', hostname: 'news.example.com' },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.title).toBe('Twitter Card Title');
      expect(result.description).toBe('140 character summary of the modern web platform.');
      expect(result.image).toBe('https://pbs.twimg.com/media/banner.jpg');
    });

    it('falls back to twitter:image:src when twitter:image is omitted', () => {
      // Arrange
      const mockSelectors: Record<string, string> = {
        'meta[name="twitter:image:src"]': 'https://cdn.example.com/tw-src.jpg',
      };

      const doc = {
        title: 'Twitter Src Page',
        querySelector: (sel: string) => {
          const val = mockSelectors[sel];
          return val ? { getAttribute: () => val } : null;
        },
      };

      const win = {
        location: { href: 'https://example.com/item', hostname: 'example.com' },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.image).toBe('https://cdn.example.com/tw-src.jpg');
    });
  });

  describe('3. Standard Document & Favicon Fallback', () => {
    it('falls back to document title and Google favicon service when all meta tags are absent', () => {
      // Arrange
      const doc = {
        title: 'Standard Unadorned Webpage',
        querySelector: () => null,
      };

      const win = {
        location: { href: 'https://minimal.org/about', hostname: 'minimal.org' },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.title).toBe('Standard Unadorned Webpage');
      expect(result.description).toBe('');
      expect(result.image).toBe('');
      expect(result.favicon).toBe('https://www.google.com/s2/favicons?domain=minimal.org&sz=64');
      expect(result.siteName).toBe('minimal.org');
      expect(result.url).toBe('https://minimal.org/about');
    });

    it('extracts apple-touch-icon and resolves relative href against page origin', () => {
      // Arrange
      const mockSelectors: Record<string, string> = {
        'link[rel="apple-touch-icon"]': '/icons/apple-180x180.png',
      };

      const doc = {
        title: 'Mobile Web App',
        querySelector: (sel: string) => {
          const val = mockSelectors[sel];
          return val ? { getAttribute: (attr: string) => (attr === 'href' ? val : null) } : null;
        },
      };

      const win = {
        location: { href: 'https://app.example.com/dashboard', hostname: 'app.example.com' },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.favicon).toBe('https://app.example.com/icons/apple-180x180.png');
    });

    it('prioritizes user text selection over page meta description', () => {
      // Arrange
      const mockSelectors: Record<string, string> = {
        'meta[property="og:description"]': 'Default author summary of the article.',
      };

      const doc = {
        title: 'Research Paper',
        querySelector: (sel: string) => {
          const val = mockSelectors[sel];
          return val ? { getAttribute: () => val } : null;
        },
      };

      const win = {
        location: { href: 'https://arxiv.org/abs/2601.12345', hostname: 'arxiv.org' },
        getSelection: () => ({
          toString: () => 'Crucial highlighted excerpt proving the thesis.',
        }),
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.selectedText).toBe('Crucial highlighted excerpt proving the thesis.');
      expect(result.description).toBe('Crucial highlighted excerpt proving the thesis.');
    });
  });

  describe('4. YouTube Video ID & Metadata Specialization', () => {
    it('extracts video ID from standard youtube.com/watch?v= format and strips YouTube suffix', () => {
      // Arrange
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s';
      const doc = {
        title: 'Rick Astley - Never Gonna Give You Up (Official Music Video) - YouTube',
        querySelector: () => null,
      };
      const win = {
        location: { href: url, hostname: 'www.youtube.com' },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.title).toBe('Rick Astley - Never Gonna Give You Up (Official Music Video)');
      expect(result.image).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(result.contentType).toBe('video');
      expect(result.url).toBe(url);
    });

    it('extracts video ID from youtube.com/shorts/ format', () => {
      // Arrange
      const url = 'https://www.youtube.com/shorts/v3ShortId99?feature=share';
      const doc = {
        title: 'Fast CSS Tip - YouTube',
        querySelector: () => null,
      };
      const win = {
        location: { href: url, hostname: 'www.youtube.com' },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.title).toBe('Fast CSS Tip');
      expect(result.image).toBe('https://img.youtube.com/vi/v3ShortId99/hqdefault.jpg');
      expect(result.contentType).toBe('video');
    });

    it('extracts video ID from youtube.com/embed/ format', () => {
      // Arrange
      const url = 'https://www.youtube.com/embed/embed7788?autoplay=1';
      const doc = {
        title: 'Embedded Player - YouTube',
        querySelector: () => null,
      };
      const win = {
        location: { href: url, hostname: 'www.youtube.com' },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.title).toBe('Embedded Player');
      expect(result.image).toBe('https://img.youtube.com/vi/embed7788/hqdefault.jpg');
      expect(result.contentType).toBe('video');
    });

    it('extracts video ID from youtu.be short link format', () => {
      // Arrange
      const url = 'https://youtu.be/short9900?t=15';
      const doc = {
        title: 'Short Share URL - YouTube',
        querySelector: () => null,
      };
      const win = {
        location: { href: url, hostname: 'youtu.be' },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.title).toBe('Short Share URL');
      expect(result.image).toBe('https://img.youtube.com/vi/short9900/hqdefault.jpg');
      expect(result.contentType).toBe('video');
    });

    it('flags playlist contentType when YouTube URL contains list query param', () => {
      // Arrange
      const url = 'https://www.youtube.com/watch?v=abc1234&list=PL123456789';
      const doc = {
        title: 'Playlist Mix - YouTube',
        querySelector: () => null,
      };
      const win = {
        location: { href: url, hostname: 'www.youtube.com' },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(doc, win);

      // Assert
      expect(result.contentType).toBe('playlist');
    });

    it('extractYouTubeId helper handles watch, shorts, embed, and youtu.be variants directly', () => {
      // Act & Assert
      expect(extractYouTubeId('https://www.youtube.com/watch?v=watch123')).toBe('watch123');
      expect(extractYouTubeId('https://www.youtube.com/shorts/shorts456')).toBe('shorts456');
      expect(extractYouTubeId('https://www.youtube.com/embed/embed789')).toBe('embed789');
      expect(extractYouTubeId('https://youtu.be/be321')).toBe('be321');
      expect(extractYouTubeId('https://example.com/not-youtube')).toBe('');
      expect(extractYouTubeId('')).toBe('');
    });
  });

  describe('5. Relative URL Resolution Against Mock Document Base', () => {
    it('resolves root-relative path against base domain', () => {
      // Arrange & Act
      const resolved = resolveAbsoluteUrl('/assets/images/banner.webp', 'https://example.com/category/article-1');

      // Assert
      expect(resolved).toBe('https://example.com/assets/images/banner.webp');
    });

    it('resolves relative path with directory navigation against base document URL', () => {
      // Arrange & Act
      const resolved = resolveAbsoluteUrl('../shared/logo.svg', 'https://example.com/docs/guides/intro.html');

      // Assert
      expect(resolved).toBe('https://example.com/docs/shared/logo.svg');
    });

    it('resolves protocol-relative URL against base protocol', () => {
      // Arrange & Act
      const resolved = resolveAbsoluteUrl('//static.cdn.com/bundle.js', 'https://example.com');

      // Assert
      expect(resolved).toBe('https://static.cdn.com/bundle.js');
    });

    it('returns already absolute URLs intact', () => {
      // Arrange & Act
      const resolved = resolveAbsoluteUrl('https://images.unsplash.com/photo-1', 'https://example.com');

      // Assert
      expect(resolved).toBe('https://images.unsplash.com/photo-1');
    });

    it('handles empty or invalid inputs gracefully', () => {
      // Arrange & Act & Assert
      expect(resolveAbsoluteUrl('')).toBe('');
      expect(resolveAbsoluteUrl('not-a-valid:url://broken', 'invalid-base')).toBe('not-a-valid:url://broken');
    });
  });

  describe('6. Global Stub Fallback Integration', () => {
    it('executes extractPageMetadata() without arguments by reading globalThis window and document', () => {
      // Arrange
      vi.stubGlobal('document', {
        title: 'Global Stubs Test Document',
        querySelector: (sel: string) => {
          if (sel === 'meta[property="og:title"]') {
            return { getAttribute: () => 'Global Stub OG Title' };
          }
          return null;
        },
      });

      vi.stubGlobal('window', {
        location: {
          href: 'https://global-test.example.com/index',
          hostname: 'global-test.example.com',
        },
        getSelection: () => null,
      });

      // Act
      const result: ExtractedPageMetadata = extractPageMetadata();

      // Assert
      expect(result.title).toBe('Global Stub OG Title');
      expect(result.url).toBe('https://global-test.example.com/index');
      expect(result.siteName).toBe('global-test.example.com');
      expect(result.favicon).toBe('https://www.google.com/s2/favicons?domain=global-test.example.com&sz=64');
    });
  });

  describe('7. getMeta Selector Hierarchy', () => {
    it('scans selectors in precedence order and returns the first matching non-empty attribute', () => {
      // Arrange
      const mockDoc = {
        querySelector: (selector: string) => {
          if (selector === 'meta[name="twitter:title"]') {
            return { getAttribute: () => 'Second Choice Title' };
          }
          if (selector === 'h1') {
            return { textContent: 'Heading Title' };
          }
          return null;
        },
      };

      // Act
      const value = getMeta(
        ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'h1'],
        mockDoc
      );

      // Assert
      expect(value).toBe('Second Choice Title');
    });
  });

  describe('8. Instagram In-DOM Poster Extraction', () => {
    it('extracts video poster when saving from an active Instagram Reel tab', () => {
      // Arrange
      const mockDoc = {
        title: 'User on Instagram: "Awesome Reel"',
        querySelector: (selector: string) => {
          if (selector === 'meta[property="og:image"]') {
            // Instagram often outputs 1x1 tracking pixel in og:image
            return { getAttribute: () => 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/something.png' };
          }
          if (selector.includes('article video[poster]') || selector.includes('video[poster]')) {
            return {
              getAttribute: (attr: string) => (attr === 'poster' ? 'https://scontent.cdninstagram.com/v/t51.2885-15/poster.jpg' : null),
              poster: 'https://scontent.cdninstagram.com/v/t51.2885-15/poster.jpg',
            };
          }
          return null;
        },
      };

      const mockWin = {
        location: {
          href: 'https://www.instagram.com/reel/C123456789/',
          hostname: 'www.instagram.com',
        },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(mockDoc, mockWin);

      // Assert
      expect(result.image).toBe('https://scontent.cdninstagram.com/v/t51.2885-15/poster.jpg');
      expect(result.siteName).toBe('instagram.com');
    });

    it('extracts img srcset candidate when modal dialog contains post photo', () => {
      // Arrange
      const mockDoc = {
        title: 'Instagram Photo',
        querySelector: (selector: string) => {
          if (selector.includes('div[role="dialog"] img[srcset]')) {
            return {
              getAttribute: (attr: string) => {
                if (attr === 'srcset') {
                  return 'https://scontent.cdninstagram.com/small.jpg 320w, https://scontent.cdninstagram.com/large.jpg 1080w';
                }
                return null;
              },
            };
          }
          return null;
        },
      };

      const mockWin = {
        location: {
          href: 'https://www.instagram.com/p/C987654321/',
          hostname: 'www.instagram.com',
        },
        getSelection: () => null,
      };

      // Act
      const result = extractPageMetadata(mockDoc, mockWin);

      // Assert
      expect(result.image).toBe('https://scontent.cdninstagram.com/large.jpg');
    });
  });
});
