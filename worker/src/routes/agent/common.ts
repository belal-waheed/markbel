// Domain & Database Row Interfaces
export interface BookmarkDbRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  title: string;
  url: string;
  description: string;
  image: string;
  favicon: string;
  site_name: string;
  author: string;
  published_at: string;
  content_type: string;
  reading_time: number;
  word_count: number;
  canonical_url: string;
  article_content: string;
  group_name: string;
  is_read: number;
  read_at: string;
  is_pinned: number;
  remind_at: string;
  is_archived: number;
  archive_group: string;
  actor_type: string;
  actor_name: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface GroupDbRow {
  id: string;
  name: string;
  color: string;
  bookmarkCount?: number;
}

export interface CountDbRow {
  total?: number;
  count?: number;
}

export interface UserSettingsDbRow {
  rules_json?: string;
  preferences_json?: string;
}

export interface MaxSeqDbRow {
  max_seq?: number;
}

/**
 * Safely extracts an error message string from an unknown caught error.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Generates a concise search snippet (~120-160 chars) highlighting matching context
 * from description or article content.
 */
export function generateSearchSnippet(
  description?: string | null,
  articleContent?: string | null,
  terms: string[] = []
): string | null {
  const cleanDesc = (description || "").replace(/\s+/g, " ").trim();
  const cleanArticle = (articleContent || "").replace(/\s+/g, " ").trim();

  if (!cleanDesc && !cleanArticle) return null;

  const candidateTexts = [cleanDesc, cleanArticle].filter(Boolean);
  if (terms.length === 0) {
    const fallback = candidateTexts[0] || "";
    return fallback.length > 150 ? fallback.slice(0, 147) + "..." : fallback || null;
  }

  // Locate the earliest term match across description or article content
  let targetText = "";
  let matchIndex = -1;

  for (const text of candidateTexts) {
    const lower = text.toLowerCase();
    for (const term of terms) {
      const idx = lower.indexOf(term.toLowerCase());
      if (idx !== -1 && (matchIndex === -1 || idx < matchIndex)) {
        targetText = text;
        matchIndex = idx;
      }
    }
    if (targetText && matchIndex !== -1) break;
  }

  if (!targetText || matchIndex === -1) {
    const fallback = candidateTexts[0] || "";
    return fallback.length > 150 ? fallback.slice(0, 147) + "..." : fallback || null;
  }

  const targetWindow = 140;
  const leadChars = 35;
  const start = Math.max(0, matchIndex - leadChars);
  const end = Math.min(targetText.length, start + targetWindow);

  let snippet = targetText.slice(start, end).trim();
  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < targetText.length) {
    snippet = snippet + "...";
  }

  return snippet;
}
