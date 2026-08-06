/** Inline MiniMax waveform icon — no wordmark, no external asset dependency. */
export function MiniMaxWaveIcon({
  size = 22,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="#fff" />
      <defs>
        <linearGradient id="minimax-wave-inline" x1="4" y1="16" x2="28" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E91E8C" />
          <stop offset="0.55" stopColor="#FF5E62" />
          <stop offset="1" stopColor="#FFB347" />
        </linearGradient>
      </defs>
      <path
        d="M5 19c1.6-5 2.8-7 4.2-7s2.4 2 4.2 7 2.8 7 4.2 7 2.6-2 4.2-7"
        stroke="url(#minimax-wave-inline)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
