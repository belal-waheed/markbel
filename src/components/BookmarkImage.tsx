import React, { useState, useEffect, useRef } from "react";
import { Link as LinkIcon, ImageOff } from "lucide-react";
import { resolveApiUrl } from "@/lib/api";
import { upgradeInsecureImageUrl } from "@/lib/mediaHeuristics";
import { getCachedThumbnail, saveCachedThumbnail } from "@/db/db";

export type ImageStage = "DIRECT" | "PROXY" | "FAVICON" | "PLACEHOLDER";

const inFlightCaptures = new Set<string>();

/**
 * Attempts to capture a remote image thumbnail as a Blob and persist it in Dexie.
 * Checks CORS direct fetch first, then falls back to image proxy before failing gracefully.
 */
export async function captureAndCacheThumbnail(
  url: string,
  proxyBaseUrl?: string
): Promise<void> {
  if (!url || inFlightCaptures.has(url)) return;
  inFlightCaptures.add(url);

  try {
    const existing = await getCachedThumbnail(url);
    if (existing) return;

    let blob: Blob | null = null;
    let contentType = "image/jpeg";

    // 1. Direct fetch with CORS mode
    try {
      const res = await fetch(url, { mode: "cors" });
      if (res.ok) {
        blob = await res.blob();
        contentType = res.headers.get("content-type") || blob.type || "image/jpeg";
      }
    } catch {
      // Direct CORS fetch failed or blocked
    }

    // 2. Fall back to proxy if direct fetch failed, returned non-200, or empty blob
    if (!blob || blob.size === 0) {
      const proxyUrl = proxyBaseUrl
        ? `${proxyBaseUrl.replace(/\/$/, "")}/api/proxy/image?url=${encodeURIComponent(url)}`
        : resolveApiUrl(`/api/proxy/image?url=${encodeURIComponent(url)}`);

      try {
        const proxyRes = await fetch(proxyUrl);
        if (proxyRes.ok) {
          blob = await proxyRes.blob();
          contentType = proxyRes.headers.get("content-type") || blob.type || "image/jpeg";
        }
      } catch {
        // Proxy fetch failed
      }
    }

    // 3. Persist valid blob to Dexie
    if (blob && blob.size > 0) {
      await saveCachedThumbnail(url, blob, contentType);
    }
  } catch (err) {
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
  if (!trimmed || isExpiredSocialCdnUrl(trimmed)) {
    return trimmedFallback ? "FAVICON" : "PLACEHOLDER";
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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<ImageStage>(() => getInitialStage(src, fallbackSrc));
  const [isLoaded, setIsLoaded] = useState(false);

  const trimmedSrc = src?.trim();
  const trimmedFallback = fallbackSrc?.trim();
  const secureSrc = upgradeInsecureImageUrl(trimmedSrc) || trimmedSrc;
  const secureFallback = upgradeInsecureImageUrl(trimmedFallback) || trimmedFallback;
  const cleanUrl = secureSrc || trimmedSrc;

  const setAndTrackBlobUrl = (newUrl: string | null) => {
    if (blobUrlRef.current && blobUrlRef.current !== newUrl) {
      if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
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
    setIsLoaded(false);
  }, [src, fallbackSrc]);

  // Dexie blob cache lookup on mount or when cleanUrl changes
  useEffect(() => {
    let isCancelled = false;

    if (cleanUrl) {
      getCachedThumbnail(cleanUrl)
        .then((cached) => {
          if (isCancelled) return;
          if (cached?.blob && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
            const objectUrl = URL.createObjectURL(cached.blob);
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
      setAndTrackBlobUrl(null);
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
    // persist it to Dexie blob cache in the background
    if (!blobUrl && cleanUrl && (stage === "DIRECT" || stage === "PROXY")) {
      captureAndCacheThumbnail(cleanUrl, proxyBaseUrl);
    }
  };

  const handleError = async () => {
    setIsLoaded(false);

    // If active blobUrl failed (e.g. corrupt blob), revoke and clear it
    if (blobUrlRef.current) {
      setAndTrackBlobUrl(null);
    }

    // Check if Dexie has a cached blob before proceeding with fallback stages
    if (cleanUrl && !blobUrlRef.current) {
      try {
        const cached = await getCachedThumbnail(cleanUrl);
        if (cached?.blob && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
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
      if (trimmedSrc) {
        setStage("PROXY");
      } else if (trimmedFallback) {
        setStage("FAVICON");
      } else {
        setStage("PLACEHOLDER");
      }
    } else if (stage === "PROXY") {
      if (trimmedFallback && trimmedFallback !== trimmedSrc) {
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
      Boolean(
        currentSrc &&
          (currentSrc.includes("google.com/s2/favicons") ||
            currentSrc.includes("favicon") ||
            currentSrc.endsWith(".ico") ||
            currentSrc.endsWith(".svg"))
      ));

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
