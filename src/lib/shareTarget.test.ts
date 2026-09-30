import { describe, it, expect } from 'vitest'
import { sanitizeSharedUrl, extractSharePayload, reconstructUnencodedShareParams } from './shareTarget'

describe('PWA Share Target Processing & Sanitization Unit Tests', () => {
  describe('sanitizeSharedUrl', () => {
    it('should strip Instagram tracking query parameters (?igsh=...)', () => {
      const raw = 'https://www.instagram.com/reel/DFghjkL123/?igsh=MWx5aW56dTNwbDFidw==&utm_source=ig_web_copy_link'
      const clean = sanitizeSharedUrl(raw)
      expect(clean).toBe('https://www.instagram.com/reel/DFghjkL123/')
    })

    it('should strip YouTube tracking (?si=...) while preserving video id and time (?t=...)', () => {
      const raw = 'https://youtu.be/dQw4w9WgXcQ?si=abcdef123456'
      const clean = sanitizeSharedUrl(raw)
      expect(clean).toBe('https://youtu.be/dQw4w9WgXcQ')
    })

    it('should strip Twitter / X referral parameters (?ref_src=..., ?s=...)', () => {
      const raw = 'https://x.com/levelsio/status/1890000000000000000?ref_src=twsrc%5Etfw'
      const clean = sanitizeSharedUrl(raw)
      expect(clean).toBe('https://x.com/levelsio/status/1890000000000000000')
    })

    it('should remove trailing punctuation attached to shared URLs', () => {
      expect(sanitizeSharedUrl('https://example.com/page.')).toBe('https://example.com/page')
      expect(sanitizeSharedUrl('https://example.com/page,')).toBe('https://example.com/page')
      expect(sanitizeSharedUrl('https://example.com/page;')).toBe('https://example.com/page')
      expect(sanitizeSharedUrl('https://example.com/page)')).toBe('https://example.com/page')
    })

    it('should handle empty or invalid inputs gracefully', () => {
      expect(sanitizeSharedUrl('')).toBe('')
      expect(sanitizeSharedUrl(null as any)).toBe('')
      expect(sanitizeSharedUrl(undefined as any)).toBe('')
    })
  })

  describe('extractSharePayload', () => {
    it('should extract embedded URL and text from an Instagram Reel share intent', () => {
      const payload = extractSharePayload({
        rawUrl: '',
        rawText: 'Check out this Reel by @chef https://www.instagram.com/reel/C-12345/?igsh=xyz987',
        rawTitle: '',
      })

      expect(payload.targetUrl).toBe('https://www.instagram.com/reel/C-12345/')
      expect(payload.title).toBe('Check out this Reel by @chef')
    })

    it('should generate fallback title for Instagram Reel when text is only the URL', () => {
      const payload = extractSharePayload({
        rawUrl: 'https://www.instagram.com/reel/C-99999/?igsh=test1234',
        rawText: '',
        rawTitle: '',
      })

      expect(payload.targetUrl).toBe('https://www.instagram.com/reel/C-99999/')
      expect(payload.title).toBe('Instagram Reel')
    })

    it('should generate fallback title for YouTube Shorts and populate instant thumbnail and siteName', () => {
      const payload = extractSharePayload({
        rawUrl: 'https://www.youtube.com/shorts/abcdef12345?si=trk',
        rawText: '',
        rawTitle: '',
      })

      expect(payload.targetUrl).toBe('https://www.youtube.com/shorts/abcdef12345')
      expect(payload.title).toBe('YouTube Short')
      expect(payload.image).toBe('https://img.youtube.com/vi/abcdef12345/hqdefault.jpg')
      expect(payload.siteName).toBe('YouTube')
    })

    it('should extract instant thumbnail and siteName for YouTube watch URLs', () => {
      const payload = extractSharePayload({
        rawUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        rawText: '',
        rawTitle: '',
      })

      expect(payload.targetUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(payload.title).toBe('YouTube Video')
      expect(payload.image).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
      expect(payload.siteName).toBe('YouTube')
    })

    it('should generate fallback title for X Posts', () => {
      const payload = extractSharePayload({
        rawUrl: 'https://x.com/user/status/123456789',
        rawText: '',
        rawTitle: '',
      })

      expect(payload.targetUrl).toBe('https://x.com/user/status/123456789')
      expect(payload.title).toBe('X Post')
      expect(payload.siteName).toBe('X')
    })

    it('should prioritize explicit rawTitle when provided while populating instant image for GitHub', () => {
      const payload = extractSharePayload({
        rawUrl: 'https://github.com/facebook/react',
        rawText: 'Some shared text',
        rawTitle: 'React - A JavaScript library for building user interfaces',
      })

      expect(payload.targetUrl).toBe('https://github.com/facebook/react')
      expect(payload.title).toBe('React - A JavaScript library for building user interfaces')
      expect(payload.image).toBe('https://opengraph.githubassets.com/1/facebook/react')
      expect(payload.siteName).toBe('GitHub')
    })

    it('should preserve list and index parameters for YouTube playlist videos while stripping tracking', () => {
      const payload = extractSharePayload({
        rawUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOdP_8GztsuKi9nrraNbKKp4&index=3&si=tracking123&feature=share',
        rawText: '',
        rawTitle: '',
      })

      expect(payload.targetUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOdP_8GztsuKi9nrraNbKKp4&index=3')
      expect(payload.image).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
      expect(payload.siteName).toBe('YouTube')
    })

    it('should preserve playlist parameter from youtu.be shortlinks', () => {
      const payload = extractSharePayload({
        rawUrl: 'https://youtu.be/dQw4w9WgXcQ?list=PLrAXtmErZgOdP_8GztsuKi9nrraNbKKp4&si=tracking123',
        rawText: '',
        rawTitle: '',
      })

      expect(payload.targetUrl).toBe('https://youtu.be/dQw4w9WgXcQ?list=PLrAXtmErZgOdP_8GztsuKi9nrraNbKKp4')
      expect(payload.image).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    })

    it('should preserve pure playlist URLs (youtube.com/playlist?list=...)', () => {
      const payload = extractSharePayload({
        rawUrl: 'https://www.youtube.com/playlist?list=PLrAXtmErZgOdP_8GztsuKi9nrraNbKKp4&si=tracking123',
        rawText: '',
        rawTitle: '',
      })

      expect(payload.targetUrl).toBe('https://www.youtube.com/playlist?list=PLrAXtmErZgOdP_8GztsuKi9nrraNbKKp4')
      expect(payload.title).toBe('YouTube Playlist')
      expect(payload.contentType).toBe('playlist')
    })
  })

  describe('reconstructUnencodedShareParams', () => {
    it('should reconstruct YouTube playlist parameters (&list=...&index=...) when unencoded in Android WebAPK GET intent', () => {
      // Android WebAPK GET creates: /share?share=true&url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2
      // The browser URLSearchParams sees:
      // share -> "true"
      // url -> "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      // list -> "PL123"
      // index -> "2"
      const searchParams = new URLSearchParams('share=true&url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2')
      const { rawUrl, rawTitle, rawText } = reconstructUnencodedShareParams(searchParams)

      expect(rawUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2')
      expect(rawTitle).toBe('')
      expect(rawText).toBe('')
    })

    it('should reconstruct parameters when rawUrl does not contain an existing question mark', () => {
      // E.g. /share?url=https://youtu.be/dQw4w9WgXcQ&list=PL123
      const searchParams = new URLSearchParams('url=https://youtu.be/dQw4w9WgXcQ&list=PL123')
      const { rawUrl } = reconstructUnencodedShareParams(searchParams)

      expect(rawUrl).toBe('https://youtu.be/dQw4w9WgXcQ?list=PL123')
    })

    it('should reconstruct parameters when URL is passed inside rawText', () => {
      // E.g. YouTube app sharing text: /share?text=https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123
      const searchParams = new URLSearchParams('text=https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123')
      const { rawText } = reconstructUnencodedShareParams(searchParams)

      expect(rawText).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123')
    })

    it('should preserve standard parameters without alterations when properly encoded', () => {
      const searchParams = new URLSearchParams({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123',
        title: 'Rick Astley - Never Gonna Give You Up',
        text: 'Shared from browser'
      })
      const { rawUrl, rawTitle, rawText } = reconstructUnencodedShareParams(searchParams)

      expect(rawUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123')
      expect(rawTitle).toBe('Rick Astley - Never Gonna Give You Up')
      expect(rawText).toBe('Shared from browser')
    })
  })
})


