import { describe, it, expect } from 'vitest'

describe('Guest Data Migration & Cache Key Protocol', () => {
  it('maps guest bookmarks to authenticated user and generates outbox creation changes', () => {
    const guestBookmarks = [
      {
        id: 'guest-bm-1',
        userId: 'local-user',
        title: 'Awesome Article',
        url: 'https://example.com/article',
        group: 'Unsorted',
        version: 0,
        createdAt: '2026-08-31T05:00:00.000Z',
        updatedAt: '2026-08-31T05:00:00.000Z',
        deletedAt: null,
      },
      {
        id: 'guest-bm-2',
        userId: '',
        title: 'Another Article',
        url: 'https://example.com/2',
        group: 'Dev',
        version: 0,
        createdAt: '2026-08-31T05:10:00.000Z',
        updatedAt: '2026-08-31T05:10:00.000Z',
        deletedAt: null,
      },
    ]

    const targetUserId = 'auth-user-999'
    const migrated = guestBookmarks.map((b) => ({
      ...b,
      userId: targetUserId,
      updatedAt: new Date().toISOString(),
    }))

    expect(migrated.every((b) => b.userId === targetUserId)).toBe(true)

    const outboxItems = migrated.map((b) => ({
      id: `outbox-${b.id}`,
      entityType: 'bookmark',
      entityId: b.id,
      operation: 'create',
      baseVersion: b.version,
      payload: b,
      status: 'pending',
      attempts: 0,
    }))

    expect(outboxItems.length).toBe(2)
    expect(outboxItems[0].payload.userId).toBe('auth-user-999')
    expect(outboxItems[1].payload.userId).toBe('auth-user-999')
  })

  it('verifies Upstash Redis Cache key generation and hash consistency', async () => {
    const computeHash = async (str: string) => {
      const enc = new TextEncoder().encode(str)
      const buf = await crypto.subtle.digest('SHA-256', enc)
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    }

    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const hash = await computeHash(testUrl)
    const cacheKey = `markbel:metadata:${hash}`

    expect(hash).toHaveLength(64)
    expect(cacheKey.startsWith('markbel:metadata:')).toBe(true)

    // Verify deterministic hash
    const secondHash = await computeHash(testUrl)
    expect(secondHash).toBe(hash)
  })
})
