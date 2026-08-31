/**
 * Smart Domain Auto-Grouper
 * Automatically categorizes URLs into predefined smart groups based on domain patterns.
 */

export interface SmartGroupDefinition {
  name: string;
  color: string;
  patterns: (string | RegExp)[];
}

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
 * Resolves the matching smart group name for a given URL.
 * 
 * @param url The target URL to evaluate
 * @param availableGroups Optional list of active group names in the user's vault
 * @returns The matched group name ('YT', 'Insta', 'X') or 'Unsorted' if no match / group unavailable.
 */
export function resolveSmartGroup(url: string, availableGroups?: string[]): string {
  if (!url || typeof url !== 'string') return 'Unsorted';

  const hostname = extractHostname(url);
  if (!hostname) return 'Unsorted';

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
