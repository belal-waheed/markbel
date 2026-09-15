import React, { useState, useEffect } from "react";
import { Link as LinkIcon, ImageOff } from "lucide-react";
import { resolveApiUrl } from "@/lib/api";

interface BookmarkImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  aspectRatioClass?: string;
}

export const BookmarkImage: React.FC<BookmarkImageProps> = ({
  src,
  alt,
  className = "",
  aspectRatioClass = "aspect-video",
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProxyFallback, setIsProxyFallback] = useState(false);

  const trimmedSrc = src?.trim();
  const [activeSrc, setActiveSrc] = useState<string | undefined>(trimmedSrc);

  // Sync state whenever src prop changes
  useEffect(() => {
    setActiveSrc(trimmedSrc);
    setHasError(false);
    setIsLoaded(false);
    setIsProxyFallback(false);
  }, [trimmedSrc]);

  const isFavicon = Boolean(
    activeSrc &&
      (activeSrc.includes("google.com/s2/favicons") ||
        activeSrc.includes("favicon") ||
        activeSrc.endsWith(".ico") ||
        activeSrc.endsWith(".svg"))
  );

  const handleImageError = () => {
    // If the image failed on direct load, try Cloudflare Edge Proxy once
    if (!isProxyFallback && trimmedSrc && (trimmedSrc.startsWith("http://") || trimmedSrc.startsWith("https://"))) {
      setIsProxyFallback(true);
      setActiveSrc(resolveApiUrl(`/api/proxy/image?url=${encodeURIComponent(trimmedSrc)}`));
    } else {
      setHasError(true);
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden bg-[var(--color-bg-element)] select-none flex items-center justify-center ${aspectRatioClass} ${className}`}
    >
      {/* Background Icon Placeholder / Skeleton */}
      <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] opacity-25">
        {hasError ? (
          <ImageOff className="w-7 h-7 text-[var(--color-text-muted)] opacity-50" />
        ) : (
          <LinkIcon className="w-8 h-8" />
        )}
      </div>

      {/* Actual Image */}
      {activeSrc && !hasError && (
        isFavicon ? (
          <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 p-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-xs flex items-center justify-center p-2">
              <img
                src={activeSrc}
                alt={alt || "Favicon"}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={() => setIsLoaded(true)}
                onError={handleImageError}
                className={`w-7 h-7 object-contain transition-opacity duration-300 ${
                  isLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          </div>
        ) : (
          <img
            src={activeSrc}
            alt={alt || "Bookmark thumbnail"}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setIsLoaded(true)}
            onError={handleImageError}
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
