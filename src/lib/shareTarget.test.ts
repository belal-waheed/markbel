import { describe, it, expect } from 'vitest'
import { sanitizeSharedUrl, extractSharePayload } from './shareTarget'

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

    it('should generate fallback title for YouTube Shorts', () => {
      const payload = extractSharePayload({
        rawUrl: 'https://www.youtube.com/shorts/abcdef12345?si=trk',
        rawText: '',
        rawTitle: '',
      })

      expect(payload.targetUrl).toBe('https://www.youtube.com/shorts/abcdef12345')
      expect(payload.title).toBe('YouTube Short')
    })

    it('should generate fallback title for X Posts', () => {
      const payload = extractSharePayload({
        rawUrl: 'https://x.com/user/status/123456789',
        rawText: '',
        rawTitle: '',
      })

      expect(payload.targetUrl).toBe('https://x.com/user/status/123456789')
      expect(payload.title).toBe('X Post')
    })

    it('should prioritize explicit rawTitle when provided', () => {
      const payload = extractSharePayload({
        rawUrl: 'https://github.com/facebook/react',
        rawText: 'Some shared text',
        rawTitle: 'React - A JavaScript library for building user interfaces',
      })

      expect(payload.targetUrl).toBe('https://github.com/facebook/react')
      expect(payload.title).toBe('React - A JavaScript library for building user interfaces')
    })

    it('should return empty targetUrl when no URL is present in params', () => {
      const payload = extractSharePayload({
        rawUrl: '',
        rawText: 'Just random text without any link',
        rawTitle: 'Title only',
      })

      expect(payload.targetUrl).toBe('')
    })
  })
})
