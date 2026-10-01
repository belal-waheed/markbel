/**
 * Smart Domain Auto-Grouper
 * Automatically categorizes URLs into predefined smart groups based on domain patterns,
 * with first-priority evaluation of user-defined custom domain rules stored in Dexie.
 */

import { db } from '../db/db.js';

export interface SmartGroupDefinition {
  name: string;
  color: string;
  patterns: (string | RegExp)[];
}

export interface CustomGroupRule {
  id: string;
  domain: string;
  group: string;
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
 * Retrieves user-defined custom smart group rules from Dexie appConfig.
 */
export async function getCustomSmartGroupRules(): Promise<CustomGroupRule[]> {
  try {
    const entry = await db.appConfig.get(CUSTOM_RULES_CONFIG_KEY);
    if (entry && Array.isArray(entry.value)) {
      return entry.value;
    }
  } catch (err) {
    console.warn('[SmartGroups] Failed to read custom rules from appConfig:', err);
  }
  return [];
}

/**
 * Persists user-defined custom smart group rules to Dexie appConfig.
 */
export async function saveCustomSmartGroupRules(rules: CustomGroupRule[]): Promise<void> {
  await db.appConfig.put({
    key: CUSTOM_RULES_CONFIG_KEY,
    value: rules,
  });
}

/**
 * Resolves the matching smart group name for a given URL.
 * Evaluates custom user-defined domain rules before falling back to default groups.
 * 
 * @param url The target URL to evaluate
 * @param availableGroups Optional list of active group names in the user's vault
 * @param customRules Optional list of user-defined custom domain rules
 * @returns The matched group name or 'Unsorted' if no match.
 */
export function resolveSmartGroup(
  url: string,
  availableGroups?: string[],
  customRules?: CustomGroupRule[]
): string {
  if (!url || typeof url !== 'string') return 'Unsorted';

  const hostname = extractHostname(url);
  if (!hostname) return 'Unsorted';

  // 1. Evaluate User Custom Rules FIRST (higher priority)
  if (customRules && customRules.length > 0) {
    for (const rule of customRules) {
      if (!rule.domain || !rule.group) continue;
      const ruleDomain = extractHostname(rule.domain) || rule.domain.toLowerCase().trim();
      if (!ruleDomain) continue;

      if (hostname === ruleDomain || hostname.endsWith(`.${ruleDomain}`)) {
        if (availableGroups && availableGroups.length > 0) {
          const matchedGroup = availableGroups.find(
            (g) => g.toLowerCase() === rule.group.toLowerCase()
          );
          if (matchedGroup) {
            return matchedGroup;
          }
        }
        return rule.group;
      }
    }
  }

  // 2. Fall back to DEFAULT_SMART_GROUPS
  for (const group of DEFAULT_SMART_GROUPS) {
    const isMatch = group.patterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return hostname === pattern || hostname.endsWith(`.${pattern}`);
      }
      return pattern.test(hostname);
    });

    if (isMatch) {
      // If availableGroups is provided, verify group exists or is enabled
      if (availableGroups && availableGroups.length > 0) {
        const groupExists = availableGroups.some(
          (g) => g.toLowerCase() === group.name.toLowerCase()
        );
        if (groupExists) {
          // Return the casing as present in availableGroups
          const matchedName = availableGroups.find(
            (g) => g.toLowerCase() === group.name.toLowerCase()
          );
          return matchedName || group.name;
        }
      } else {
        return group.name;
      }
    }
  }

  return 'Unsorted';
}
