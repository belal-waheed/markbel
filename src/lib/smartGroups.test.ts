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

    it('evaluates title_contains constraint case-insensitively', () => {
      // Arrange
      const titleConstraint = { id: 'c7', operator: 'title_contains' as const, value: 'system design' };
      const arabicConstraint = { id: 'c8', operator: 'title_contains' as const, value: 'رحلة اليقين' };

      // Act & Assert
      expect(
        evaluateConstraint('https://youtube.com/watch?v=1', titleConstraint, 'Complete System Design Course (APIs, DBs)')
      ).toBe(true);
      expect(
        evaluateConstraint('https://youtube.com/watch?v=2', titleConstraint, 'Docker and Kubernetes Tutorial')
      ).toBe(false);
      expect(
        evaluateConstraint('https://youtube.com/watch?v=3', titleConstraint, undefined)
      ).toBe(false);
      expect(
        evaluateConstraint('https://youtube.com/watch?v=4', arabicConstraint, 'رحلة اليقين ١: بناء الدعائم')
      ).toBe(true);
    });

    it('evaluates content_type_equals constraint case-insensitively', () => {
      // Arrange
      const videoConstraint = { id: 'c9', operator: 'content_type_equals' as const, value: 'video' };

      // Act & Assert
      expect(
        evaluateConstraint('https://example.com/asset', videoConstraint, undefined, 'video')
      ).toBe(true);
      expect(
        evaluateConstraint('https://example.com/asset', videoConstraint, undefined, 'VIDEO')
      ).toBe(true);
      expect(
        evaluateConstraint('https://example.com/asset', videoConstraint, undefined, 'article')
      ).toBe(false);
      expect(
        evaluateConstraint('https://example.com/asset', videoConstraint, undefined, undefined)
      ).toBe(false);
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

    it('evaluates rules with matchMode any when at least one constraint matches', () => {
      // Arrange
      const anyRule: CompoundSmartGroupRule = {
        id: 'r-any',
        name: 'Anime Media',
        group: 'Anime',
        matchMode: 'any',
        constraints: [
          { id: 'c1', operator: 'domain_contains', value: 'anime3rb.com' },
          { id: 'c2', operator: 'title_contains', value: 'Sousou no Frieren' },
        ],
      };

      // Act & Assert
      // First matches
      expect(evaluateCompoundRule('https://anime3rb.com/episode/1', anyRule)).toBe(true);
      // Second matches
      expect(
        evaluateCompoundRule('https://example.com/watch', anyRule, 'Sousou no Frieren - Episode 4')
      ).toBe(true);
      // Neither matches
      expect(
        evaluateCompoundRule('https://example.com/watch', anyRule, 'Unrelated title')
      ).toBe(false);
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
    it('contains all 14 curated presets with proper constraints', () => {
      // Assert
      expect(PRESET_SMART_RULES.length).toBe(14);

      const animePreset = PRESET_SMART_RULES.find((p) => p.id === 'preset-anime');
      expect(animePreset).toBeDefined();
      expect(animePreset?.group).toBe('Anime');
      expect(animePreset?.groupColor).toBe('indigo');
      expect(animePreset?.matchMode).toBe('any');
      expect(animePreset?.constraints.length).toBe(4);

      const devPreset = PRESET_SMART_RULES.find((p) => p.id === 'preset-dev');
      expect(devPreset).toBeDefined();
      expect(devPreset?.group).toBe('Dev');
      expect(devPreset?.groupColor).toBe('emerald');
      expect(devPreset?.constraints.length).toBe(6);

      const deenPreset = PRESET_SMART_RULES.find((p) => p.id === 'preset-deen');
      expect(deenPreset).toBeDefined();
      expect(deenPreset?.group).toBe('Deen');
      expect(deenPreset?.groupColor).toBe('teal');

      const musicPreset = PRESET_SMART_RULES.find((p) => p.id === 'preset-music');
      expect(musicPreset).toBeDefined();
      expect(musicPreset?.group).toBe('Music');
      expect(musicPreset?.groupColor).toBe('amber');

      const toolsPreset = PRESET_SMART_RULES.find((p) => p.id === 'preset-tools');
      expect(toolsPreset).toBeDefined();
      expect(toolsPreset?.group).toBe('Tools');
      expect(toolsPreset?.groupColor).toBe('cyan');

      const designPreset = PRESET_SMART_RULES.find((p) => p.id === 'preset-design');
      expect(designPreset).toBeDefined();
      expect(designPreset?.group).toBe('Design');
      expect(designPreset?.groupColor).toBe('rose');

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

    it('differentiates cache entries by title and content_type', () => {
      // Arrange
      clearSmartGroupCache();
      const url = 'https://youtube.com/watch?v=multi';
      const customRules: CompoundSmartGroupRule[] = [
        {
          id: 'rule-title',
          name: 'System Design Lectures',
          group: 'Dev',
          constraints: [{ id: 'c1', operator: 'title_contains', value: 'System Design' }],
        },
      ];

      // Act
      const noTitleResult = resolveSmartGroup(url, undefined, customRules);
      const withTitleResult = resolveSmartGroup(
        url,
        undefined,
        customRules,
        'Full System Design Course for Senior Engineers'
      );

      // Assert
      expect(noTitleResult).toBe('YT');
      expect(withTitleResult).toBe('Dev');
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

  describe('Retroactive Auto-Organization & Group Auto-Provisioning Engine', () => {
    it('retroactively resolves smart groups for remote-synced and local unsorted bookmarks', () => {
      // Arrange
      const bookmarks = [
        { id: 'b1', url: 'https://www.youtube.com/watch?v=1', group: 'Unsorted', userId: 'remote-synced' },
        { id: 'b2', url: 'https://instagram.com/p/2', group: 'Unsorted', userId: 'local-user' },
        { id: 'b3', url: 'https://x.com/post/3', group: 'Unsorted', userId: undefined },
        { id: 'b4', url: 'https://det.animarco.org/episode/4', group: 'Unsorted', userId: 'remote-synced' },
        { id: 'b5', url: 'https://random-blog.com/post/5', group: 'Unsorted', userId: 'local-user' },
      ];

      const customRules: CompoundSmartGroupRule[] = [
        {
          id: 'rule-anime',
          name: 'Anime Tracker',
          group: 'Anime',
          groupColor: 'purple',
          constraints: [{ id: 'c-anime', operator: 'domain_contains', value: 'animarco' }],
        },
      ];

      const knownGroups = ['YT', 'Insta', 'X'];

      // Act
      const organized = bookmarks.map((b) => {
        const smartGroup = resolveSmartGroup(b.url, knownGroups, customRules);
        return {
          ...b,
          newGroup: smartGroup && smartGroup.toLowerCase() !== 'unsorted' ? smartGroup : b.group,
        };
      });

      // Assert
      expect(organized[0].newGroup).toBe('YT');
      expect(organized[1].newGroup).toBe('Insta');
      expect(organized[2].newGroup).toBe('X');
      expect(organized[3].newGroup).toBe('Anime');
      expect(organized[4].newGroup).toBe('Unsorted');
    });

    it('identifies unprovisioned smart groups for auto-provisioning', () => {
      // Arrange
      const activeGroups = [{ id: 'g1', name: 'YT' }, { id: 'g2', name: 'Insta' }];
      const existingNames = new Set(activeGroups.map((g) => g.name.toLowerCase()));

      const targetGroup = 'Anime';

      // Act
      const needsProvisioning = !existingNames.has(targetGroup.toLowerCase());

      // Assert
      expect(needsProvisioning).toBe(true);
    });
  });

  describe('8-Pillar Taxonomy Presets Resolution Tests', () => {
    it('correctly categorizes Anime URLs and titles', () => {
      expect(
        resolveSmartGroup('https://anime3rb.com/titles/sousou-no-frieren/episodes/1', undefined, PRESET_SMART_RULES)
      ).toBe('Anime');
      expect(
        resolveSmartGroup('https://egydead.media/watch/123', undefined, PRESET_SMART_RULES)
      ).toBe('Anime');
      expect(
        resolveSmartGroup('https://example.com/watch', undefined, PRESET_SMART_RULES, 'Sousou no Frieren Ep 4')
      ).toBe('Anime');
      expect(
        resolveSmartGroup('https://example.com/watch', undefined, PRESET_SMART_RULES, 'Shangri-La Frontier S2')
      ).toBe('Anime');
    });

    it('correctly categorizes Dev URLs and titles', () => {
      expect(
        resolveSmartGroup('https://github.com/belal-waheed/markbel', undefined, PRESET_SMART_RULES)
      ).toBe('Dev');
      expect(
        resolveSmartGroup('https://velosfocus.pages.dev/dashboard', undefined, PRESET_SMART_RULES)
      ).toBe('Dev');
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=sd1', undefined, PRESET_SMART_RULES, 'System Design Fundamentals')
      ).toBe('Dev');
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=dk1', undefined, PRESET_SMART_RULES, 'Docker and Kubernetes Guide')
      ).toBe('Dev');
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=ai1', undefined, PRESET_SMART_RULES, 'Modern AI Workflow Tutorial')
      ).toBe('Dev');
    });

    it('correctly categorizes Deen titles', () => {
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=d1', undefined, PRESET_SMART_RULES, 'رحلة اليقين: بناء الدعائم')
      ).toBe('Deen');
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=d2', undefined, PRESET_SMART_RULES, 'شرح مختصر منهاج القاصدين')
      ).toBe('Deen');
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=d3', undefined, PRESET_SMART_RULES, 'آفات اللسان والنجاة منها')
      ).toBe('Deen');
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=d4', undefined, PRESET_SMART_RULES, 'لحظة تفكر في آيات الله')
      ).toBe('Deen');
    });

    it('correctly categorizes Music query params and titles', () => {
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=m1&list=RDabc123', undefined, PRESET_SMART_RULES)
      ).toBe('Music');
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=m2', undefined, PRESET_SMART_RULES, 'chill lofi indie playlist')
      ).toBe('Music');
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=m3', undefined, PRESET_SMART_RULES, 'Cry - Cigarettes After Sex (slowed + reverb)')
      ).toBe('Music');
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=m4', undefined, PRESET_SMART_RULES, 'Astrid S - Dance Dance Dance (Acoustic)')
      ).toBe('Music');
      expect(
        resolveSmartGroup('https://youtube.com/watch?v=m5', undefined, PRESET_SMART_RULES, 'Official Lyric Video')
      ).toBe('Music');
    });

    it('correctly categorizes Tools URLs', () => {
      expect(
        resolveSmartGroup('https://file-converter.io/compress-pdf', undefined, PRESET_SMART_RULES)
      ).toBe('Tools');
      expect(
        resolveSmartGroup('https://chromewebstore.google.com/detail/just-zoom-it', undefined, PRESET_SMART_RULES)
      ).toBe('Tools');
    });

    it('correctly categorizes Design URLs and titles', () => {
      expect(
        resolveSmartGroup('https://wallpapercave.com/w/wp123', undefined, PRESET_SMART_RULES)
      ).toBe('Design');
      expect(
        resolveSmartGroup('https://example.com/asset', undefined, PRESET_SMART_RULES, 'Aesthetic 4K Wallpaper')
      ).toBe('Design');
    });
  });

  describe('Firefox Manifest V3 Contract Validation', () => {
    it('validates Firefox manifest structure and Gecko configuration', async () => {
      // Arrange
      const fs = await import('fs');
      const path = await import('path');
      const manifestPath = path.resolve(process.cwd(), 'extension/manifest.firefox.json');

      // Act
      expect(fs.existsSync(manifestPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      // Assert
      expect(content.manifest_version).toBe(3);
      expect(content.browser_specific_settings?.gecko?.id).toBe('markbel-extension@obel.dev');
      expect(content.browser_specific_settings?.gecko?.strict_min_version).toBe('112.0');
      expect(content.background?.scripts).toEqual(['background.js']);
      expect(content.background?.type).toBe('module');
      expect(content.action?.default_popup).toBe('popup/index.html');
      expect(content.permissions).toContain('activeTab');
      expect(content.permissions).toContain('tabs');
    });
  });
});

