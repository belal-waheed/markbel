import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Logo: React.FC<LogoProps> = ({ size = 24, className, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="obel-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Coffee Cup */}
      <path
        d="M30 45 C30 45 30 75 50 75 C70 75 70 45 70 45 H30Z"
        fill="url(#obel-logo-gradient)"
        fillOpacity="0.15"
        stroke="url(#obel-logo-gradient)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      
      {/* Handle */}
      <path
        d="M70 52 C78 52 82 58 82 63 C82 68 78 72 70 72"
        stroke="url(#obel-logo-gradient)"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Steam Wisps */}
      <path
        d="M40 35 Q45 25 40 15"
        stroke="url(#obel-logo-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      >
        <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
      </path>
      <path
        d="M50 30 Q55 20 50 10"
        stroke="url(#obel-logo-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M60 35 Q65 25 60 15"
        stroke="url(#obel-logo-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Clock Hands (Subtle inside the cup) */}
      <g stroke="url(#obel-logo-gradient)" strokeWidth="3" strokeLinecap="round" opacity="0.8">
        <circle cx="50" cy="58" r="1.5" fill="currentColor" />
        <line x1="50" y1="58" x2="50" y2="50" />
        <line x1="50" y1="58" x2="58" y2="62" />
      </g>

      {/* Leaf Accents */}
      <path
        d="M25 40 C20 35 15 35 10 40 C15 45 20 45 25 40"
        fill="var(--primary)"
        fillOpacity="0.3"
        stroke="var(--primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
};
