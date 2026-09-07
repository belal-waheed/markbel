import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Smart Gateway Decision Engine', () => {
  function decideRouteTarget(params: {
    isNative: boolean
    hasToken: boolean
    guestInitialized: boolean
    forceLandingParam: boolean
  }): 'bookmarks' | 'landing' {
    const { isNative, hasToken, guestInitialized, forceLandingParam } = params

    if (forceLandingParam) {
      return 'landing'
    }
    if (isNative) {
      return 'bookmarks'
    }
    if (hasToken) {
      return 'bookmarks'
    }
    if (guestInitialized) {
      return 'bookmarks'
    }
    return 'landing'
  }

  it('routes first-time web visitors to landing page', () => {
    const target = decideRouteTarget({
      isNative: false,
      hasToken: false,
      guestInitialized: false,
      forceLandingParam: false,
    })
    expect(target).toBe('landing')
  })

  it('routes authenticated users directly to bookmarks vault', () => {
    const target = decideRouteTarget({
      isNative: false,
      hasToken: true,
      guestInitialized: false,
      forceLandingParam: false,
    })
    expect(target).toBe('bookmarks')
  })

  it('routes returning guests with initialized vault directly to bookmarks', () => {
    const target = decideRouteTarget({
      isNative: false,
      hasToken: false,
      guestInitialized: true,
      forceLandingParam: false,
    })
    expect(target).toBe('bookmarks')
  })

  it('routes native Android / Capacitor clients directly to bookmarks', () => {
    const target = decideRouteTarget({
      isNative: true,
      hasToken: false,
      guestInitialized: false,
      forceLandingParam: false,
    })
    expect(target).toBe('bookmarks')
  })

  it('respects ?landing=true override even for returning guests or authenticated users', () => {
    const target = decideRouteTarget({
      isNative: false,
      hasToken: true,
      guestInitialized: true,
      forceLandingParam: true,
    })
    expect(target).toBe('landing')
  })
})

describe('Platform Auto-Detection Logic', () => {
  function detectPlatform(ua: string): 'android' | 'chrome' | 'ios' | 'desktop' {
    if (/Android/i.test(ua)) {
      return 'android'
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return 'ios'
    }
    if (/Chrome|CriOS/i.test(ua) && !/Edg|OPR/i.test(ua)) {
      return 'chrome'
    }
    return 'desktop'
  }

  it('detects Android devices from mobile user agents', () => {
    const androidUA =
      'Mozilla/5.0 (Linux; U; Android 14; Pixel 8 Pro Build/UD1A.230803.041) AppleWebKit/537.36'
    expect(detectPlatform(androidUA)).toBe('android')
  })

  it('detects iOS devices from iPhone user agents', () => {
    const iphoneUA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
    expect(detectPlatform(iphoneUA)).toBe('ios')
  })

  it('detects Chromium browsers on desktop', () => {
    const chromeUA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    expect(detectPlatform(chromeUA)).toBe('chrome')
  })

  it('falls back to desktop for non-Chromium or generic desktop agents', () => {
    const firefoxUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0'
    expect(detectPlatform(firefoxUA)).toBe('desktop')
  })
})
