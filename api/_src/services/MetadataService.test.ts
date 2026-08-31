import { describe, it, expect, vi } from 'vitest';
import {
  MetadataService,
  isSafePublicUrl,
  sanitizeAndCleanUrl,
  cleanText,
  synthesizeFallbackMetadata,
  SSRFValidationError,
} from './MetadataService.js';

describe('MetadataService Unit Tests (AAA Pattern)', () => {
  describe('SSRF Protection (isSafePublicUrl)', () => {
    it('should allow valid public HTTP/HTTPS URLs', () => {
      // Arrange & Act & Assert
      expect(isSafePublicUrl('https://example.com/article')).toBe(true);
      expect(isSafePublicUrl('https://github.com/facebook/react')).toBe(true);
      expect(isSafePublicUrl('http://subdomain.news.site.org/post/123')).toBe(true);
    });

    it('should block localhost, loopback, and zero addresses', () => {
      // Arrange & Act & Assert
      expect(isSafePublicUrl('http://localhost:3000')).toBe(false);
      expect(isSafePublicUrl('http://127.0.0.1/admin')).toBe(false);
      expect(isSafePublicUrl('http://127.0.0.2:8080')).toBe(false);
      expect(isSafePublicUrl('http://0.0.0.0')).toBe(false);
      expect(isSafePublicUrl('http://[::1]')).toBe(false);
      expect(isSafePublicUrl('http://app.localhost')).toBe(false);
      expect(isSafePublicUrl('http://server.local')).toBe(false);
      expect(isSafePublicUrl('http://corp.internal')).toBe(false);
    });

    it('should block RFC 1918 private IPv4 subnets', () => {
      // Arrange & Act & Assert
      // 10.0.0.0/8
      expect(isSafePublicUrl('http://10.0.0.1')).toBe(false);
      expect(isSafePublicUrl('http://10.255.255.255/secret')).toBe(false);

      // 172.16.0.0/12
      expect(isSafePublicUrl('http://172.16.0.1')).toBe(false);
      expect(isSafePublicUrl('http://172.31.255.255')).toBe(false);

      // 192.168.0.0/16
      expect(isSafePublicUrl('http://192.168.1.1/router')).toBe(false);
      expect(isSafePublicUrl('http://192.168.0.254')).toBe(false);
    });

    it('should block Cloud Provider Metadata Endpoints (AWS / GCP / Azure)', () => {
      // Arrange & Act & Assert
      expect(isSafePublicUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
      expect(isSafePublicUrl('http://metadata.google.internal/computeMetadata/v1/')).toBe(false);
    });

    it('should reject non-HTTP protocols', () => {
      // Arrange & Act & Assert
      expect(isSafePublicUrl('file:///etc/passwd')).toBe(false);
      expect(isSafePublicUrl('ftp://ftp.example.com')).toBe(false);
      expect(isSafePublicUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('URL Sanitization (sanitizeAndCleanUrl)', () => {
    it('should strip common tracking parameters from query string', () => {
      // Arrange
      const dirtyUrl =
        'https://example.com/article?id=42&utm_source=twitter&utm_medium=social&utm_campaign=launch&fbclid=IwAR123&gclid=ABC789';

      // Act
      const { targetUrl, cleanUrlStr } = sanitizeAndCleanUrl(dirtyUrl);

      // Assert
      expect(targetUrl.searchParams.get('id')).toBe('42');
      expect(targetUrl.searchParams.has('utm_source')).toBe(false);
      expect(targetUrl.searchParams.has('utm_medium')).toBe(false);
      expect(targetUrl.searchParams.has('utm_campaign')).toBe(false);
      expect(targetUrl.searchParams.has('fbclid')).toBe(false);
      expect(targetUrl.searchParams.has('gclid')).toBe(false);
      expect(cleanUrlStr).toBe('https://example.com/article?id=42');
    });

    it('should add https:// if scheme is missing', () => {
      // Arrange
      const raw = 'github.com/facebook/react';

      // Act
      const { targetUrl, cleanUrlStr } = sanitizeAndCleanUrl(raw);

      // Assert
      expect(targetUrl.protocol).toBe('https:');
      expect(cleanUrlStr).toBe('https://github.com/facebook/react');
    });
  });

  describe('cleanText Helper', () => {
    it('should decode HTML entities and collapse duplicate whitespace', () => {
      // Arrange
      const input = 'React &amp; Next.js &mdash; Fast &amp; Modern   &#39;App&#39; &quot;Guide&quot;';

      // Act
      const result = cleanText(input);

      // Assert
      expect(result).toBe("React & Next.js &mdash; Fast & Modern 'App' \"Guide\"");
    });
  });

  describe('Fallback Synthesis (synthesizeFallbackMetadata)', () => {
    it('should derive clean title and favicon from URL hostname and path', () => {
      // Arrange
      const url = new URL('https://blog.cloudflare.com/introducing-workers-kv');

      // Act
      const fallback = synthesizeFallbackMetadata(url);

      // Assert
      expect(fallback.title).toContain('Introducing workers kv');
      expect(fallback.siteName).toBe('blog.cloudflare.com');
      expect(fallback.favicon).toContain('google.com/s2/favicons');
      expect(fallback.contentType).toBe('website');
    });
  });

  describe('MetadataService.extractMetadata', () => {
    it('should throw SSRFValidationError when given a private/loopback URL', async () => {
      // Arrange
      const privateUrl = 'http://192.168.1.100/admin';

      // Act & Assert
      await expect(MetadataService.extractMetadata(privateUrl)).rejects.toThrow(
        SSRFValidationError
      );
    });

    it('should throw Error when URL is empty or invalid', async () => {
      // Arrange & Act & Assert
      await expect(MetadataService.extractMetadata('')).rejects.toThrow();
    });

    it('should successfully extract metadata from a mock YouTube URL', async () => {
      // Arrange
      const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

      // Act
      const meta = await MetadataService.extractMetadata(ytUrl);

      // Assert
      expect(meta.contentType).toBe('video');
      expect(meta.siteName).toBe('YouTube');
      expect(meta.image).toContain('dQw4w9WgXcQ');
      expect(meta.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should extract rich article metadata, reading time, and author from live or mock HTML', async () => {
      // Arrange
      const sampleHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <title>Modern Web Architecture Patterns</title>
          <meta property="og:title" content="Modern Web Architecture Patterns" />
          <meta property="og:description" content="A comprehensive guide to building resilient distributed web systems." />
          <meta property="og:image" content="https://example.com/cover.png" />
          <meta property="og:site_name" content="Tech Journal" />
          <meta name="author" content="Alex Rivers" />
          <link rel="canonical" href="https://example.com/posts/arch-patterns" />
          <link rel="icon" href="/favicon.png" />
        </head>
        <body>
          <article>
            <h1>Modern Web Architecture Patterns</h1>
            <p>Building modern web applications requires a disciplined approach to state management, caching, and resilient API gateways.</p>
            <p>In this deep dive, we explore edge workers, distributed databases with Last-Write-Wins synchronization, and lightweight event streams.</p>
            <p>Furthermore, defensive coding practices such as server-side request forgery (SSRF) validation and structured error handling are essential.</p>
          </article>
        </body>
        </html>
      `;

      // Mock global fetch to return sampleHtml
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        url: 'https://example.com/posts/arch-patterns',
        text: async () => sampleHtml,
        json: async () => ({}),
      } as any);

      try {
        // Act
        const meta = await MetadataService.extractMetadata('https://example.com/posts/arch-patterns', {
          includeArticleContent: true,
        });

        // Assert
        expect(meta.title).toBe('Modern Web Architecture Patterns');
        expect(meta.description).toContain('comprehensive guide');
        expect(meta.author).toBe('Alex Rivers');
        expect(meta.siteName).toBe('Tech Journal');
        expect(meta.image).toBe('https://example.com/cover.png');
        expect(meta.favicon).toBe('https://example.com/favicon.png');
        expect(meta.canonicalUrl).toBe('https://example.com/posts/arch-patterns');
        expect(meta.contentType).toBe('article');
        expect(meta.wordCount).toBeGreaterThan(20);
        expect(meta.readingTime).toBeGreaterThanOrEqual(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should fallback to Microlink API when HTML scraping has no image', async () => {
      // Arrange: Mock fetch for HTML without image, then Microlink API returning image
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('api.microlink.io')) {
          return {
            ok: true,
            json: async () => ({
              status: 'success',
              data: {
                title: 'Protected Article on Paywall',
                description: 'Insightful notes from the paid journal.',
                image: { url: 'https://cdn.microlink.io/covers/paywall.png' },
                publisher: 'Paywall News',
              },
            }),
          } as any;
        }
        // Return image-less HTML
        return {
          ok: true,
          url,
          text: async () => '<html><head><title>Paywall Article</title></head><body><p>Content only</p></body></html>',
          json: async () => ({}),
        } as any;
      });

      try {
        // Act
        const meta = await MetadataService.extractMetadata('https://paywall-news.com/exclusive/123');

        // Assert
        expect(meta.image).toBe('https://cdn.microlink.io/covers/paywall.png');
        expect(meta.title).toBe('Paywall Article');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should request Microlink screenshot when Microlink OpenGraph image is missing', async () => {
      // Arrange
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('screenshot=true')) {
          return {
            ok: true,
            json: async () => ({
              status: 'success',
              data: {
                screenshot: { url: 'https://iad.microlink.io/screenshot-2560x1600.png' },
              },
            }),
          } as any;
        }
        if (url.includes('api.microlink.io')) {
          return {
            ok: true,
            json: async () => ({
              status: 'success',
              data: {
                title: 'Text Only Forum',
                description: 'A plain text board without any og:image tags.',
                image: null,
                publisher: 'Forum Web',
              },
            }),
          } as any;
        }
        return {
          ok: false, // simulate 403 Forbidden on direct fetch
          status: 403,
          text: async () => '',
        } as any;
      });

      try {
        // Act
        const meta = await MetadataService.extractMetadata('https://text-only-forum.org/threads/1');

        // Assert
        expect(meta.image).toBe('https://iad.microlink.io/screenshot-2560x1600.png');
        expect(meta.title).toBe('Text Only Forum');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
