/**
 * Markbel - Link Health Prober & Rot Detector
 * Provides HTTP HEAD/GET range probing with timeout and error handling,
 * and scheduled batch health checking for Cloudflare D1 bookmarks.
 */

import { isSafePublicUrl } from '../../../src/lib/urlSafety';

export interface LinkHealthResult {
  isBroken: boolean;
  httpStatus: number;
}

/**
 * Probes a URL using a non-blocking HEAD request (5s timeout), falling back
 * to a byte-range GET request if HEAD is rejected or unsupported.
 */
export async function probeUrlHealth(url: string): Promise<LinkHealthResult> {
  if (!url || !isSafePublicUrl(url)) {
    return { isBroken: true, httpStatus: 400 };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'MarkbelHealthCheck/2.5.16' },
        redirect: 'follow',
      });
      // Fallback to range GET if server disallows HEAD (405) or blocks it (403)
      if (res.status === 405 || res.status === 403) {
        res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'MarkbelHealthCheck/2.5.16', Range: 'bytes=0-1024' },
          redirect: 'follow',
        });
      }
    } catch {
      // Retry with GET on network/protocol error
      res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'MarkbelHealthCheck/2.5.16', Range: 'bytes=0-1024' },
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timeout);
    }
    const httpStatus = res.status;
    const isBroken = httpStatus === 404 || httpStatus === 410 || httpStatus >= 500;
    return { isBroken, httpStatus };
  } catch {
    return { isBroken: true, httpStatus: 0 };
  }
}

/**
 * Scheduled cron batch checker: selects oldest uninspected bookmarks, probes each URL,
 * updates health status in D1, and writes audit changes to sync_changes.
 */
export async function handleScheduledLinkHealthCheck(
  env: { DB?: any },
  limit = 20
): Promise<{ checked: number; broken: number }> {
  if (!env || !env.DB) return { checked: 0, broken: 0 };

  try {
    const query = `
      SELECT id, user_id, url, title, is_broken, http_status, last_checked_at, version
      FROM bookmarks
      WHERE deleted_at IS NULL AND (last_checked_at IS NULL OR last_checked_at < datetime('now', '-7 days'))
      ORDER BY CASE WHEN last_checked_at IS NULL THEN 0 ELSE 1 END, last_checked_at ASC
      LIMIT ?
    `;

    const { results } = await env.DB.prepare(query).bind(limit).all();
    if (!results || results.length === 0) {
      return { checked: 0, broken: 0 };
    }

    let brokenCount = 0;

    for (const row of results) {
      const { isBroken, httpStatus } = await probeUrlHealth(row.url);
      if (isBroken) brokenCount++;

      const now = new Date().toISOString();
      const statusChanged = (row.is_broken ?? 0) !== (isBroken ? 1 : 0) || row.http_status !== httpStatus;

      if (statusChanged) {
        const newVersion = (row.version || 0) + 1;

        await env.DB.prepare(
          'UPDATE bookmarks SET is_broken = ?, http_status = ?, last_checked_at = ?, version = ?, updated_at = ? WHERE id = ?'
        )
          .bind(isBroken ? 1 : 0, httpStatus, now, newVersion, now, row.id)
          .run();

        const changeId = `cron-health-${row.id}-${Date.now()}`;
        const updatedRecord = {
          ...row,
          is_broken: isBroken ? 1 : 0,
          http_status: httpStatus,
          last_checked_at: now,
          version: newVersion,
          updated_at: now,
        };

        await env.DB.prepare(
          `INSERT INTO sync_changes (
            user_id, entity_type, entity_id, operation, entity_version, client_change_id, actor_type, actor_name, record_json, changed_at
          ) VALUES (?, 'bookmark', ?, 'update', ?, ?, 'agent', 'LinkRotDetector', ?, ?)`
        )
          .bind(row.user_id, row.id, newVersion, changeId, JSON.stringify(updatedRecord), now)
          .run();
      } else {
        await env.DB.prepare(
          'UPDATE bookmarks SET last_checked_at = ? WHERE id = ?'
        )
          .bind(now, row.id)
          .run();
      }
    }

    return { checked: results.length, broken: brokenCount };
  } catch (err) {
    console.error('[Scheduled Health Check Error]:', err);
    return { checked: 0, broken: 0 };
  }
}
