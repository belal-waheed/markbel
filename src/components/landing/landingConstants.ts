export type PlatformType = 'android' | 'chrome' | 'firefox' | 'ios' | 'desktop'

export const CURRENT_RELEASE_VERSION = 'v2.5.17'

export interface PlatformInfo {
  type: PlatformType
  name: string
  label: string
}

export function detectPlatform(customUA?: string): PlatformInfo {
  const ua = customUA || (typeof window !== 'undefined' && navigator?.userAgent ? navigator.userAgent : '')
  if (!ua) {
    return { type: 'desktop', name: 'Web PWA', label: 'Web Platform' }
  }

  if (/Android/i.test(ua)) {
    return { type: 'android', name: 'Android APK', label: 'Android Device' }
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return { type: 'ios', name: 'Web PWA (iOS)', label: 'iOS Device' }
  }
  if (/Firefox|FxiOS/i.test(ua)) {
    return { type: 'firefox', name: 'Firefox Add-on', label: 'Mozilla Firefox' }
  }
  if (/Edg\//i.test(ua) || (/Chrome|CriOS/i.test(ua) && !/OPR/i.test(ua))) {
    return { type: 'chrome', name: 'Browser Extension', label: 'Chromium Browser' }
  }
  return { type: 'desktop', name: 'Web PWA', label: 'Desktop Browser' }
}

export interface DemoBookmark {
  id: string
  title: string
  url: string
  domain: string
  group: 'Dev' | 'Articles' | 'Video' | 'Design'
  groupColor: string
  tags: string[]
  description: string
  isPinned: boolean
  metric?: string
  metricIcon?: 'star' | 'clock' | 'play'
}

export const INITIAL_DEMO_BOOKMARKS: DemoBookmark[] = [
  {
    id: '1',
    title: 'React 19 & Next.js App Router Architecture Guide',
    url: 'https://github.com/facebook/react',
    domain: 'github.com',
    group: 'Dev',
    groupColor: 'blue',
    tags: ['react', 'nextjs', 'typescript'],
    description: 'Deep dive into React 19 Server Components, Actions, and async asset loading patterns.',
    isPinned: true,
    metric: '228k stars',
    metricIcon: 'star'
  },
  {
    id: '2',
    title: 'Building High-Throughput Edge APIs with Cloudflare D1',
    url: 'https://blog.cloudflare.com/d1-database',
    domain: 'blog.cloudflare.com',
    group: 'Articles',
    groupColor: 'amber',
    tags: ['edge', 'sqlite', 'serverless'],
    description: 'Architecting distributed SQLite databases at the edge with zero-latency read replication.',
    isPinned: false,
    metric: '6 min read',
    metricIcon: 'clock'
  },
  {
    id: '3',
    title: 'Framer Motion & GSAP 60fps Micro-Interactions Masterclass',
    url: 'https://youtube.com/watch?v=motion-mastery',
    domain: 'youtube.com',
    group: 'Video',
    groupColor: 'red',
    tags: ['animation', 'framer-motion', 'ui'],
    description: 'Production standards for building fluid, physics-driven web gestures and layout transitions.',
    isPinned: true,
    metric: '18:42 duration',
    metricIcon: 'play'
  },
  {
    id: '4',
    title: 'OKLCH Color Palettes & Tailwind CSS v4 Spatial Tokens',
    url: 'https://designsystems.io/oklch-tokens',
    domain: 'designsystems.io',
    group: 'Design',
    groupColor: 'purple',
    tags: ['design-system', 'tailwind', 'css'],
    description: 'Perceptually uniform color spaces and modern CSS custom property themes for web applications.',
    isPinned: false,
    metric: 'Reference',
    metricIcon: 'clock'
  }
]

export const FAQ_ITEMS = [
  {
    question: 'What is Markbel?',
    answer:
      'Markbel is an open-source, offline-first personal bookmark vault and rich media archiver. It combines the zero-latency speed of local IndexedDB storage with seamless Cloudflare D1 SQLite multi-device sync, allowing you to capture, organize, and search links anywhere with zero loading latency.'
  },
  {
    question: 'Is Markbel free and open-source?',
    answer:
      'Yes, 100% free and open source under the MIT License. The entire stack—including the React frontend, Cloudflare Workers edge API, D1 schema, and Android Capacitor wrapper—is publicly available on GitHub.'
  },
  {
    question: 'Do I need to create an account to use it?',
    answer:
      'No account is required. Markbel operates out of the box in Guest Mode using local IndexedDB in your browser. When you decide you want multi-device synchronization, you can create an account, and your local bookmarks automatically migrate to your cloud vault.'
  },
  {
    question: 'How does sync work across multiple devices?',
    answer:
      'Markbel utilizes an append-only delta change log stored in Cloudflare D1 SQLite. When a device mutates a bookmark or tag, the change is recorded locally and queued in an outbox. Once connected, mutations synchronize using deterministic Last-Write-Wins (LWW) conflict resolution.'
  },
  {
    question: 'Is my data private and tracked?',
    answer:
      'Markbel does not include third-party trackers, analytics pixels, or telemetry beacons. In Guest Mode, all data lives strictly on your local disk. In cloud sync mode, your links reside securely in your isolated database partition.'
  },
  {
    question: 'What platforms and clients are supported?',
    answer:
      'Markbel provides three primary clients: a standalone Android APK (with native Android SEND share sheet integration), a Chromium browser extension (Manifest V3), and an installable Progressive Web App (PWA) supporting desktop and mobile browsers.'
  }
]

export interface ComparisonDetail {
  value: string
  supported: boolean
  detail: string
}

export interface ComparisonFeature {
  feature: string
  category: string
  markbel: ComparisonDetail
  traditional: ComparisonDetail
}

export const ARCHITECTURE_COMPARISONS: ComparisonFeature[] = [
  {
    feature: 'Data Persistence',
    category: 'Architecture',
    markbel: {
      value: 'Offline-First Dexie (IndexedDB)',
      supported: true,
      detail: '0ms local disk reads/writes. Immediate boot and offline capability with zero network dependency.'
    },
    traditional: {
      value: 'Cloud-Only Remote Database',
      supported: false,
      detail: 'Network roundtrip required for search and queries. Blank screen when offline or in poor connectivity.'
    }
  },
  {
    feature: 'Synchronization Model',
    category: 'Sync Protocol',
    markbel: {
      value: 'Cloudflare D1 Append-Only Delta Sync',
      supported: true,
      detail: 'Deterministic Last-Write-Wins (LWW) conflict resolution with local outbox queue and instant replay.'
    },
    traditional: {
      value: 'Periodic Full Re-fetch / Opaque Merge',
      supported: false,
      detail: 'High bandwidth consumption, frequent lock conflicts, and proprietary merge engines.'
    }
  },
  {
    feature: 'Telemetry & Privacy',
    category: 'Privacy',
    markbel: {
      value: 'Zero Analytics, Tracking, or Pixels',
      supported: true,
      detail: 'Complete data sovereignty. Guest mode never sends links over the wire; cloud sync isolates tenant data.'
    },
    traditional: {
      value: 'Aggregated Ad & Analytics Trackers',
      supported: false,
      detail: 'Third-party tracking beacons, advertising scripts, and monetization of user browsing history.'
    }
  },
  {
    feature: 'AI Agent & Tool Integration',
    category: 'Intelligence',
    markbel: {
      value: 'Built-in Model Context Protocol (MCP)',
      supported: true,
      detail: 'Official @markbel/mcp server for Claude Desktop, Cursor, Zed, and Antigravity with scoped PAT tokens.'
    },
    traditional: {
      value: 'None / Closed Proprietary API',
      supported: false,
      detail: 'No standardized agent protocol support for automated bookmark indexing and context retrieval.'
    }
  },
  {
    feature: 'Spotlight Command Bar',
    category: 'Access',
    markbel: {
      value: 'In-Page Launcher (Alt+O) & HUD (Alt+B)',
      supported: true,
      detail: 'Summon searchable catalog from any active browser tab instantly with keyboard-first navigation.'
    },
    traditional: {
      value: 'Separate Browser Tab / Web App',
      supported: false,
      detail: 'Requires breaking flow to switch tabs or open separate heavy desktop windows.'
    }
  },
  {
    feature: 'Open Governance & Freedom',
    category: 'Licensing',
    markbel: {
      value: '100% MIT Open Source',
      supported: true,
      detail: 'Free forever. Zero vendor lock-in. Self-hostable on Cloudflare Workers free tier.'
    },
    traditional: {
      value: 'Proprietary SaaS Subscription',
      supported: false,
      detail: 'Recurring monthly subscriptions, rate limits, and risk of data loss on platform discontinuation.'
    }
  }
]

export function filterDemoBookmarks(
  bookmarks: DemoBookmark[],
  group: string,
  searchQuery: string
): DemoBookmark[] {
  const query = searchQuery.trim().toLowerCase()
  return bookmarks.filter((b) => {
    const matchesGroup = group === 'All' || b.group === group
    const matchesSearch =
      query === '' ||
      b.title.toLowerCase().includes(query) ||
      b.description.toLowerCase().includes(query) ||
      b.tags.some((t) => t.toLowerCase().includes(query))
    return matchesGroup && matchesSearch
  })
}

export function toggleBookmarkPin(bookmarks: DemoBookmark[], id: string): DemoBookmark[] {
  return bookmarks.map((b) => (b.id === id ? { ...b, isPinned: !b.isPinned } : b))
}
