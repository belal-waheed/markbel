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

  it('navigates back to vault when user presses back from nested subroute /app/archive', () => {
    expect(handleBackButton('/app/archive')).toBe('back')
  })

  it('navigates back to vault when user presses back from nested subroute /app/settings', () => {
    expect(handleBackButton('/app/settings')).toBe('back')
  })
})

describe('Route Navigation & Nested Subroute Resolution Contract', () => {
  function getPostAuthRedirect(searchParamsRedirect: string | null): string {
    return searchParamsRedirect || '/app'
  }

  function resolveAppSubRoute(path: string): string {
    // Nested known subroutes under /app
    if (path === '/app/archive' || path === '/app/settings' || path === '/app/sync-debug') {
      return path
    }
    // Graceful catch-all for unknown /app/* sub-routes
    if (path.startsWith('/app/')) {
      return '/app'
    }
    return path
  }

  function resolveLegacyAlias(path: string): string | null {
    if (path === '/archive') return '/app/archive'
    if (path === '/settings') return '/app/settings'
    if (path === '/sync-debug') return '/app/sync-debug'
    if (path === '/landing') return '/'
    return null
  }

  it('defaults post-login redirect to /app when no parameter is present', () => {
    expect(getPostAuthRedirect(null)).toBe('/app')
  })

  it('respects explicit redirect parameter if provided', () => {
    expect(getPostAuthRedirect('/archive')).toBe('/archive')
    expect(getPostAuthRedirect('/app/settings')).toBe('/app/settings')
  })

  it('resolves valid nested /app subroutes directly', () => {
    expect(resolveAppSubRoute('/app/archive')).toBe('/app/archive')
    expect(resolveAppSubRoute('/app/settings')).toBe('/app/settings')
    expect(resolveAppSubRoute('/app/sync-debug')).toBe('/app/sync-debug')
  })

  it('silently resolves unknown sub-routes in /app/* back to /app', () => {
    expect(resolveAppSubRoute('/app/nonexistent-item')).toBe('/app')
    expect(resolveAppSubRoute('/app/tags/unknown')).toBe('/app')
    expect(resolveAppSubRoute('/app/nested/deep/route')).toBe('/app')
  })

  it('redirects backwards-compatible legacy aliases to nested /app equivalents', () => {
    expect(resolveLegacyAlias('/archive')).toBe('/app/archive')
    expect(resolveLegacyAlias('/settings')).toBe('/app/settings')
    expect(resolveLegacyAlias('/sync-debug')).toBe('/app/sync-debug')
    expect(resolveLegacyAlias('/landing')).toBe('/')
    expect(resolveLegacyAlias('/unknown')).toBeNull()
  })
})

describe('Platform Auto-Detection Logic', () => {
  function detectPlatform(ua: string): 'android' | 'chrome' | 'firefox' | 'ios' | 'desktop' {
    if (/Android/i.test(ua)) {
      return 'android'
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return 'ios'
    }
    if (/Firefox|FxiOS/i.test(ua)) {
      return 'firefox'
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

  it('detects Firefox browsers on desktop', () => {
    const firefoxUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0'
    expect(detectPlatform(firefoxUA)).toBe('firefox')
  })

  it('detects Chromium browsers on desktop', () => {
    const chromeUA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    expect(detectPlatform(chromeUA)).toBe('chrome')
  })

  it('falls back to desktop for non-Chromium or generic desktop agents', () => {
    const safariUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    expect(detectPlatform(safariUA)).toBe('desktop')
  })
})

describe('Public vs Protected Route Access Contract', () => {
  const publicRoutes = [
    '/',
    '/landing',
    '/app',
    '/app/archive',
    '/app/settings',
    '/login',
    '/share',
    '/archive',
    '/settings',
  ]
  const protectedRoutes = ['/sync-debug', '/app/sync-debug']

  function isRouteProtected(path: string): boolean {
    return protectedRoutes.includes(path)
  }

  it('allows unauthenticated / guest access to /settings and /app/settings without redirection', () => {
    expect(isRouteProtected('/settings')).toBe(false)
    expect(isRouteProtected('/app/settings')).toBe(false)
  })

  it('allows unauthenticated / guest access to core vault routes and nested subroutes', () => {
    publicRoutes.forEach((route) => {
      expect(isRouteProtected(route)).toBe(false)
    })
  })

  it('protects internal debug routes like /sync-debug and /app/sync-debug', () => {
    expect(isRouteProtected('/sync-debug')).toBe(true)
    expect(isRouteProtected('/app/sync-debug')).toBe(true)
  })
})

describe('URL Query State Reflection & Serialization Contract', () => {
  type FilterTab = 'all' | 'unread' | 'pinned' | 'due'
  const VALID_TABS: FilterTab[] = ['all', 'unread', 'pinned', 'due']

  function parseQueryParams(search: string, defaultView = 'all'): {
    activeGroup: string | null
    currentTab: FilterTab
    searchQuery: string
  } {
    const params = new URLSearchParams(search)

    // Group
    const groupParam = params.get('group')
    let activeGroup: string | null = null
    if (groupParam !== null) {
      activeGroup = groupParam || null
    } else if (defaultView.startsWith('group:')) {
      activeGroup = defaultView.slice(6)
    }

    // Tab
    const tabParam = params.get('tab')
    let currentTab: FilterTab = 'all'
    if (tabParam && (VALID_TABS as readonly string[]).includes(tabParam)) {
      currentTab = tabParam as FilterTab
    } else if (['unread', 'pinned', 'due'].includes(defaultView)) {
      currentTab = defaultView as FilterTab
    }

    // Query
    const searchQuery = params.get('q') || ''

    return { activeGroup, currentTab, searchQuery }
  }

  function serializeQueryParams(
    state: {
      activeGroup: string | null
      currentTab: FilterTab
      searchQuery: string
    },
    defaultView = 'all'
  ): string {
    const params = new URLSearchParams()
    if (state.activeGroup) {
      params.set('group', state.activeGroup)
    }
    if (state.currentTab !== 'all') {
      params.set('tab', state.currentTab)
    } else if (['unread', 'pinned', 'due'].includes(defaultView)) {
      params.set('tab', 'all')
    }
    if (state.searchQuery.trim()) {
      params.set('q', state.searchQuery.trim())
    }
    const res = params.toString()
    return res ? `?${res}` : ''
  }

  it('deserializes group, tab, and search query parameters from URL', () => {
    const parsed = parseQueryParams('?group=Articles&tab=unread&q=react+patterns')
    expect(parsed.activeGroup).toBe('Articles')
    expect(parsed.currentTab).toBe('unread')
    expect(parsed.searchQuery).toBe('react patterns')
  })

  it('falls back to navigation preferences when parameters are absent', () => {
    const parsedWithGroupPref = parseQueryParams('', 'group:Research')
    expect(parsedWithGroupPref.activeGroup).toBe('Research')
    expect(parsedWithGroupPref.currentTab).toBe('all')
    expect(parsedWithGroupPref.searchQuery).toBe('')

    const parsedWithTabPref = parseQueryParams('', 'pinned')
    expect(parsedWithTabPref.activeGroup).toBeNull()
    expect(parsedWithTabPref.currentTab).toBe('pinned')
    expect(parsedWithTabPref.searchQuery).toBe('')
  })

  it('validates tab parameter and rejects invalid or unknown tabs', () => {
    const parsed = parseQueryParams('?tab=invalid_tab', 'all')
    expect(parsed.currentTab).toBe('all')

    const parsedValid = parseQueryParams('?tab=due', 'all')
    expect(parsedValid.currentTab).toBe('due')
  })

  it('serializes state to clean URL query string without polluting history', () => {
    const qs = serializeQueryParams({
      activeGroup: 'Work',
      currentTab: 'pinned',
      searchQuery: 'architecture',
    })
    expect(qs).toBe('?group=Work&tab=pinned&q=architecture')
  })

  it('omits defaults for clean URLs when state is at initial baseline', () => {
    const qs = serializeQueryParams({
      activeGroup: null,
      currentTab: 'all',
      searchQuery: '',
    })
    expect(qs).toBe('')
  })

  it('explicitly writes tab=all when user preference defaults to unread', () => {
    const qs = serializeQueryParams(
      {
        activeGroup: null,
        currentTab: 'all',
        searchQuery: '',
      },
      'unread'
    )
    expect(qs).toBe('?tab=all')
  })
})

describe('Returning User Contextual Awareness Contract', () => {
  function detectReturningUser(
    token: string | null | undefined,
    guestInit: string | null | undefined
  ): boolean {
    return Boolean(token || guestInit === 'true')
  }

  function resolveHeroCta(isReturningUser: boolean): { title: string; text: string } {
    return {
      title: isReturningUser ? 'Resume Vault' : 'Launch Vault',
      text: isReturningUser ? 'Open Your Vault' : 'Launch Vault (No Account Needed)',
    }
  }

  function resolveNavbarCta(
    token: string | null | undefined,
    isReturningUser: boolean
  ): string {
    if (token) return 'Enter Vault'
    if (isReturningUser) return 'Resume Vault'
    return 'Launch Vault'
  }

  it('identifies new first-time visitors accurately', () => {
    expect(detectReturningUser(null, null)).toBe(false)
    expect(detectReturningUser(undefined, undefined)).toBe(false)
    expect(detectReturningUser('', 'false')).toBe(false)
  })

  it('identifies returning guest users from localStorage guest initialization flag', () => {
    expect(detectReturningUser(null, 'true')).toBe(true)
    expect(detectReturningUser(undefined, 'true')).toBe(true)
  })

  it('identifies returning authenticated users from auth token', () => {
    expect(detectReturningUser('jwt_mock_token_123', null)).toBe(true)
    expect(detectReturningUser('jwt_mock_token_123', 'true')).toBe(true)
  })

  it('provides contextual Hero CTA labels based on returning user status', () => {
    const newVisitorHero = resolveHeroCta(false)
    expect(newVisitorHero.title).toBe('Launch Vault')
    expect(newVisitorHero.text).toBe('Launch Vault (No Account Needed)')

    const returningHero = resolveHeroCta(true)
    expect(returningHero.title).toBe('Resume Vault')
    expect(returningHero.text).toBe('Open Your Vault')
  })

  it('provides contextual Navbar CTA labels based on auth and guest status', () => {
    expect(resolveNavbarCta(null, false)).toBe('Launch Vault')
    expect(resolveNavbarCta(null, true)).toBe('Resume Vault')
    expect(resolveNavbarCta('jwt_token', true)).toBe('Enter Vault')
  })
})

