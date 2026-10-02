import { describe, it, expect } from 'vitest';
import {
  resolveSmartGroup,
  extractHostname,
  evaluateConstraint,
  evaluateCompoundRule,
  calculateRuleSpecificity,
  sortRulesBySpecificity,
  normalizeRule,
  inspectSmartGroupMatch,
  PRESET_SMART_RULES,
  CompoundSmartGroupRule,
  CustomGroupRule,
  clearSmartGroupCache,
  getSmartGroupCacheSize,
} from './smartGroups';

describe('Smart Auto-Grouper Unit Tests (AAA Pattern)', () => {
  describe('Hostname Extraction', () => {
    it('should extract clean hostname without www and protocol', () => {
      // Arrange & Act & Assert
      expect(extractHostname('https://www.youtube.com/watch?v=123')).toBe('youtube.com');
      expect(extractHostname('http://m.youtube.com/shorts/abc')).toBe('m.youtube.com');
      expect(extractHostname('instagram.com/p/123')).toBe('instagram.com');
      expect(extractHostname('https://x.com/user/status/789')).toBe('x.com');
    });

    it('should handle invalid or empty inputs gracefully', () => {
      expect(extractHostname('')).toBe('');
      expect(extractHostname(null as any)).toBe('');
    });
  });

  describe('Constraint Evaluation Engine', () => {
    it('evaluates domain_equals constraint with exact domain and subdomains', () => {
      // Arrange
      const constraint = { id: 'c1', operator: 'domain_equals' as const, value: 'youtube.com' };

      // Act & Assert
      expect(evaluateConstraint('https://www.youtube.com/watch?v=1', constraint)).toBe(true);
      expect(evaluateConstraint('https://music.youtube.com/watch?v=2', constraint)).toBe(true);
      expect(evaluateConstraint('https://notyoutube.com/watch?v=3', constraint)).toBe(false);
    });

    it('evaluates domain_contains constraint', () => {
      // Arrange
      const constraint = { id: 'c2', operator: 'domain_contains' as const, value: 'substack' };

      // Act & Assert
      expect(evaluateConstraint('https://newsletter.substack.com/p/issue', constraint)).toBe(true);
      expect(evaluateConstraint('https://example.com/substack-article', constraint)).toBe(false);
    });

    it('evaluates url_contains constraint', () => {
      // Arrange
      const constraint = { id: 'c3', operator: 'url_contains' as const, value: 'list=' };

      // Act & Assert
      expect(evaluateConstraint('https://www.youtube.com/watch?v=123&list=PLabc', constraint)).toBe(true);
      expect(evaluateConstraint('https://www.youtube.com/watch?v=123', constraint)).toBe(false);
    });

    it('evaluates path_starts_with constraint', () => {
      // Arrange
      const constraint = { id: 'c4', operator: 'path_starts_with' as const, value: '/pull/' };

      // Act & Assert
      expect(evaluateConstraint('https://github.com/pull/123', constraint)).toBe(true);
      expect(evaluateConstraint('https://github.com/issues/123', constraint)).toBe(false);
    });

    it('evaluates query_param_exists constraint', () => {
      // Arrange
      const keyConstraint = { id: 'c5', operator: 'query_param_exists' as const, value: 'list' };
      const kvConstraint = { id: 'c6', operator: 'query_param_exists' as const, value: 'v=abc' };

      // Act & Assert
      expect(evaluateConstraint('https://www.youtube.com/watch?v=abc&list=PL1', keyConstraint)).toBe(true);
      expect(evaluateConstraint('https://www.youtube.com/watch?v=abc', keyConstraint)).toBe(false);
      expect(evaluateConstraint('https://www.youtube.com/watch?v=abc&list=PL1', kvConstraint)).toBe(true);
      expect(evaluateConstraint('https://www.youtube.com/watch?v=other', kvConstraint)).toBe(false);
    });
  });

  describe('Compound Rule Evaluation', () => {
    it('requires all constraints to match (logical AND)', () => {
      // Arrange
      const rule: CompoundSmartGroupRule = {
        id: 'r1',
        name: 'YT Playlist',
        group: 'YT Playlists',
        constraints: [
          { id: 'c1', operator: 'domain_equals', value: 'youtube.com' },
          { id: 'c2', operator: 'url_contains', value: 'list=' },
        ],
      };

      // Act & Assert
      // Both match -> true
      expect(evaluateCompoundRule('https://www.youtube.com/watch?v=123&list=PLabc', rule)).toBe(true);
      // Only domain matches -> false
      expect(evaluateCompoundRule('https://www.youtube.com/watch?v=123', rule)).toBe(false);
      // Neither matches -> false
      expect(evaluateCompoundRule('https://vimeo.com/123', rule)).toBe(false);
    });

    it('returns false for rules with no constraints', () => {
      const emptyRule: CompoundSmartGroupRule = {
        id: 'empty',
        name: 'Empty Rule',
        group: 'Test',
        constraints: [],
      };
      expect(evaluateCompoundRule('https://example.com', emptyRule)).toBe(false);
    });
  });

  describe('Specificity Scoring & Hierarchy', () => {
    it('scores compound rules higher than single domain rules', () => {
      // Arrange
      const singleDomainRule: CompoundSmartGroupRule = {
        id: 'r-single',
        name: 'Single Domain',
        group: 'General',
        constraints: [{ id: 'c1', operator: 'domain_equals', value: 'youtube.com' }],
      };
      const compoundRule: CompoundSmartGroupRule = {
        id: 'r-compound',
        name: 'Compound Rule',
        group: 'Specific',
        constraints: [
          { id: 'c1', operator: 'domain_equals', value: 'youtube.com' },
          { id: 'c2', operator: 'url_contains', value: 'list=' },
        ],
      };

      // Act
      const singleScore = calculateRuleSpecificity(singleDomainRule);
      const compoundScore = calculateRuleSpecificity(compoundRule);

      // Assert
      expect(compoundScore).toBeGreaterThan(singleScore);
    });

    it('sorts compound rules ahead of broad domain rules regardless of array input order', () => {
      // Arrange
      const broadRule: CompoundSmartGroupRule = {
        id: 'broad',
        name: 'Broad Rule',
        group: 'Broad',
        constraints: [{ id: 'c1', operator: 'domain_equals', value: 'youtube.com' }],
      };
      const specificRule: CompoundSmartGroupRule = {
        id: 'specific',
        name: 'Specific Rule',
        group: 'Specific',
        constraints: [
          { id: 'c1', operator: 'domain_equals', value: 'youtube.com' },
          { id: 'c2', operator: 'url_contains', value: 'list=' },
        ],
      };

      // Act
      const sorted = sortRulesBySpecificity([broadRule, specificRule]);

      // Assert
      expect(sorted[0].id).toBe('specific');
      expect(sorted[1].id).toBe('broad');
    });
  });

  describe('End-to-End Smart Group Resolution Scenarios', () => {
    it('matches YouTube playlist URL to YT Playlists over generic YT rule', () => {
      // Arrange
      const rules: CompoundSmartGroupRule[] = [
        {
          id: 'yt-broad',
          name: 'YouTube Videos',
          group: 'YT',
          constraints: [{ id: 'c1', operator: 'domain_equals', value: 'youtube.com' }],
        },
        {
          id: 'yt-playlist',
          name: 'YouTube Playlists',
          group: 'YT Playlists',
          constraints: [
            { id: 'c1', operator: 'domain_equals', value: 'youtube.com' },
            { id: 'c2', operator: 'url_contains', value: 'list=' },
          ],
        },
      ];

      // Act & Assert
      // Playlist URL matches YT Playlists
      expect(
        resolveSmartGroup('https://www.youtube.com/watch?v=123&list=PLabc', undefined, rules)
      ).toBe('YT Playlists');

      // Regular video URL falls back to generic YT rule
      expect(resolveSmartGroup('https://www.youtube.com/watch?v=123', undefined, rules)).toBe('YT');
    });

    it('matches multi-constraint GitHub PR rule', () => {
      // Arrange
      const rules: CompoundSmartGroupRule[] = [
        {
          id: 'gh-general',
          name: 'GitHub General',
          group: 'Code',
          constraints: [{ id: 'c1', operator: 'domain_equals', value: 'github.com' }],
        },
        {
          id: 'gh-prs',
          name: 'GitHub Pull Requests',
          group: 'PRs',
          constraints: [
            { id: 'c1', operator: 'domain_equals', value: 'github.com' },
            { id: 'c2', operator: 'path_starts_with', value: '/pull/' },
          ],
        },
      ];

      // Act & Assert
      expect(resolveSmartGroup('https://github.com/pull/42', undefined, rules)).toBe('PRs');
      expect(resolveSmartGroup('https://github.com/repo', undefined, rules)).toBe('Code');
    });

    it('maintains backwards compatibility with legacy CustomGroupRule objects', () => {
      // Arrange
      const legacyRules: CustomGroupRule[] = [
        { id: 'leg-1', domain: 'github.com', group: 'Code' },
        { id: 'leg-2', domain: 'reddit.com', group: 'Communities' },
      ];

      // Act
      const normalized = normalizeRule(legacyRules[0]);

      // Assert
      expect(normalized.group).toBe('Code');
      expect(normalized.constraints[0].operator).toBe('domain_equals');
      expect(normalized.constraints[0].value).toBe('github.com');
      expect(resolveSmartGroup('https://github.com/react/react', undefined, legacyRules)).toBe(
        'Code'
      );
      expect(resolveSmartGroup('https://reddit.com/r/webdev', undefined, legacyRules)).toBe(
        'Communities'
      );
    });

    it('inspectSmartGroupMatch provides matched rule metadata and defaults detection', () => {
      // Arrange
      const rules: CompoundSmartGroupRule[] = [
        {
          id: 'custom-gh',
          name: 'Dev Code',
          group: 'Dev',
          constraints: [{ id: 'c1', operator: 'domain_equals', value: 'github.com' }],
        },
      ];

      // Act
      const customMatch = inspectSmartGroupMatch('https://github.com/test', undefined, rules);
      const defaultMatch = inspectSmartGroupMatch('https://instagram.com/p/123');
      const unsortedMatch = inspectSmartGroupMatch('https://example.com/page');

      // Assert
      expect(customMatch.group).toBe('Dev');
      expect(customMatch.ruleName).toBe('Dev Code');
      expect(customMatch.isDefault).toBe(false);

      expect(defaultMatch.group).toBe('Insta');
      expect(defaultMatch.isDefault).toBe(true);

      expect(unsortedMatch.group).toBe('Unsorted');
      expect(unsortedMatch.isDefault).toBe(false);
    });
  });

  describe('Pre-configured Smart Rules Catalog', () => {
    it('contains all 8 curated presets with proper constraints', () => {
      // Assert
      expect(PRESET_SMART_RULES.length).toBe(8);

      const playlistPreset = PRESET_SMART_RULES.find((p) => p.id === 'preset-yt-playlists');
      expect(playlistPreset).toBeDefined();
      expect(playlistPreset?.group).toBe('YT Playlists');
      expect(playlistPreset?.constraints.length).toBe(2);

      const academicPreset = PRESET_SMART_RULES.find((p) => p.id === 'preset-academic-pdf');
      expect(academicPreset).toBeDefined();
      expect(academicPreset?.group).toBe('Research');
    });
  });

  describe('Default Smart Groups Fallback Heuristics', () => {
    it('maps standard YouTube watch URLs to YT', () => {
      const url = 'https://www.youtube.com/watch?v=jYFNtUYGxrY&t=414s';
      expect(resolveSmartGroup(url)).toBe('YT');
    });

    it('maps youtu.be short URLs to YT', () => {
      const url = 'https://youtu.be/jYFNtUYGxrY';
      expect(resolveSmartGroup(url)).toBe('YT');
    });

    it('maps YouTube Shorts to YT', () => {
      const url = 'https://www.youtube.com/shorts/3i_p5a_ZJ3Y';
      expect(resolveSmartGroup(url)).toBe('YT');
    });

    it('maps Instagram posts and reels to Insta', () => {
      expect(resolveSmartGroup('https://www.instagram.com/p/C-12345/')).toBe('Insta');
      expect(resolveSmartGroup('https://instagram.com/reel/C-67890/')).toBe('Insta');
      expect(resolveSmartGroup('https://ig.me/m/channel')).toBe('Insta');
    });

    it('maps X and Twitter URLs to X', () => {
      expect(resolveSmartGroup('https://x.com/levelsio/status/1890000000')).toBe('X');
      expect(resolveSmartGroup('https://twitter.com/shadcn/status/1890000001')).toBe('X');
    });

    it('returns Unsorted for general websites without matching rules', () => {
      expect(resolveSmartGroup('https://blog.cloudflare.com/workers')).toBe('Unsorted');
      expect(resolveSmartGroup('https://en.wikipedia.org/wiki/TypeScript')).toBe('Unsorted');
    });

    it('respects availableGroups scoping and case preservation', () => {
      const activeGroups = ['yt', 'Insta', 'x'];
      expect(resolveSmartGroup('https://youtube.com/watch?v=1', activeGroups)).toBe('yt');
      expect(resolveSmartGroup('https://instagram.com/p/1', activeGroups)).toBe('Insta');
    });

    it('falls back to Unsorted if target default smart group is deleted from availableGroups', () => {
      const activeGroups = ['Work', 'Unsorted'];
      expect(resolveSmartGroup('https://youtube.com/watch?v=1', activeGroups)).toBe('Unsorted');
    });
  });

  describe('LRU Cache for resolveSmartGroup', () => {
    it('returns cached results and increases cache size', () => {
      // Arrange
      clearSmartGroupCache();
      expect(getSmartGroupCacheSize()).toBe(0);

      // Act
      const first = resolveSmartGroup('https://youtube.com/watch?v=cache1');
      expect(first).toBe('YT');
      expect(getSmartGroupCacheSize()).toBe(1);

      // Act again with same URL
      const second = resolveSmartGroup('https://youtube.com/watch?v=cache1');

      // Assert
      expect(second).toBe('YT');
      expect(getSmartGroupCacheSize()).toBe(1);
    });

    it('differentiates cache entries by rules length', () => {
      // Arrange
      clearSmartGroupCache();
      const url = 'https://custom-site.com/item';
      const customRules: CompoundSmartGroupRule[] = [
        {
          id: 'rule-custom',
          name: 'Custom',
          group: 'CustomGroup',
          constraints: [{ id: 'c1', operator: 'domain_equals', value: 'custom-site.com' }],
        },
      ];

      // Act
      const defaultResult = resolveSmartGroup(url);
      const ruleResult = resolveSmartGroup(url, undefined, customRules);

      // Assert
      expect(defaultResult).toBe('Unsorted');
      expect(ruleResult).toBe('CustomGroup');
      expect(getSmartGroupCacheSize()).toBe(2);
    });

    it('evicts oldest entries when cache exceeds 1000 items', () => {
      // Arrange
      clearSmartGroupCache();

      // Populate 1000 entries
      for (let i = 0; i < 1000; i++) {
        resolveSmartGroup(`https://example${i}.com/page`);
      }
      expect(getSmartGroupCacheSize()).toBe(1000);

      // Add 1001st entry
      resolveSmartGroup('https://example1000.com/page');

      // Assert bounded max capacity
      expect(getSmartGroupCacheSize()).toBe(1000);
    });
  });
});
