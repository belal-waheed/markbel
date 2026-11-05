import { describe, it, expect } from 'vitest';
import {
  isSafePublicUrl,
  isSafeFaviconUrl,
  getPublicFaviconUrl,
  sanitizeAndCleanUrl,
  cleanText,
  SSRFValidationError,
} from './urlSafety';

describe('urlSafety Unit Tests (AAA Pattern)', () => {
  describe('SSRF Protection (isSafePublicUrl)', () => {
    it('should allow valid public HTTP/HTTPS URLs', () => {
      // Arrange & Act & Assert
      expect(isSafePublicUrl('https://example.com/article')).toBe(true);
      expect(isSafePublicUrl('https://github.com/facebook/react')).toBe(true);
      expect(isSafePublicUrl('http://subdomain.news.site.org/post/123')).toBe(true);
      expect(isSafePublicUrl('https://markbel.app')).toBe(true);
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

    it('should block IPv6 private and link-local ranges', () => {
      // Arrange & Act & Assert
      expect(isSafePublicUrl('http://[fc00::1]/admin')).toBe(false);
      expect(isSafePublicUrl('http://[fd12:3456:789a::1]/')).toBe(false);
      expect(isSafePublicUrl('http://[fe80::1ff:fe23:4567:890a]/')).toBe(false);
      expect(isSafePublicUrl('http://[::ffff:127.0.0.1]/')).toBe(false);
      expect(isSafePublicUrl('http://[::ffff:192.168.1.1]/')).toBe(false);
    });

    it('should reject non-HTTP protocols', () => {
      // Arrange & Act & Assert
      expect(isSafePublicUrl('file:///etc/passwd')).toBe(false);
      expect(isSafePublicUrl('ftp://ftp.example.com')).toBe(false);
      expect(isSafePublicUrl('javascript:alert(1)')).toBe(false);
      expect(isSafePublicUrl('data:text/plain;base64,SGVsbG8=')).toBe(false);
    });

    it('should return false for malformed URLs', () => {
      // Arrange & Act & Assert
      expect(isSafePublicUrl('')).toBe(false);
      expect(isSafePublicUrl('not-a-valid-url')).toBe(false);
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

    it('should clean YouTube tracking parameters while preserving video parameters', () => {
      // Arrange
      const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=tracking123&feature=share&pp=ygUI';

      // Act
      const { targetUrl, cleanUrlStr } = sanitizeAndCleanUrl(ytUrl);

      // Assert
      expect(targetUrl.searchParams.get('v')).toBe('dQw4w9WgXcQ');
      expect(targetUrl.searchParams.has('si')).toBe(false);
      expect(targetUrl.searchParams.has('feature')).toBe(false);
      expect(targetUrl.searchParams.has('pp')).toBe(false);
      expect(cleanUrlStr).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should strip modern tracking parameters (si, igsh, fbclid, gbraid, wbraid, utm_*) while retaining content params', () => {
      // Arrange
      const dirtyUrl =
        'https://example.com/item?article_id=123&si=share999&igsh=insta123&fbclid=fb_click_id&gbraid=google_app_1&wbraid=google_web_2&utm_source=custom&utm_campaign=winter_sale&utm_custom_tracker=active';

      // Act
      const { targetUrl, cleanUrlStr } = sanitizeAndCleanUrl(dirtyUrl);

      // Assert
      expect(targetUrl.searchParams.get('article_id')).toBe('123');
      expect(targetUrl.searchParams.has('si')).toBe(false);
      expect(targetUrl.searchParams.has('igsh')).toBe(false);
      expect(targetUrl.searchParams.has('fbclid')).toBe(false);
      expect(targetUrl.searchParams.has('gbraid')).toBe(false);
      expect(targetUrl.searchParams.has('wbraid')).toBe(false);
      expect(targetUrl.searchParams.has('utm_source')).toBe(false);
      expect(targetUrl.searchParams.has('utm_campaign')).toBe(false);
      expect(targetUrl.searchParams.has('utm_custom_tracker')).toBe(false);
      expect(cleanUrlStr).toBe('https://example.com/item?article_id=123');
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

    it('should handle empty or non-string input safely', () => {
      // Arrange & Act & Assert
      expect(cleanText('')).toBe('');
      expect(cleanText(null as any)).toBe('');
      expect(cleanText(undefined as any)).toBe('');
    });
  });

  describe('SSRFValidationError', () => {
    it('should be an instance of Error with correct name and message', () => {
      // Arrange & Act
      const error = new SSRFValidationError('Forbidden private IP address');

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('SSRFValidationError');
      expect(error.message).toBe('Forbidden private IP address');
    });
  });

  describe('getPublicFaviconUrl (Safe Favicon Fallback Resolution)', () => {
    it('returns /favicon.ico directly for mark.obel.workers.dev and localhost to avoid Google S2 404s', () => {
      expect(getPublicFaviconUrl('https://mark.obel.workers.dev')).toBe('/favicon.ico');
      expect(getPublicFaviconUrl('https://mark.obel.workers.dev/app')).toBe('/favicon.ico');
      expect(getPublicFaviconUrl('http://localhost:3000')).toBe('/favicon.ico');
      expect(getPublicFaviconUrl('http://localhost:5173')).toBe('/favicon.ico');
    });

    it('returns undefined for private IPs, loopbacks, and invalid URLs', () => {
      // Arrange & Act & Assert
      expect(getPublicFaviconUrl('http://192.168.1.1')).toBeUndefined();
      expect(getPublicFaviconUrl('http://10.0.0.1')).toBeUndefined();
      expect(getPublicFaviconUrl('10.0.0.1')).toBeUndefined();
      expect(getPublicFaviconUrl('http://127.0.0.1:8080/dashboard')).toBeUndefined();
      expect(getPublicFaviconUrl(null)).toBeUndefined();
      expect(getPublicFaviconUrl(undefined)).toBeUndefined();
      expect(getPublicFaviconUrl('')).toBeUndefined();
      expect(getPublicFaviconUrl('not-a-valid-url')).toBeUndefined();
    });

    it('returns Google S2 favicon URL for public domains', () => {
      // Arrange & Act & Assert
      expect(getPublicFaviconUrl('https://github.com')).toBe(
        'https://www.google.com/s2/favicons?domain=github.com&sz=128'
      );
      expect(getPublicFaviconUrl('https://example.com/some/deep/page')).toBe(
        'https://www.google.com/s2/favicons?domain=example.com&sz=128'
      );
    });
  });

  describe('isSafeFaviconUrl (Favicon Sanitizer)', () => {
    it('returns false for falsy or empty inputs', () => {
      expect(isSafeFaviconUrl(null)).toBe(false);
      expect(isSafeFaviconUrl(undefined)).toBe(false);
      expect(isSafeFaviconUrl('')).toBe(false);
      expect(isSafeFaviconUrl('   ')).toBe(false);
    });

    it('returns false for direct private IPs or localhost favicon URLs', () => {
      expect(isSafeFaviconUrl('http://192.168.1.1/favicon.ico')).toBe(false);
      expect(isSafeFaviconUrl('http://10.0.0.1/favicon.png')).toBe(false);
      expect(isSafeFaviconUrl('http://localhost:3000/favicon.ico')).toBe(false);
      expect(isSafeFaviconUrl('http://127.0.0.1/icon.png')).toBe(false);
    });

    it('returns false for Google S2 URLs targeting private IPs or loopbacks', () => {
      expect(isSafeFaviconUrl('https://www.google.com/s2/favicons?domain=192.168.1.1&sz=128')).toBe(false);
      expect(isSafeFaviconUrl('https://www.google.com/s2/favicons?domain=localhost&sz=128')).toBe(false);
      expect(isSafeFaviconUrl('https://www.google.com/s2/favicons?domain=10.0.0.5')).toBe(false);
    });

    it('returns true for legitimate public favicon URLs', () => {
      expect(isSafeFaviconUrl('https://github.com/favicon.ico')).toBe(true);
      expect(isSafeFaviconUrl('https://www.google.com/s2/favicons?domain=github.com&sz=128')).toBe(true);
      expect(isSafeFaviconUrl('https://cdn.example.com/icons/favicon.png')).toBe(true);
    });
  });
});
