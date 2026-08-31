import React, { useState } from "react";
import { Link as LinkIcon, ImageOff } from "lucide-react";

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

  const trimmedSrc = src?.trim();
  const isFavicon = Boolean(
    trimmedSrc &&
      (trimmedSrc.includes("google.com/s2/favicons") ||
        trimmedSrc.includes("favicon") ||
        trimmedSrc.endsWith(".ico") ||
        trimmedSrc.endsWith(".svg"))
  );

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
      {trimmedSrc && !hasError && (
        isFavicon ? (
          <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 p-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-xs flex items-center justify-center p-2">
              <img
                src={trimmedSrc}
                alt={alt || "Favicon"}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onLoad={() => setIsLoaded(true)}
                onError={() => setHasError(true)}
                className={`w-7 h-7 object-contain transition-opacity duration-300 ${
                  isLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          </div>
        ) : (
          <img
            src={trimmedSrc}
            alt={alt || "Bookmark thumbnail"}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
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
