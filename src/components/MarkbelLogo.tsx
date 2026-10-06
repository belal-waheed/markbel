import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export default function MarkbelLogo({ className = '', size = 48 }: LogoProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none pointer-events-none shrink-0 ${className}`}
        aria-label="Markbel Logo"
      >
        <rect width="100" height="100" rx="22" fill="#005fb8" />
        <path
          d="M32 20H68V78L50 64L32 78V20Z"
          fill="#ffffff"
        />
      </svg>
    );
  }

  return (
    <img 
      src="/logo.png" 
      alt="Markbel Logo" 
      width={size} 
      height={size} 
      draggable={false}
      onError={() => setHasError(true)}
      className={`select-none pointer-events-none object-contain shrink-0 ${className}`}
    />
  );
}
