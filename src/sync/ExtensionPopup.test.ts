/**
 * Extension Popup HUD Subsystem Unit Tests
 * Follows AAA (Arrange-Act-Assert) pattern.
 * Tests mode switching, restricted URL validation, search ranking,
 * keyboard navigation boundary checks, and bookmark payload generation.
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  isRestrictedBrowserUrl,
  resolveInitialMode,
} from '../../extension/src/popup/popupUtils';
import {
  validateLoginCredentials,
  formatAuthError,
} from '../../extension/src/popup/popupAuth';
import {
  resolveEffectiveGroup,
  buildBookmarkSavePayload,
  formatReminderDate,
  formatSuccessNotification,
} from '../../extension/src/popup/popupSaveView';
import {
  getNextSearchIndex,
  getPrevSearchIndex,
  formatDomain,
} from '../../extension/src/popup/popupSearchView';
import { filterAndRankBookmarks, SearchBookmarkItem } from '@/lib/searchCatalog';

describe('ExtensionPopup HUD Subsystem (Phase 11)', () => {
  describe('1. HTML Escaping & Security', () => {
    it('escapes dangerous HTML special characters to prevent XSS injection', () => {
      // Arrange
      const malicious = '<script>alert("xss")</script>&<>"\'';

      // Act
      const escaped = escapeHtml(malicious);

      // Assert
      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&lt;&gt;&quot;&#039;');
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
    });

    it('handles empty strings and clean strings gracefully', () => {
      // Arrange & Act & Assert
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml('Clean Title 123')).toBe('Clean Title 123');
    });
  });

  describe('2. Restricted Browser URL Detection', () => {
    it('flags Chrome internal URL schemes as restricted', () => {
      // Arrange & Act & Assert
      expect(isRestrictedBrowserUrl('chrome://settings')).toBe(true);
      expect(isRestrictedBrowserUrl('chrome://bookmarks/')).toBe(true);
      expect(isRestrictedBrowserUrl('chrome://history')).toBe(true);
      expect(isRestrictedBrowserUrl('chrome://extensions')).toBe(true);
      expect(isRestrictedBrowserUrl('chrome-extension://abcdef123456/popup.html')).toBe(true);
    });

    it('flags Edge internal URL schemes as restricted', () => {
      // Arrange & Act & Assert
      expect(isRestrictedBrowserUrl('edge://settings')).toBe(true);
      expect(isRestrictedBrowserUrl('edge://extensions')).toBe(true);
      expect(isRestrictedBrowserUrl('edge://flags')).toBe(true);
    });

    it('flags Firefox and WebExtension internal URL schemes as restricted', () => {
      // Arrange & Act & Assert
      expect(isRestrictedBrowserUrl('about:blank')).toBe(true);
      expect(isRestrictedBrowserUrl('about:config')).toBe(true);
      expect(isRestrictedBrowserUrl('about:addons')).toBe(true);
      expect(isRestrictedBrowserUrl('moz-extension://a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c/hud.html')).toBe(true);
    });

    it('flags developer tools and source view schemes as restricted', () => {
      // Arrange & Act & Assert
      expect(isRestrictedBrowserUrl('devtools://devtools/bundled/inspector.html')).toBe(true);
      expect(isRestrictedBrowserUrl('view-source:https://example.com')).toBe(true);
    });

    it('permits standard web and localhost URLs', () => {
      // Arrange & Act & Assert
      expect(isRestrictedBrowserUrl('https://markbel.dev')).toBe(false);
      expect(isRestrictedBrowserUrl('https://github.com/belal-waheed/markbel')).toBe(false);
      expect(isRestrictedBrowserUrl('http://localhost:5173/app')).toBe(false);
      expect(isRestrictedBrowserUrl('http://127.0.0.1:8787/api')).toBe(false);
      expect(isRestrictedBrowserUrl('https://sub.domain.co.uk/path/file.html?param=value#hash')).toBe(false);
    });

    it('safely handles null, undefined, empty, and whitespace strings without throwing', () => {
      // Arrange & Act & Assert
      expect(isRestrictedBrowserUrl(null)).toBe(false);
      expect(isRestrictedBrowserUrl(undefined)).toBe(false);
      expect(isRestrictedBrowserUrl('')).toBe(false);
      expect(isRestrictedBrowserUrl('   ')).toBe(false);
    });
  });

  describe('3. Mode Switching State Logic', () => {
    it('resolves to auth view when session is unauthenticated', () => {
      // Arrange & Act
      const result = resolveInitialMode({ isAuthenticated: false, isAlreadyInVault: false });

      // Assert
      expect(result.view).toBe('auth');
      expect(result.mode).toBe('save');
    });

    it('resolves to quick open search mode when active URL is already bookmarked in vault', () => {
      // Arrange & Act
      const result = resolveInitialMode({ isAuthenticated: true, isAlreadyInVault: true });

      // Assert
      expect(result.view).toBe('search');
      expect(result.mode).toBe('search');
    });

    it('resolves to save view when active URL is new and user is authenticated', () => {
      // Arrange & Act
      const result = resolveInitialMode({ isAuthenticated: true, isAlreadyInVault: false });

      // Assert
      expect(result.view).toBe('save');
      expect(result.mode).toBe('save');
    });
  });

  describe('4. Search Filtering and Ranking Subsystem', () => {
    const mockCatalog: SearchBookmarkItem[] = [
      {
        id: '1',
        title: 'Cloudflare Workers Documentation',
        url: 'https://developers.cloudflare.com/workers',
        description: 'Serverless execution at the edge',
        group: 'DevOps',
        favicon: '',
        image: '',
        isPinned: false,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        title: 'React 19 Server Components',
        url: 'https://react.dev/blog/2026/react-19',
        description: 'Deep dive into concurrent React rendering',
        group: 'Frontend',
        favicon: '',
        image: '',
        isPinned: true,
        createdAt: '2026-01-02T00:00:00Z',
      },
      {
        id: '3',
        title: 'YouTube - Antigravity Agentic Systems',
        url: 'https://youtube.com/watch?v=agent123',
        description: 'Autonomous software engineering workflows',
        group: 'YT',
        favicon: '',
        image: '',
        isPinned: false,
        createdAt: '2026-01-03T00:00:00Z',
      },
      {
        id: '4',
        title: 'Vitest Next-Gen Unit Testing',
        url: 'https://vitest.dev/guide',
        description: 'Blazing fast test runner',
        group: 'Frontend',
        favicon: '',
        image: '',
        isPinned: false,
        createdAt: '2026-01-04T00:00:00Z',
      },
    ];

    it('filters bookmarks by title keyword matching case-insensitively', () => {
      // Arrange & Act
      const results = filterAndRankBookmarks(mockCatalog, 'react', 'All');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
      expect(results[0].title).toContain('React 19');
    });

    it('filters bookmarks by URL and hostname', () => {
      // Arrange & Act
      const results = filterAndRankBookmarks(mockCatalog, 'cloudflare', 'All');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
      expect(results[0].url).toContain('cloudflare.com');
    });

    it('filters bookmarks by description text', () => {
      // Arrange & Act
      const results = filterAndRankBookmarks(mockCatalog, 'serverless', 'All');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('restricts search results to the selected group filter', () => {
      // Arrange & Act
      const resultsFrontend = filterAndRankBookmarks(mockCatalog, '', 'Frontend');
      const resultsDevOps = filterAndRankBookmarks(mockCatalog, '', 'DevOps');
      const resultsYT = filterAndRankBookmarks(mockCatalog, '', 'YT');

      // Assert
      expect(resultsFrontend).toHaveLength(2);
      expect(resultsDevOps).toHaveLength(1);
      expect(resultsYT).toHaveLength(1);
    });

    it('prioritizes pinned items ahead of unpinned items', () => {
      // Arrange & Act
      const results = filterAndRankBookmarks(mockCatalog, '', 'Frontend');

      // Assert
      expect(results[0].isPinned).toBe(true);
      expect(results[0].id).toBe('2');
      expect(results[1].isPinned).toBe(false);
      expect(results[1].id).toBe('4');
    });

    it('returns empty array when no bookmarks match query', () => {
      // Arrange & Act
      const results = filterAndRankBookmarks(mockCatalog, 'nonexistentquery999', 'All');

      // Assert
      expect(results).toHaveLength(0);
    });

    it('formats domain by removing www prefix', () => {
      // Arrange & Act & Assert
      expect(formatDomain('https://www.google.com/search?q=test')).toBe('google.com');
      expect(formatDomain('https://github.com/belal-waheed')).toBe('github.com');
      expect(formatDomain('invalid-url-string')).toBe('invalid-url-string');
    });
  });

  describe('5. Keyboard Navigation Index Wrapping and Boundary Checks', () => {
    describe('Clamped Boundary Navigation (wrap = false)', () => {
      it('increments index with down arrow without overflowing boundary', () => {
        // Arrange
        const total = 3;

        // Act & Assert
        expect(getNextSearchIndex(0, total, false)).toBe(1);
        expect(getNextSearchIndex(1, total, false)).toBe(2);
        expect(getNextSearchIndex(2, total, false)).toBe(2); // Clamped at total - 1
      });

      it('decrements index with up arrow without underflowing boundary', () => {
        // Arrange
        const total = 3;

        // Act & Assert
        expect(getPrevSearchIndex(2, total, false)).toBe(1);
        expect(getPrevSearchIndex(1, total, false)).toBe(0);
        expect(getPrevSearchIndex(0, total, false)).toBe(0); // Clamped at 0
      });

      it('handles empty results and single item boundary gracefully', () => {
        // Arrange & Act & Assert
        expect(getNextSearchIndex(0, 0, false)).toBe(0);
        expect(getPrevSearchIndex(0, 0, false)).toBe(0);
        expect(getNextSearchIndex(0, 1, false)).toBe(0);
        expect(getPrevSearchIndex(0, 1, false)).toBe(0);
      });
    });

    describe('Wrapping Navigation (wrap = true)', () => {
      it('wraps from last item to first item on down arrow', () => {
        // Arrange
        const total = 4;

        // Act & Assert
        expect(getNextSearchIndex(0, total, true)).toBe(1);
        expect(getNextSearchIndex(1, total, true)).toBe(2);
        expect(getNextSearchIndex(2, total, true)).toBe(3);
        expect(getNextSearchIndex(3, total, true)).toBe(0); // Wrapped to 0
      });

      it('wraps from first item to last item on up arrow', () => {
        // Arrange
        const total = 4;

        // Act & Assert
        expect(getPrevSearchIndex(0, total, true)).toBe(3); // Wrapped to total - 1
        expect(getPrevSearchIndex(3, total, true)).toBe(2);
        expect(getPrevSearchIndex(2, total, true)).toBe(1);
        expect(getPrevSearchIndex(1, total, true)).toBe(0);
      });

      it('handles single item and empty results with wrapping enabled', () => {
        // Arrange & Act & Assert
        expect(getNextSearchIndex(0, 0, true)).toBe(0);
        expect(getPrevSearchIndex(0, 0, true)).toBe(0);
        expect(getNextSearchIndex(0, 1, true)).toBe(0);
        expect(getPrevSearchIndex(0, 1, true)).toBe(0);
      });
    });
  });

  describe('6. Bookmark Payload Construction & Smart Grouping Fallback', () => {
    it('prioritizes user custom group input over chip selection and auto heuristics', () => {
      // Arrange & Act
      const group = resolveEffectiveGroup('CustomProject', 'YT', 'Videos');

      // Assert
      expect(group).toBe('CustomProject');
    });

    it('uses selected chip group when custom group input is empty', () => {
      // Arrange & Act
      const group = resolveEffectiveGroup('', 'DevOps', 'Cloud');

      // Assert
      expect(group).toBe('DevOps');
    });

    it('bypasses "All" chip and falls back to auto heuristic group', () => {
      // Arrange & Act
      const group = resolveEffectiveGroup('', 'All', 'YouTube');

      // Assert
      expect(group).toBe('YouTube');
    });

    it('defaults to Unsorted when neither custom, chip, nor auto heuristic exists', () => {
      // Arrange & Act
      const group = resolveEffectiveGroup('', '', '');

      // Assert
      expect(group).toBe('Unsorted');
    });

    it('builds complete bookmark save payload with sanitized fields', () => {
      // Arrange
      const params = {
        url: '  https://markbel.dev/docs  ',
        title: '  Markbel Architectural Guide  ',
        description: '  Comprehensive local-first specification  ',
        customGroup: 'Architecture',
        selectedGroup: 'Unsorted',
        autoGroup: 'Docs',
        isPinned: true,
        image: 'https://markbel.dev/og.png',
        favicon: 'https://markbel.dev/favicon.ico',
        siteName: 'Markbel Engineering',
        targetVaultOwnerId: 'vault-owner-uuid-42',
      };

      // Act
      const payload = buildBookmarkSavePayload(params);

      // Assert
      expect(payload.url).toBe('https://markbel.dev/docs');
      expect(payload.title).toBe('Markbel Architectural Guide');
      expect(payload.description).toBe('Comprehensive local-first specification');
      expect(payload.group).toBe('Architecture');
      expect(payload.isPinned).toBe(true);
      expect(payload.image).toBe('https://markbel.dev/og.png');
      expect(payload.favicon).toBe('https://markbel.dev/favicon.ico');
      expect(payload.siteName).toBe('Markbel Engineering');
      expect(payload.targetVaultOwnerId).toBe('vault-owner-uuid-42');
    });

    it('falls back title to url if title is omitted or whitespace', () => {
      // Arrange & Act
      const payload = buildBookmarkSavePayload({
        url: 'https://example.com/item',
        title: '   ',
      });

      // Assert
      expect(payload.title).toBe('https://example.com/item');
    });

    it('formats reminder date to ISO string from Date or valid string', () => {
      // Arrange
      const date = new Date('2026-12-31T12:00:00.000Z');

      // Act
      const formattedDate = formatReminderDate(date);
      const formattedString = formatReminderDate('2026-12-31T12:00:00.000Z');
      const formattedInvalid = formatReminderDate('invalid-date-string');
      const formattedNull = formatReminderDate(null);

      // Assert
      expect(formattedDate).toBe('2026-12-31T12:00:00.000Z');
      expect(formattedString).toBe('2026-12-31T12:00:00.000Z');
      expect(formattedInvalid).toBeUndefined();
      expect(formattedNull).toBeUndefined();
    });

    it('formats success HUD notifications for personal and shared vaults', () => {
      // Arrange & Act & Assert
      expect(formatSuccessNotification('Frontend')).toBe('Assigned to "Frontend"');
      expect(formatSuccessNotification('Design', 'Alice')).toBe('Assigned to "Design" in Alice\'s Vault');
      expect(formatSuccessNotification('Core', null)).toBe('Assigned to "Core"');
    });
  });

  describe('7. Auth Validation & Error Formatting', () => {
    it('validates required email and RFC format', () => {
      // Arrange & Act & Assert
      expect(validateLoginCredentials('', 'password123')).toEqual({
        valid: false,
        error: 'Email address is required.',
      });

      expect(validateLoginCredentials('not-an-email', 'password123')).toEqual({
        valid: false,
        error: 'Please enter a valid email address.',
      });

      expect(validateLoginCredentials('user@example.com', '')).toEqual({
        valid: false,
        error: 'Password is required.',
      });

      expect(validateLoginCredentials('user@example.com', 'valid-password-456')).toEqual({
        valid: true,
      });
    });

    it('formats authentication errors cleanly', () => {
      // Arrange & Act & Assert
      expect(formatAuthError(new Error('Invalid credentials provided'))).toBe('Invalid credentials provided');
      expect(formatAuthError('Network timeout')).toBe('Network timeout');
      expect(formatAuthError({ status: 500 })).toBe('Authentication failed. Please check your credentials.');
    });
  });
});
