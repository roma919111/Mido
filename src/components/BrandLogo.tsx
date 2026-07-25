interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: {
    word: "text-lg sm:text-xl",
    badge: "text-[0.65rem] px-1.5 py-0.5",
  },
  md: {
    word: "text-xl sm:text-2xl",
    badge: "text-xs px-2 py-0.5",
  },
  lg: {
    word: "text-4xl sm:text-5xl",
    badge: "text-base sm:text-lg px-2.5 py-1",
  },
} as const;

export function BrandLogo({ size = "md", className = "" }: BrandLogoProps) {
  const sizes = sizeClasses[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-[family-name:var(--font-display)] tracking-tight ${className}`}
      aria-label="VYRONIX.AI"
    >
      <span className={`${sizes.word} font-bold text-white`}>VYRONIX</span>
      <span className={`ai-badge ${sizes.badge}`}>.AI</span>
    </span>
  );
}
