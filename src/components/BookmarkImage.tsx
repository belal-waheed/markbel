import React, { useState, useEffect, useRef } from "react";
import { Link as LinkIcon, ImageOff } from "lucide-react";
import { resolveApiUrl } from "@/lib/api";

export type ImageStage = "DIRECT" | "PROXY" | "FAVICON" | "PLACEHOLDER";

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
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "PLACEHOLDER";
  }
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
  const [stage, setStage] = useState<ImageStage>(() => getInitialStage(src, fallbackSrc));
  const [isLoaded, setIsLoaded] = useState(false);

  // Sync state whenever src or fallbackSrc props change
  useEffect(() => {
    const nextStage = getInitialStage(src, fallbackSrc);
    setStage(nextStage);
    setIsLoaded(false);
  }, [src, fallbackSrc]);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [stage]);

  const trimmedSrc = src?.trim();
  const trimmedFallback = fallbackSrc?.trim();

  let currentSrc: string | null = null;
  if (stage === "DIRECT") {
    currentSrc = trimmedSrc || null;
  } else if (stage === "PROXY") {
    if (trimmedSrc) {
      currentSrc = proxyBaseUrl
        ? `${proxyBaseUrl.replace(/\/$/, "")}/api/proxy/image?url=${encodeURIComponent(trimmedSrc)}`
        : resolveApiUrl(`/api/proxy/image?url=${encodeURIComponent(trimmedSrc)}`);
    }
  } else if (stage === "FAVICON") {
    currentSrc = trimmedFallback || null;
  }

  const handleError = () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStage("PLACEHOLDER");
      return;
    }

    setIsLoaded(false);
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
    stage === "FAVICON" ||
    Boolean(
      currentSrc &&
        (currentSrc.includes("google.com/s2/favicons") ||
          currentSrc.includes("favicon") ||
          currentSrc.endsWith(".ico") ||
          currentSrc.endsWith(".svg"))
    );

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

      {/* Render Image for DIRECT, PROXY, FAVICON */}
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
            onLoad={() => setIsLoaded(true)}
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
