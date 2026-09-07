import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Route Architecture & Native Boot Routing', () => {
  // Simulates the NativeBridge boot sequence
  function handleNativeBoot(params: {
    isNative: boolean
    hasBooted: boolean
    currentPath: string
  }): { redirectedTo: string | null; newBootState: boolean } {
    const { isNative, hasBooted, currentPath } = params

    if (!isNative) {
      return { redirectedTo: null, newBootState: hasBooted }
    }

    if (!hasBooted) {
      if (currentPath === '/' || currentPath === '') {
        return { redirectedTo: '/app', newBootState: true }
      }
      return { redirectedTo: null, newBootState: true }
    }

    // Subsequent navigations do not trigger auto-redirect (prevents loop)
    return { redirectedTo: null, newBootState: true }
  }

  it('redirects native Android client on cold boot at / directly to /app', () => {
    const result = handleNativeBoot({
      isNative: true,
      hasBooted: false,
      currentPath: '/',
    })
    expect(result.redirectedTo).toBe('/app')
    expect(result.newBootState).toBe(true)
  })

  it('preserves native deep links (e.g. /share) on cold boot', () => {
    const result = handleNativeBoot({
      isNative: true,
      hasBooted: false,
      currentPath: '/share?url=https://example.com',
    })
    expect(result.redirectedTo).toBeNull()
    expect(result.newBootState).toBe(true)
  })

  it('does NOT redirect native client when user explicitly navigates to / after boot (no loop trap)', () => {
    const result = handleNativeBoot({
      isNative: true,
      hasBooted: true,
      currentPath: '/',
    })
    expect(result.redirectedTo).toBeNull()
  })

  it('does not redirect web desktop or mobile browser visitors on /', () => {
    const result = handleNativeBoot({
      isNative: false,
      hasBooted: false,
      currentPath: '/',
    })
    expect(result.redirectedTo).toBeNull()
  })
})

describe('Native Hardware Back Button Engine', () => {
  function handleBackButton(currentPath: string): 'exit' | 'back' {
    if (currentPath === '/app' || currentPath === '/login') {
      return 'exit'
    }
    return 'back'
  }

  it('exits app when user presses back button at root vault (/app)', () => {
    expect(handleBackButton('/app')).toBe('exit')
  })

  it('exits app when user presses back button on login page (/login)', () => {
    expect(handleBackButton('/login')).toBe('exit')
  })

  it('navigates back to vault when user presses back from landing page (/)', () => {
    expect(handleBackButton('/')).toBe('back')
  })

  it('navigates back to vault when user presses back from archive (/archive)', () => {
    expect(handleBackButton('/archive')).toBe('back')
  })

  it('navigates back to vault when user presses back from settings (/settings)', () => {
    expect(handleBackButton('/settings')).toBe('back')
  })
})

describe('Route Navigation Contract', () => {
  function getPostAuthRedirect(searchParamsRedirect: string | null): string {
    return searchParamsRedirect || '/app'
  }

  function resolveAppSubRoute(path: string): string {
    if (path.startsWith('/app/')) {
      return '/app'
    }
    return path
  }

  it('defaults post-login redirect to /app when no parameter is present', () => {
    expect(getPostAuthRedirect(null)).toBe('/app')
  })

  it('respects explicit redirect parameter if provided', () => {
    expect(getPostAuthRedirect('/archive')).toBe('/archive')
  })

  it('silently resolves unknown sub-routes in /app/* back to /app', () => {
    expect(resolveAppSubRoute('/app/nonexistent-item')).toBe('/app')
    expect(resolveAppSubRoute('/app/tags/unknown')).toBe('/app')
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
