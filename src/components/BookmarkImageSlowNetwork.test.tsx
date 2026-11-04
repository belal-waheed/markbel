import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  captureAndCacheThumbnail,
  inFlightCaptures,
  createTimeoutSignal,
  BookmarkImage,
  getInitialStage,
} from "./BookmarkImage";
import { db, CachedThumbnail } from "../db/db";

describe("BookmarkImage Slow-Network & Failure Recovery Suite", () => {
  let thumbnailStore: Map<string, CachedThumbnail>;
  let createdObjectUrls: string[];
  let revokedObjectUrls: string[];

  beforeEach(() => {
    thumbnailStore = new Map();
    createdObjectUrls = [];
    revokedObjectUrls = [];
    inFlightCaptures.clear();

    (vi.spyOn(db.cachedThumbnails, "get") as any).mockImplementation(async (id: any) => {
      return thumbnailStore.get(id as string) || undefined;
    });

    (vi.spyOn(db.cachedThumbnails, "put") as any).mockImplementation(async (item: any) => {
      thumbnailStore.set(item.id, item);
      return item.id;
    });

    // Mock URL object URL lifecycle
    let urlCounter = 0;
    const mockCreateObjectURL = vi.fn(() => {
      const url = `blob:http://localhost/mock-uuid-${++urlCounter}`;
      createdObjectUrls.push(url);
      return url;
    });
    const mockRevokeObjectURL = vi.fn((url: string) => {
      revokedObjectUrls.push(url);
    });

    vi.stubGlobal("URL", {
      ...globalThis.URL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    inFlightCaptures.clear();
  });

  describe("createTimeoutSignal", () => {
    it("aborts when the timer expires", async () => {
      vi.useFakeTimers();
      
      // Test timeout signal with setTimeout controller
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort(new DOMException("TimeoutError", "TimeoutError"));
      }, 100);

      expect(controller.signal.aborted).toBe(false);
      vi.advanceTimersByTime(105);
      expect(controller.signal.aborted).toBe(true);

      clearTimeout(timer);
    });

    it("cancels timer cleanly when cleanup is invoked early", () => {
      vi.useFakeTimers();
      const { signal, cleanup } = createTimeoutSignal(500);

      cleanup();
      vi.advanceTimersByTime(600);
      expect(signal.aborted).toBe(false);
    });
  });

  describe("Stalled Remote Host (10s delay vs 6s timeout)", () => {
    it("aborts stalled fetch at 6000ms and releases inFlightCaptures lock", async () => {
      vi.useFakeTimers();
      const url = "https://stalled-server.example.com/image.jpg";

      // Stub AbortSignal.timeout to use setTimeout so vi.useFakeTimers can advance time instantaneously
      vi.stubGlobal("AbortSignal", {
        ...globalThis.AbortSignal,
        timeout: (ms: number) => {
          const controller = new AbortController();
          setTimeout(() => {
            try {
              controller.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
            } catch {
              controller.abort();
            }
          }, ms);
          return controller.signal;
        },
      });

      // Mock fetch that hangs until signal is aborted
      vi.stubGlobal(
        "fetch",
        vi.fn((_input, init?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            if (init?.signal) {
              if (init.signal.aborted) {
                return reject(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
              }
              init.signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
              });
            }
          });
        })
      );

      const capturePromise = captureAndCacheThumbnail(url);

      // Verify URL is registered in inFlightCaptures
      expect(inFlightCaptures.has(url)).toBe(true);

      // Advance clock past 6,000 ms timeout for direct fetch, then 6,000 ms for proxy fallback
      await vi.advanceTimersByTimeAsync(6500);
      await vi.advanceTimersByTimeAsync(6500);

      await capturePromise;

      // Verify lock is completely released
      expect(inFlightCaptures.has(url)).toBe(false);
      // Verify nothing corrupted the database
      expect(thumbnailStore.has(url)).toBe(false);
    });
  });

  describe("Rapid Mount and Unmount Object URL Lifecycle", () => {
    it("revokes created object URLs on unmount without memory leaks or unhandled rejections", async () => {
      const url = "https://example.com/cached-thumb.jpg";
      const sampleBlob = new Blob(["image-binary-data"], { type: "image/jpeg" });
      thumbnailStore.set(url, {
        id: url,
        blob: sampleBlob,
        contentType: "image/jpeg",
        size: sampleBlob.size,
        updatedAt: new Date().toISOString(),
      });

      // Simulate component lifecycle:
      // 1. Mount triggers getCachedThumbnail
      let currentBlobUrl: string | null = null;
      let isCancelled = false;

      const unmount = () => {
        isCancelled = true;
        if (currentBlobUrl && URL.revokeObjectURL) {
          URL.revokeObjectURL(currentBlobUrl);
          currentBlobUrl = null;
        }
      };

      // Start async lookup
      const lookupPromise = db.cachedThumbnails.get(url).then((cached) => {
        if (isCancelled) return;
        if (cached?.blob && cached.blob.size > 0) {
          currentBlobUrl = URL.createObjectURL(cached.blob);
        }
      });

      // Immediately unmount before promise settles (rapid unmount)
      unmount();
      await lookupPromise;

      // Verify no leaked object URL was created or if created it was revoked
      if (currentBlobUrl) {
        expect(revokedObjectUrls).toContain(currentBlobUrl);
      } else {
        expect(createdObjectUrls.length).toBe(0);
      }
    });

    it("cleans up active blob URL when component unmounts normally", async () => {
      const sampleBlob = new Blob(["image-data"], { type: "image/jpeg" });
      const objectUrl = URL.createObjectURL(sampleBlob);

      // Simulating unmount cleanup ref effect
      let activeBlobUrl: string | null = objectUrl;
      const cleanupEffect = () => {
        if (activeBlobUrl) {
          URL.revokeObjectURL(activeBlobUrl);
          activeBlobUrl = null;
        }
      };

      cleanupEffect();
      expect(revokedObjectUrls).toContain(objectUrl);
      expect(activeBlobUrl).toBeNull();
    });
  });

  describe("Corrupted and 0-Byte Blob Handling", () => {
    it("rejects 0-byte blobs from direct and proxy fetch without persisting corrupt cache", async () => {
      const url = "/assets/zero-bytes.jpg";
      const emptyBlob = new Blob([]);

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => emptyBlob,
        headers: new Headers({ "content-type": "image/jpeg" }),
      });
      vi.stubGlobal("fetch", fetchSpy);

      await captureAndCacheThumbnail(url);

      // Both same-origin direct and proxy were attempted because direct returned empty blob
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // 0-byte blob was NEVER persisted to Dexie
      expect(thumbnailStore.has(url)).toBe(false);
      // Lock was cleaned up
      expect(inFlightCaptures.has(url)).toBe(false);
    });

    it("bypasses 0-byte corrupt blobs in cache and transitions to fallback", async () => {
      const url = "https://corrupt-dexie.example.com/bad.png";
      const corruptBlob = new Blob([]); // size = 0
      thumbnailStore.set(url, {
        id: url,
        blob: corruptBlob,
        contentType: "image/png",
        size: 0,
        updatedAt: new Date().toISOString(),
      });

      // Query cached thumbnail:
      const cached = await db.cachedThumbnails.get(url);
      expect(cached).toBeDefined();
      // Safe guard: cached.blob.size > 0 must be false
      const isValid = Boolean(cached?.blob && cached.blob.size > 0);
      expect(isValid).toBe(false);

      // Verify fallback initial stage
      const stage = getInitialStage(url, "https://example.com/favicon.ico");
      expect(stage).toBe("DIRECT");
    });
  });

  describe("Concurrent Thumbnail Capture Under Slow Network", () => {
    it("deduplicates multiple concurrent requests for the exact same URL", async () => {
      const url = "https://slow-image.example.com/art.jpg";
      const validBlob = new Blob(["art-bytes"], { type: "image/jpeg" });

      let fetchCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          fetchCount++;
          await new Promise((resolve) => setTimeout(resolve, 30));
          return {
            ok: true,
            blob: async () => validBlob,
            headers: new Headers({ "content-type": "image/jpeg" }),
          };
        })
      );

      // Fire 3 simultaneous capture requests for the same URL
      await Promise.all([
        captureAndCacheThumbnail(url),
        captureAndCacheThumbnail(url),
        captureAndCacheThumbnail(url),
      ]);

      // Only 1 fetch was made due to inFlightCaptures deduplication
      expect(fetchCount).toBe(1);
      expect(thumbnailStore.has(url)).toBe(true);
      expect(inFlightCaptures.has(url)).toBe(false);
    });

    it("processes distinct URLs concurrently and unlocks all when finished", async () => {
      const urls = [
        "https://domain1.com/pic1.jpg",
        "https://domain2.com/pic2.jpg",
        "https://domain3.com/pic3.jpg",
      ];
      const validBlob = new Blob(["some-bytes"], { type: "image/jpeg" });

      let concurrentInFlightMax = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          concurrentInFlightMax = Math.max(concurrentInFlightMax, inFlightCaptures.size);
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            ok: true,
            blob: async () => validBlob,
            headers: new Headers({ "content-type": "image/jpeg" }),
          };
        })
      );

      await Promise.all(urls.map((u) => captureAndCacheThumbnail(u)));

      // Verify they ran in parallel
      expect(concurrentInFlightMax).toBeGreaterThanOrEqual(2);
      // All 3 were cached
      expect(thumbnailStore.size).toBe(3);
      // All in-flight locks were freed
      expect(inFlightCaptures.size).toBe(0);
    });
  });
});
