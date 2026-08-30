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
  aspectRatioClass = "aspect-[1.4/1]",
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const trimmedSrc = src?.trim();

  return (
    <div
      className={`relative w-full overflow-hidden bg-[var(--color-bg-element)] border-b border-[var(--color-border-default)] select-none ${aspectRatioClass} ${className}`}
    >
      {/* Background Icon Placeholder / Skeleton */}
      <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] opacity-25">
        {hasError ? (
          <ImageOff className="w-7 h-7 text-[var(--color-text-muted)] opacity-50" />
        ) : (
          <LinkIcon className="w-8 h-8" />
        )}
      </div>

      {/* Actual Image with Progressive Fade-in & Async Decoding */}
      {trimmedSrc && !hasError && (
        <img
          src={trimmedSrc}
          alt={alt || "Bookmark thumbnail"}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
};

export default BookmarkImage;
