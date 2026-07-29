interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE = {
  sm: { text: "text-base", badge: "text-[0.65rem] px-1.5 py-0.5" },
  md: { text: "text-lg", badge: "text-xs px-1.5 py-0.5" },
  lg: { text: "text-3xl sm:text-4xl", badge: "text-sm px-2 py-1" },
} as const;

export function BrandLogo({ size = "md", className = "" }: BrandLogoProps) {
  const s = SIZE[size];
  return (
    <span className={`inline-flex items-center gap-1.5 font-display font-extrabold tracking-tight ${className}`}>
      <span className={`${s.text} text-white`}>Veronix</span>
      <span className={`neon-ai-badge ${s.badge}`}>.ai</span>
    </span>
  );
}
