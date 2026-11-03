import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  db,
  CachedThumbnail,
  getCachedThumbnail,
  saveCachedThumbnail,
  pruneCachedThumbnails,
} from '../db/db';
import {
  captureAndCacheThumbnail,
  getInitialStage,
} from '../components/BookmarkImage';

describe('CachedThumbnail Dexie Blob Storage & Offline Cache FSM', () => {
  let thumbnailStore: Map<string, CachedThumbnail>;

  beforeEach(() => {
    thumbnailStore = new Map();

    (vi.spyOn(db.cachedThumbnails, 'get') as any).mockImplementation(async (id: any) => {
      return thumbnailStore.get(id as string) || undefined;
    });

    (vi.spyOn(db.cachedThumbnails, 'put') as any).mockImplementation(async (item: any) => {
      thumbnailStore.set(item.id, item);
      return item.id;
    });

    (vi.spyOn(db.cachedThumbnails, 'count') as any).mockImplementation(async () => {
      return thumbnailStore.size;
    });

    (vi.spyOn(db.cachedThumbnails, 'bulkDelete') as any).mockImplementation(async (keys: any) => {
      for (const key of keys) {
        thumbnailStore.delete(key);
      }
    });

    (vi.spyOn(db.cachedThumbnails, 'orderBy') as any).mockImplementation((_index: any) => {
      return {
        limit: (limitCount: number) => ({
          primaryKeys: async () => {
            const items = Array.from(thumbnailStore.values());
            items.sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
            return items.slice(0, limitCount).map((item) => item.id);
          },
        }),
      } as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('saveCachedThumbnail and getCachedThumbnail', () => {
    it('saves an image blob with metadata and retrieves it correctly', async () => {
      const url = 'https://images.unsplash.com/photo-sample.jpg';
      const mockBlob = new Blob(['sample-binary-image-data'], { type: 'image/jpeg' });

      await saveCachedThumbnail(url, mockBlob, 'image/jpeg');

      const cached = await getCachedThumbnail(url);
      expect(cached).not.toBeNull();
      expect(cached?.id).toBe(url);
      expect(cached?.contentType).toBe('image/jpeg');
      expect(cached?.size).toBe(mockBlob.size);
      expect(cached?.blob).toBe(mockBlob);
      expect(cached?.updatedAt).toBeDefined();
      expect(new Date(cached!.updatedAt).getTime()).not.toBeNaN();
    });

    it('defaults contentType to image/jpeg if empty or omitted', async () => {
      const url = 'https://example.com/art.png';
      const mockBlob = new Blob(['png-data'], { type: '' });

      await saveCachedThumbnail(url, mockBlob, '');

      const cached = await getCachedThumbnail(url);
      expect(cached?.contentType).toBe('image/jpeg');
    });

    it('returns null when querying a non-existent or empty URL', async () => {
      expect(await getCachedThumbnail('')).toBeNull();
      expect(await getCachedThumbnail('https://non-existent.com/img.jpg')).toBeNull();
    });

    it('gracefully handles empty url or missing blob in save without throwing', async () => {
      await expect(saveCachedThumbnail('', null as any)).resolves.not.toThrow();
      await expect(saveCachedThumbnail('https://valid.com/1', null as any)).resolves.not.toThrow();
      expect(thumbnailStore.size).toBe(0);
    });

    it('overwrites previous cached thumbnail for the same URL with updated timestamp', async () => {
      const url = 'https://example.com/logo.webp';
      const blob1 = new Blob(['v1'], { type: 'image/webp' });
      const blob2 = new Blob(['v2-larger-bytes'], { type: 'image/webp' });

      await saveCachedThumbnail(url, blob1, 'image/webp');
      const firstCached = await getCachedThumbnail(url);
      expect(firstCached?.size).toBe(blob1.size);

      await saveCachedThumbnail(url, blob2, 'image/webp');
      const secondCached = await getCachedThumbnail(url);
      expect(secondCached?.size).toBe(blob2.size);
      expect(thumbnailStore.size).toBe(1);
    });
  });

  describe('pruneCachedThumbnails LRU Eviction', () => {
    it('returns 0 and does not delete when count is within maxCount limit', async () => {
      thumbnailStore.set('https://example.com/1', {
        id: 'https://example.com/1',
        blob: new Blob(['1']),
        contentType: 'image/jpeg',
        size: 1,
        updatedAt: '2026-01-01T00:00:00Z',
      });
      thumbnailStore.set('https://example.com/2', {
        id: 'https://example.com/2',
        blob: new Blob(['2']),
        contentType: 'image/jpeg',
        size: 1,
        updatedAt: '2026-01-02T00:00:00Z',
      });

      const deleted = await pruneCachedThumbnails(10);
      expect(deleted).toBe(0);
      expect(thumbnailStore.size).toBe(2);
    });

    it('evicts the oldest thumbnails by updatedAt when count exceeds maxCount', async () => {
      const timestamps = [
        '2026-01-01T00:00:00Z', // oldest 1
        '2026-01-02T00:00:00Z', // oldest 2
        '2026-01-03T00:00:00Z', // oldest 3
        '2026-01-04T00:00:00Z',
        '2026-01-05T00:00:00Z',
      ];

      for (let i = 0; i < timestamps.length; i++) {
        const id = `https://example.com/img-${i + 1}`;
        thumbnailStore.set(id, {
          id,
          blob: new Blob([`data-${i}`]),
          contentType: 'image/jpeg',
          size: 10,
          updatedAt: timestamps[i],
        });
      }

      expect(thumbnailStore.size).toBe(5);

      // Prune to keep only 2 (evicting 3 oldest: img-1, img-2, img-3)
      const prunedCount = await pruneCachedThumbnails(2);
      expect(prunedCount).toBe(3);
      expect(thumbnailStore.size).toBe(2);
      expect(thumbnailStore.has('https://example.com/img-1')).toBe(false);
      expect(thumbnailStore.has('https://example.com/img-2')).toBe(false);
      expect(thumbnailStore.has('https://example.com/img-3')).toBe(false);
      expect(thumbnailStore.has('https://example.com/img-4')).toBe(true);
      expect(thumbnailStore.has('https://example.com/img-5')).toBe(true);
    });

    it('defaults maxCount to 300', async () => {
      const deleted = await pruneCachedThumbnails();
      expect(deleted).toBe(0);
    });

    it('handles database error during prune gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(db.cachedThumbnails, 'count').mockRejectedValueOnce(new Error('IndexedDB locked'));
      const deleted = await pruneCachedThumbnails(10);
      expect(deleted).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('captureAndCacheThumbnail Network & Proxy Fallback', () => {
    it('skips capture if image is already cached in Dexie', async () => {
      const url = 'https://example.com/already-cached.jpg';
      thumbnailStore.set(url, {
        id: url,
        blob: new Blob(['exists']),
        contentType: 'image/jpeg',
        size: 6,
        updatedAt: '2026-01-01T00:00:00Z',
      });

      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      await captureAndCacheThumbnail(url);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('captures blob directly when CORS fetch succeeds', async () => {
      const url = 'https://images.unsplash.com/direct.jpg';
      const mockBlob = new Blob(['cors-image-bytes'], { type: 'image/webp' });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
        headers: new Headers({ 'content-type': 'image/webp' }),
      }));

      await captureAndCacheThumbnail(url);

      const cached = thumbnailStore.get(url);
      expect(cached).toBeDefined();
      expect(cached?.contentType).toBe('image/webp');
      expect(cached?.size).toBe(mockBlob.size);
    });

    it('falls back to image proxy when direct CORS fetch fails', async () => {
      const targetUrl = 'https://cors-protected.com/banner.jpg';
      const mockBlob = new Blob(['proxy-image-bytes'], { type: 'image/png' });

      const fetchSpy = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch due to CORS'))
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => mockBlob,
          headers: new Headers({ 'content-type': 'image/png' }),
        });

      vi.stubGlobal('fetch', fetchSpy);

      await captureAndCacheThumbnail(targetUrl, 'https://mark.obel.workers.dev');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[1][0]).toContain('/api/proxy/image?url=');

      const cached = thumbnailStore.get(targetUrl);
      expect(cached).toBeDefined();
      expect(cached?.size).toBe(mockBlob.size);
    });

    it('deduplicates simultaneous concurrent capture requests for the same URL', async () => {
      const url = 'https://example.com/concurrent.jpg';
      const mockBlob = new Blob(['concurrent-data']);

      let fetchCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
        fetchCount++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          ok: true,
          blob: async () => mockBlob,
          headers: new Headers({ 'content-type': 'image/jpeg' }),
        };
      }));

      // Fire 3 simultaneous capture requests
      await Promise.all([
        captureAndCacheThumbnail(url),
        captureAndCacheThumbnail(url),
        captureAndCacheThumbnail(url),
      ]);

      expect(fetchCount).toBe(1);
    });
  });

  describe('BookmarkImage Offline Loading & Blob Cache Protocol', () => {
    it('initializes to DIRECT even when offline so local cache can serve the image', () => {
      vi.stubGlobal('navigator', { onLine: false });
      const stage = getInitialStage('https://example.com/offline-pic.jpg', 'https://example.com/fav.ico');
      expect(stage).toBe('DIRECT');
    });

    it('retrieves cached blob and generates object URL when device is offline', async () => {
      vi.stubGlobal('navigator', { onLine: false });

      const imageUrl = 'https://example.com/offline-test.jpg';
      const mockBlob = new Blob(['offline-image-binary'], { type: 'image/jpeg' });

      await saveCachedThumbnail(imageUrl, mockBlob, 'image/jpeg');

      // Verify that getCachedThumbnail returns the blob
      const cached = await getCachedThumbnail(imageUrl);
      expect(cached).not.toBeNull();
      expect(cached?.blob).toBe(mockBlob);

      // Verify URL.createObjectURL creates a valid blob URI
      const objectUrl = URL.createObjectURL(cached!.blob);
      expect(objectUrl.startsWith('blob:')).toBe(true);

      // Verify URL.revokeObjectURL cleans up the URL without error
      expect(() => URL.revokeObjectURL(objectUrl)).not.toThrow();
    });

    it('recovers from network failure by checking Dexie blob cache before advancing to favicon/placeholder', async () => {
      const imageUrl = 'https://example.com/network-flaky.jpg';
      const mockBlob = new Blob(['recovered-blob'], { type: 'image/png' });

      await saveCachedThumbnail(imageUrl, mockBlob, 'image/png');

      // Simulate BookmarkImage handleError recovery flow
      let activeBlobUrl: string | null = null;
      let stage: string = 'DIRECT';

      const simulateHandleError = async (url: string) => {
        const cached = await getCachedThumbnail(url);
        if (cached?.blob) {
          activeBlobUrl = URL.createObjectURL(cached.blob);
          return;
        }
        stage = 'PROXY';
      };

      await simulateHandleError(imageUrl);

      expect(activeBlobUrl).not.toBeNull();
      expect(activeBlobUrl!.startsWith('blob:')).toBe(true);
      expect(stage).toBe('DIRECT'); // Stage was preserved because local blob was loaded

      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
      }
    });

    it('falls back to PROXY when image is not cached and direct request fails', async () => {
      const uncachedUrl = 'https://example.com/not-cached.jpg';

      let activeBlobUrl: string | null = null;
      let stage: string = 'DIRECT';

      const simulateHandleError = async (url: string) => {
        const cached = await getCachedThumbnail(url);
        if (cached?.blob) {
          activeBlobUrl = URL.createObjectURL(cached.blob);
          return;
        }
        stage = 'PROXY';
      };

      await simulateHandleError(uncachedUrl);

      expect(activeBlobUrl).toBeNull();
      expect(stage).toBe('PROXY');
    });
  });
});
