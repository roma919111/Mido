interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASS = {
  sm: "text-lg sm:text-xl",
  md: "text-xl sm:text-2xl",
  lg: "text-3xl sm:text-4xl",
  xl: "text-4xl sm:text-5xl",
} as const;

const BADGE_SIZE = {
  sm: "ml-1 px-1.5 py-0.5 text-[0.55em]",
  md: "ml-1.5 px-1.5 py-0.5 text-[0.55em]",
  lg: "ml-2 px-2 py-0.5 text-[0.5em]",
  xl: "ml-2 px-2.5 py-1 text-[0.48em]",
} as const;

export function BrandLogo({ size = "md", className = "" }: BrandLogoProps) {
  return (
    <span
      className={`inline-flex items-center font-[family-name:var(--font-display)] tracking-tight ${SIZE_CLASS[size]} ${className}`}
    >
      <span className="text-white">VYRONIX</span>
      <span className={`ai-badge ${BADGE_SIZE[size]}`}>.AI</span>
    </span>
  );
}
