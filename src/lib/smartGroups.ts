/**
 * Smart Domain Auto-Grouper & Multi-Constraint Engine
 * Categorizes URLs into predefined smart groups or compound user-defined rules
 * with specificity scoring, operator matching, and 1-click preset auto-provisioning.
 */

import { db } from '../db/db.js';

export type ConstraintOperator =
  | 'domain_equals'
  | 'domain_contains'
  | 'url_contains'
  | 'path_starts_with'
  | 'query_param_exists';

export interface RuleConstraint {
  id: string;
  operator: ConstraintOperator;
  value: string;
}

export interface CompoundSmartGroupRule {
  id: string;
  name: string;
  group: string;
  groupColor?: string;
  constraints: RuleConstraint[];
  isPreset?: boolean;
  createdAt?: string;
}

export interface CustomGroupRule {
  id: string;
  domain: string;
  group: string;
}

export interface SmartGroupDefinition {
  name: string;
  color: string;
  patterns: (string | RegExp)[];
}

export interface RuleMatchResult {
  group: string;
  ruleName?: string;
  matchedRule?: CompoundSmartGroupRule;
  isDefault?: boolean;
}

export const CUSTOM_RULES_CONFIG_KEY = 'customSmartGroupRules';

export const DEFAULT_SMART_GROUPS: SmartGroupDefinition[] = [
  {
    name: 'YT',
    color: 'red',
    patterns: [
      'youtube.com',
      'youtu.be',
      'm.youtube.com',
      'music.youtube.com',
    ],
  },
  {
    name: 'Insta',
    color: 'purple',
    patterns: [
      'instagram.com',
      'instagr.am',
      'ig.me',
    ],
  },
  {
    name: 'X',
    color: 'slate',
    patterns: [
      'twitter.com',
      'x.com',
      't.co',
      'mobile.twitter.com',
      'mobile.x.com',
    ],
  },
];

export const PRESET_SMART_RULES: CompoundSmartGroupRule[] = [
  {
    id: 'preset-yt-playlists',
    name: 'YouTube Playlists',
    group: 'YT Playlists',
    groupColor: 'amber',
    isPreset: true,
    constraints: [
      { id: 'c-yt-domain', operator: 'domain_equals', value: 'youtube.com' },
      { id: 'c-yt-list', operator: 'url_contains', value: 'list=' },
    ],
  },
  {
    id: 'preset-yt-videos',
    name: 'YouTube Videos',
    group: 'YT',
    groupColor: 'red',
    isPreset: true,
    constraints: [
      { id: 'c-yt-v-domain', operator: 'domain_equals', value: 'youtube.com' },
    ],
  },
  {
    id: 'preset-github-repos',
    name: 'GitHub Repos',
    group: 'Code',
    groupColor: 'emerald',
    isPreset: true,
    constraints: [
      { id: 'c-gh-domain', operator: 'domain_equals', value: 'github.com' },
    ],
  },
  {
    id: 'preset-reddit',
    name: 'Reddit Communities',
    group: 'Reddit',
    groupColor: 'orange',
    isPreset: true,
    constraints: [
      { id: 'c-rd-domain', operator: 'domain_equals', value: 'reddit.com' },
      { id: 'c-rd-path', operator: 'url_contains', value: '/r/' },
    ],
  },
  {
    id: 'preset-x-twitter',
    name: 'X / Twitter',
    group: 'X',
    groupColor: 'slate',
    isPreset: true,
    constraints: [
      { id: 'c-x-domain', operator: 'domain_equals', value: 'x.com' },
    ],
  },
  {
    id: 'preset-newsletters',
    name: 'Newsletters & Articles',
    group: 'Reading',
    groupColor: 'purple',
    isPreset: true,
    constraints: [
      { id: 'c-sub-domain', operator: 'domain_contains', value: 'substack.com' },
    ],
  },
  {
    id: 'preset-academic-pdf',
    name: 'Academic Papers',
    group: 'Research',
    groupColor: 'blue',
    isPreset: true,
    constraints: [
      { id: 'c-pdf-url', operator: 'url_contains', value: '.pdf' },
    ],
  },
  {
    id: 'preset-instagram',
    name: 'Instagram',
    group: 'Insta',
    groupColor: 'pink',
    isPreset: true,
    constraints: [
      { id: 'c-ig-domain', operator: 'domain_equals', value: 'instagram.com' },
    ],
  },
];

/**
 * Normalizes a raw URL or domain string to extract hostname for matching.
 */
export function extractHostname(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    let formatted = rawUrl.trim().toLowerCase();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = `https://${formatted}`;
    }
    const parsed = new URL(formatted);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl.trim().toLowerCase().replace(/^www\./, '');
  }
}

/**
 * Safely parses any URL string into a WHATWG URL instance, automatically supplying
 * a protocol if omitted.
 */
export function safeParseUrl(rawUrl: string): URL | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return new URL(`https://${trimmed}`);
    }
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/**
 * Checks if a rule is an instance of CompoundSmartGroupRule.
 */
export function isCompoundRule(rule: any): rule is CompoundSmartGroupRule {
  return rule && typeof rule === 'object' && Array.isArray(rule.constraints);
}

/**
 * Normalizes legacy CustomGroupRule ({ id, domain, group }) into CompoundSmartGroupRule.
 */
export function normalizeRule(rule: CompoundSmartGroupRule | CustomGroupRule): CompoundSmartGroupRule {
  if (isCompoundRule(rule)) {
    return {
      ...rule,
      name: rule.name || rule.group,
      constraints: (rule.constraints || []).map((c) => ({
        id: c.id || crypto.randomUUID(),
        operator: c.operator,
        value: c.value,
      })),
      createdAt: rule.createdAt || new Date().toISOString(),
    };
  }

  const legacy = rule as CustomGroupRule;
  return {
    id: legacy.id || crypto.randomUUID(),
    name: legacy.domain || legacy.group,
    group: legacy.group,
    constraints: [
      {
        id: crypto.randomUUID(),
        operator: 'domain_equals',
        value: legacy.domain || '',
      },
    ],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Evaluates a single atomic constraint against a URL.
 */
export function evaluateConstraint(url: string, constraint: RuleConstraint): boolean {
  if (!url || !constraint || !constraint.value) return false;
  const parsed = safeParseUrl(url);
  if (!parsed) return false;

  const rawUrlLower = url.toLowerCase();
  const val = constraint.value.trim().toLowerCase();
  if (!val) return false;

  const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();

  switch (constraint.operator) {
    case 'domain_equals': {
      const cleanVal = extractHostname(val) || val.replace(/^www\./, '');
      return hostname === cleanVal || hostname.endsWith(`.${cleanVal}`);
    }
    case 'domain_contains': {
      return hostname.includes(val);
    }
    case 'url_contains': {
      return parsed.href.toLowerCase().includes(val) || rawUrlLower.includes(val);
    }
    case 'path_starts_with': {
      const pathname = parsed.pathname.toLowerCase();
      const normVal = val.startsWith('/') ? val : `/${val}`;
      return pathname.startsWith(normVal);
    }
    case 'query_param_exists': {
      if (val.includes('=')) {
        const [paramKey, ...rest] = val.split('=');
        const expectedVal = rest.join('=');
        const actualVal = parsed.searchParams.get(paramKey.trim());
        if (actualVal === null) {
          return parsed.search.toLowerCase().includes(val);
        }
        if (!expectedVal) return true;
        return (
          actualVal.toLowerCase() === expectedVal.toLowerCase() ||
          actualVal.toLowerCase().includes(expectedVal.toLowerCase())
        );
      } else {
        return parsed.searchParams.has(val) || parsed.search.toLowerCase().includes(val);
      }
    }
    default:
      return false;
  }
}

/**
 * Evaluates all constraints of a compound rule with logical AND.
 * Returns false if rule has no constraints.
 */
export function evaluateCompoundRule(url: string, rule: CompoundSmartGroupRule): boolean {
  if (!url || !rule || !Array.isArray(rule.constraints) || rule.constraints.length === 0) {
    return false;
  }
  return rule.constraints.every((c) => evaluateConstraint(url, c));
}

/**
 * Calculates a specificity score for deterministic rule evaluation ordering.
 * Compound rules with more constraints and granular conditions (path, query, url_contains)
 * receive higher scores than broad single-domain rules.
 */
export function calculateRuleSpecificity(rule: CompoundSmartGroupRule): number {
  if (!rule.constraints || rule.constraints.length === 0) return 0;
  let score = rule.constraints.length * 10;
  for (const c of rule.constraints) {
    switch (c.operator) {
      case 'query_param_exists':
        score += 20;
        break;
      case 'path_starts_with':
      case 'url_contains':
        score += 15;
        break;
      case 'domain_equals':
        score += 5 + Math.min(c.value.length, 10);
        break;
      case 'domain_contains':
        score += 3 + Math.min(c.value.length, 10);
        break;
      default:
        score += 1;
    }
  }
  return score;
}

/**
 * Normalizes and sorts rules descending by specificity.
 */
export function sortRulesBySpecificity(
  rules: (CompoundSmartGroupRule | CustomGroupRule)[]
): CompoundSmartGroupRule[] {
  const normalized = rules.map(normalizeRule);
  return [...normalized].sort(
    (a, b) => calculateRuleSpecificity(b) - calculateRuleSpecificity(a)
  );
}

/**
 * Retrieves user-defined custom smart group rules from Dexie appConfig.
 */
export async function getCustomSmartGroupRules(): Promise<CompoundSmartGroupRule[]> {
  try {
    const entry = await db.appConfig.get(CUSTOM_RULES_CONFIG_KEY);
    if (entry && Array.isArray(entry.value)) {
      return entry.value.map(normalizeRule);
    }
  } catch (err) {
    console.warn('[SmartGroups] Failed to read custom rules from appConfig:', err);
  }
  return [];
}

/**
 * Persists user-defined custom smart group rules to Dexie appConfig.
 */
export async function saveCustomSmartGroupRules(
  rules: (CompoundSmartGroupRule | CustomGroupRule)[]
): Promise<void> {
  const normalized = rules.map(normalizeRule);
  await db.appConfig.put({
    key: CUSTOM_RULES_CONFIG_KEY,
    value: normalized,
  });
}

/**
 * Inspects a URL and returns detailed match result including matched rule name and rule object.
 */
export function inspectSmartGroupMatch(
  url: string,
  availableGroups?: string[],
  customRules?: (CompoundSmartGroupRule | CustomGroupRule)[]
): RuleMatchResult {
  if (!url || typeof url !== 'string') {
    return { group: 'Unsorted', isDefault: false };
  }

  // 1. Evaluate User Custom Rules FIRST (higher priority, sorted by specificity)
  if (customRules && customRules.length > 0) {
    const sortedRules = sortRulesBySpecificity(customRules);
    for (const rule of sortedRules) {
      if (evaluateCompoundRule(url, rule)) {
        let targetGroup = rule.group;
        if (availableGroups && availableGroups.length > 0) {
          const matchedGroup = availableGroups.find(
            (g) => g.toLowerCase() === rule.group.toLowerCase()
          );
          if (matchedGroup) {
            targetGroup = matchedGroup;
          }
        }
        return {
          group: targetGroup,
          ruleName: rule.name || rule.group,
          matchedRule: rule,
          isDefault: false,
        };
      }
    }
  }

  // 2. Fall back to DEFAULT_SMART_GROUPS
  const hostname = extractHostname(url);
  if (!hostname) return { group: 'Unsorted', isDefault: false };

  for (const group of DEFAULT_SMART_GROUPS) {
    const isMatch = group.patterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return hostname === pattern || hostname.endsWith(`.${pattern}`);
      }
      return pattern.test(hostname);
    });

    if (isMatch) {
      if (availableGroups && availableGroups.length > 0) {
        const matchedName = availableGroups.find(
          (g) => g.toLowerCase() === group.name.toLowerCase()
        );
        if (matchedName) {
          return {
            group: matchedName,
            ruleName: `Default (${group.name})`,
            isDefault: true,
          };
        }
      } else {
        return {
          group: group.name,
          ruleName: `Default (${group.name})`,
          isDefault: true,
        };
      }
    }
  }

  return { group: 'Unsorted', isDefault: false };
}

/**
 * Resolves the matching smart group name for a given URL.
 * Evaluates custom user-defined compound rules before falling back to default groups.
 */
export function resolveSmartGroup(
  url: string,
  availableGroups?: string[],
  customRules?: (CompoundSmartGroupRule | CustomGroupRule)[]
): string {
  const match = inspectSmartGroupMatch(url, availableGroups, customRules);
  return match.group;
}

/**
 * Installs a preset smart rule and auto-provisions its target group in Dexie and the sync outbox.
 */
export async function installPresetRule(presetId: string): Promise<CompoundSmartGroupRule> {
  const preset = PRESET_SMART_RULES.find((p) => p.id === presetId);
  if (!preset) {
    throw new Error(`Preset rule with ID "${presetId}" not found.`);
  }

  // 1. Auto-provision group in db.groups if not present
  try {
    const existingGroup = await db.groups
      .filter((g) => !g.deletedAt && g.name.toLowerCase() === preset.group.toLowerCase())
      .first();

    if (!existingGroup) {
      const now = new Date().toISOString();
      const newGroupId = crypto.randomUUID();
      const newGroup = {
        id: newGroupId,
        userId: 'local-user',
        name: preset.group,
        color: preset.groupColor || 'blue',
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      await db.transaction('rw', [db.groups, db.syncOutbox], async () => {
        await db.groups.add(newGroup);
        await db.syncOutbox.add({
          id: crypto.randomUUID(),
          entityType: 'group',
          entityId: newGroupId,
          operation: 'create',
          baseVersion: 0,
          payload: newGroup,
          status: 'pending',
          attempts: 0,
          createdAt: now,
        });
      });
    }
  } catch (err) {
    console.warn('[SmartGroups] Group auto-provision notice:', err);
  }

  // 2. Add rule to customSmartGroupRules in appConfig if not present
  const currentRules = await getCustomSmartGroupRules();
  const alreadyInstalled = currentRules.some(
    (r) => r.id === preset.id || r.name.toLowerCase() === preset.name.toLowerCase()
  );

  if (!alreadyInstalled) {
    const updated = [
      {
        ...preset,
        createdAt: new Date().toISOString(),
      },
      ...currentRules,
    ];
    await saveCustomSmartGroupRules(updated);
  }

  return preset;
}

/**
 * Uninstalls a preset smart rule from custom rules.
 */
export async function uninstallPresetRule(presetId: string): Promise<void> {
  const preset = PRESET_SMART_RULES.find((p) => p.id === presetId);
  const currentRules = await getCustomSmartGroupRules();
  const updated = currentRules.filter((r) => {
    if (r.id === presetId) return false;
    if (preset && r.isPreset && r.name.toLowerCase() === preset.name.toLowerCase()) return false;
    return true;
  });
  await saveCustomSmartGroupRules(updated);
}
