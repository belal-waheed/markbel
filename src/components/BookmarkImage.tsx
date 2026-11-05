import React, { useState, useEffect, useRef } from "react";
import { Link as LinkIcon, ImageOff } from "lucide-react";
import { resolveApiUrl } from "@/lib/api";
import { upgradeInsecureImageUrl, isLowQualityImage, isVideoStreamUrl } from "@/lib/mediaHeuristics";
import { isSafeFaviconUrl } from "@/lib/urlSafety";
import { getCachedThumbnail, saveCachedThumbnail } from "@/db/db";

export type ImageStage = "DIRECT" | "PROXY" | "FAVICON" | "PLACEHOLDER";

export const inFlightCaptures = new Set<string>();
export const failedCaptures = new Set<string>();
export const memoryBlobCache = new Map<string, string>();

export function clearMemoryBlobCache(): void {
  for (const url of memoryBlobCache.values()) {
    if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(url);
    }
  }
  memoryBlobCache.clear();
}

const MAX_CONCURRENT_CAPTURES = 2;
let activeCapturesCount = 0;
const captureQueue: Array<() => Promise<void>> = [];

function processCaptureQueue() {
  while (activeCapturesCount < MAX_CONCURRENT_CAPTURES && captureQueue.length > 0) {
    const task = captureQueue.shift();
    if (task) {
      activeCapturesCount++;
      task().finally(() => {
        activeCapturesCount--;
        processCaptureQueue();
      });
    }
  }
}

/**
 * Queues thumbnail capture to execute during idle time with max 2 concurrent downloads.
 */
export function scheduleCaptureAndCache(url: string, proxyBaseUrl?: string): void {
  if (
    !url ||
    inFlightCaptures.has(url) ||
    failedCaptures.has(url) ||
    isLowQualityImage(url) ||
    isVideoStreamUrl(url)
  ) return;

  const run = () => {
    captureQueue.push(async () => {
      await captureAndCacheThumbnail(url, proxyBaseUrl);
    });
    processCaptureQueue();
  };

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    (window as any).requestIdleCallback(run, { timeout: 1000 });
  } else {
    setTimeout(run, 250);
  }
}

/**
 * Creates an AbortSignal with timeout, falling back to setTimeout for environments lacking AbortSignal.timeout
 */
export function createTimeoutSignal(ms: number): { signal: AbortSignal; cleanup: () => void } {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(ms), cleanup: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    try {
      controller.abort(new DOMException("TimeoutError", "TimeoutError"));
    } catch {
      controller.abort();
    }
  }, ms);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

/**
 * Attempts to capture a remote image thumbnail as a Blob and persist it in Dexie.
 * Checks CORS direct fetch only for same-origin URLs, routing cross-origin captures
 * directly to the proxy to avoid browser console CORS errors.
 * Records failed captures to prevent retry storms.
 * Protected with explicit 6000ms timeout on both direct and proxy fetches.
 */
export async function captureAndCacheThumbnail(
  url: string,
  proxyBaseUrl?: string
): Promise<void> {
  if (
    !url ||
    inFlightCaptures.has(url) ||
    failedCaptures.has(url) ||
    isLowQualityImage(url) ||
    isVideoStreamUrl(url)
  ) return;
  inFlightCaptures.add(url);

  try {
    const existing = await getCachedThumbnail(url);
    if (existing) return;

    let blob: Blob | null = null;
    let contentType = "image/jpeg";

    const isSameOrigin =
      url.startsWith('/') ||
      url.startsWith('blob:') ||
      url.startsWith('data:') ||
      (typeof window !== 'undefined' && Boolean(window.location?.origin) && url.startsWith(window.location.origin));

    // 1. Direct fetch with CORS mode ONLY if same-origin (to prevent browser console CORS errors)
    if (isSameOrigin) {
      const directTimeout = createTimeoutSignal(6000);
      try {
        const res = await fetch(url, { mode: "cors", signal: directTimeout.signal });
        if (res.ok) {
          const candidate = await res.blob();
          if (candidate && candidate.size > 0) {
            blob = candidate;
            contentType = res.headers.get("content-type") || candidate.type || "image/jpeg";
          }
        }
      } catch {
        // Direct CORS fetch failed, timed out, or blocked
      } finally {
        directTimeout.cleanup();
      }
    }

    // 2. Fall back to proxy if direct fetch skipped (cross-origin) or failed
    if (!blob || blob.size === 0) {
      const proxyUrl = proxyBaseUrl
        ? `${proxyBaseUrl.replace(/\/$/, "")}/api/proxy/image?url=${encodeURIComponent(url)}`
        : resolveApiUrl(`/api/proxy/image?url=${encodeURIComponent(url)}`);

      const proxyTimeout = createTimeoutSignal(6000);
      try {
        const proxyRes = await fetch(proxyUrl, { signal: proxyTimeout.signal });
        if (proxyRes.ok) {
          const candidate = await proxyRes.blob();
          if (candidate && candidate.size > 0) {
            blob = candidate;
            contentType = proxyRes.headers.get("content-type") || candidate.type || "image/jpeg";
          }
        }
      } catch {
        // Proxy fetch failed or timed out
      } finally {
        proxyTimeout.cleanup();
      }
    }

    // 3. Persist valid blob to Dexie only if non-empty, otherwise record failed capture
    if (blob && blob.size > 0) {
      await saveCachedThumbnail(url, blob, contentType);
    } else {
      failedCaptures.add(url);
    }
  } catch (err) {
    failedCaptures.add(url);
    console.error("Failed to capture and cache thumbnail:", err);
  } finally {
    inFlightCaptures.delete(url);
  }
}

export function isExpiredSocialCdnUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.endsWith(".cdninstagram.com") || u.hostname.endsWith(".fbcdn.net")) {
      const oe = u.searchParams.get("oe");
      if (oe && /^[0-9a-fA-F]{8}$/.test(oe)) {
        return parseInt(oe, 16) * 1000 < Date.now();
      }
    }
    return false;
  } catch {
    return false;
  }
}

export interface BookmarkImageProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  aspectRatioClass?: string;
  proxyBaseUrl?: string;
}

export function getInitialStage(src?: string | null, fallbackSrc?: string | null): ImageStage {
  const trimmed = src?.trim();
  const trimmedFallback = fallbackSrc?.trim();
  const safeFallback = trimmedFallback && isSafeFaviconUrl(trimmedFallback) ? trimmedFallback : undefined;
  if (
    !trimmed ||
    isExpiredSocialCdnUrl(trimmed) ||
    isLowQualityImage(trimmed) ||
    isVideoStreamUrl(trimmed)
  ) {
    return safeFallback ? "FAVICON" : "PLACEHOLDER";
  }
  return "DIRECT";
}

export const BookmarkImage: React.FC<BookmarkImageProps> = ({
  src,
  fallbackSrc,
  alt,
  className = "",
  aspectRatioClass = "aspect-video",
  proxyBaseUrl,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const trimmedSrc = src?.trim();
  const trimmedFallback = fallbackSrc?.trim();
  const secureSrc = upgradeInsecureImageUrl(trimmedSrc) || trimmedSrc;
  const secureFallback = upgradeInsecureImageUrl(trimmedFallback) || trimmedFallback;
  const cleanUrl = secureSrc || trimmedSrc;

  const [blobUrl, setBlobUrl] = useState<string | null>(() => {
    if (cleanUrl && memoryBlobCache.has(cleanUrl)) {
      return memoryBlobCache.get(cleanUrl) || null;
    }
    return null;
  });
  const [stage, setStage] = useState<ImageStage>(() => getInitialStage(src, fallbackSrc));
  const [isLoaded, setIsLoaded] = useState(() => Boolean(cleanUrl && memoryBlobCache.has(cleanUrl)));

  const setAndTrackBlobUrl = (newUrl: string | null) => {
    if (blobUrlRef.current && blobUrlRef.current !== newUrl) {
      // Do not revoke if the old URL is retained in the memory cache
      let isInCache = false;
      for (const cached of memoryBlobCache.values()) {
        if (cached === blobUrlRef.current) {
          isInCache = true;
          break;
        }
      }
      if (!isInCache && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    }
    blobUrlRef.current = newUrl;
    setBlobUrl(newUrl);
  };

  // Sync state whenever src or fallbackSrc props change
  useEffect(() => {
    const nextStage = getInitialStage(src, fallbackSrc);
    setStage(nextStage);
    if (!cleanUrl || !memoryBlobCache.has(cleanUrl)) {
      setIsLoaded(false);
    }
  }, [src, fallbackSrc]);

  // Dexie blob cache lookup on mount or when cleanUrl changes
  useEffect(() => {
    let isCancelled = false;

    if (cleanUrl) {
      if (memoryBlobCache.has(cleanUrl)) {
        setAndTrackBlobUrl(memoryBlobCache.get(cleanUrl)!);
        setIsLoaded(true);
        return;
      }

      getCachedThumbnail(cleanUrl)
        .then((cached) => {
          if (isCancelled) return;
          if (cached?.blob && cached.blob.size > 0 && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
            const objectUrl = URL.createObjectURL(cached.blob);
            if (memoryBlobCache.size > 500) {
              const oldestKey = memoryBlobCache.keys().next().value;
              if (oldestKey) {
                const oldUrl = memoryBlobCache.get(oldestKey);
                memoryBlobCache.delete(oldestKey);
                if (oldUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
                  URL.revokeObjectURL(oldUrl);
                }
              }
            }
            memoryBlobCache.set(cleanUrl, objectUrl);
            setAndTrackBlobUrl(objectUrl);
            setIsLoaded(true);
          } else {
            setAndTrackBlobUrl(null);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setAndTrackBlobUrl(null);
          }
        });
    } else {
      setAndTrackBlobUrl(null);
    }

    return () => {
      isCancelled = true;
    };
  }, [cleanUrl]);

  // Clean up any remaining object URL on component unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        blobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [stage, blobUrl]);

  let currentSrc: string | null = null;
  if (blobUrl) {
    currentSrc = blobUrl;
  } else if (stage === "DIRECT") {
    currentSrc = secureSrc || null;
  } else if (stage === "PROXY") {
    if (trimmedSrc) {
      currentSrc = proxyBaseUrl
        ? `${proxyBaseUrl.replace(/\/$/, "")}/api/proxy/image?url=${encodeURIComponent(trimmedSrc)}`
        : resolveApiUrl(`/api/proxy/image?url=${encodeURIComponent(trimmedSrc)}`);
    }
  } else if (stage === "FAVICON") {
    currentSrc = secureFallback || null;
  }

  const handleLoad = () => {
    setIsLoaded(true);
    // When an image loads successfully in DIRECT or PROXY stage and is not already a blobUrl,
    // defer background caching to requestIdleCallback / setTimeout(250) with bounded concurrency
    if (!blobUrl && cleanUrl && (stage === "DIRECT" || stage === "PROXY")) {
      scheduleCaptureAndCache(cleanUrl, proxyBaseUrl);
    }
  };

  const handleError = async () => {
    setIsLoaded(false);

    if (cleanUrl && memoryBlobCache.has(cleanUrl)) {
      const staleUrl = memoryBlobCache.get(cleanUrl);
      memoryBlobCache.delete(cleanUrl);
      if (staleUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(staleUrl);
      }
    }

    // If active blobUrl failed (e.g. corrupt blob), revoke and clear it
    if (blobUrlRef.current) {
      setAndTrackBlobUrl(null);
    }

    // Check if Dexie has a cached blob before proceeding with fallback stages
    if (cleanUrl && !blobUrlRef.current) {
      try {
        const cached = await getCachedThumbnail(cleanUrl);
        if (cached?.blob && cached.blob.size > 0 && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
          const objectUrl = URL.createObjectURL(cached.blob);
          setAndTrackBlobUrl(objectUrl);
          setIsLoaded(true);
          return;
        }
      } catch {
        // Fall through to stage advancement
      }
    }

    if (stage === "DIRECT") {
      if (trimmedSrc && !isLowQualityImage(trimmedSrc) && !isVideoStreamUrl(trimmedSrc)) {
        setStage("PROXY");
      } else if (trimmedFallback && isSafeFaviconUrl(trimmedFallback)) {
        setStage("FAVICON");
      } else {
        setStage("PLACEHOLDER");
      }
    } else if (stage === "PROXY") {
      if (trimmedFallback && isSafeFaviconUrl(trimmedFallback) && trimmedFallback !== trimmedSrc) {
        setStage("FAVICON");
      } else {
        setStage("PLACEHOLDER");
      }
    } else {
      setStage("PLACEHOLDER");
    }
  };

  const isFavicon =
    !blobUrl &&
    (stage === "FAVICON" ||
      Boolean(currentSrc && isLowQualityImage(currentSrc)));

  return (
    <div
      className={`relative w-full overflow-hidden bg-[var(--color-bg-element)] select-none flex items-center justify-center ${aspectRatioClass} ${className}`}
    >
      {/* Background Icon Placeholder / Skeleton */}
      <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] opacity-25">
        {stage === "PLACEHOLDER" ? (
          <ImageOff className="w-7 h-7 text-[var(--color-text-muted)] opacity-50" />
        ) : (
          <LinkIcon className="w-8 h-8" />
        )}
      </div>

      {/* Render Image for DIRECT, PROXY, FAVICON, or cached blob */}
      {currentSrc && stage !== "PLACEHOLDER" && (
        isFavicon ? (
          <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 p-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-xs flex items-center justify-center p-2">
              <img
                ref={imgRef}
                src={currentSrc}
                alt={alt || "Favicon"}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={() => setIsLoaded(true)}
                onError={handleError}
                className={`w-7 h-7 object-contain transition-opacity duration-300 ${
                  isLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          </div>
        ) : (
          <img
            ref={imgRef}
            src={currentSrc}
            alt={alt || "Bookmark thumbnail"}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={handleLoad}
            onError={handleError}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        )
      )}
    </div>
  );
};

export default BookmarkImage;
