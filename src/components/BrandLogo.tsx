interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE = {
  sm: {
    text: "text-sm leading-none",
    badge: "text-[0.5rem] px-1 py-0.5",
    icon: 16,
  },
  md: {
    text: "text-base leading-none",
    badge: "text-[0.55rem] px-1.5 py-0.5",
    icon: 20,
  },
  lg: {
    text: "text-2xl leading-none sm:text-3xl",
    badge: "text-[0.65rem] px-1.5 py-0.5",
    icon: 34,
  },
} as const;

const ICON_SRC = "/models/vyronix-icon-128.png?v=7";

export function BrandLogo({ size = "md", className = "" }: BrandLogoProps) {
  const s = SIZE[size];
  return (
    <span
      className={`inline-flex flex-col items-start justify-center gap-1 font-display font-extrabold tracking-tight ${className}`}
      aria-label="Vyronix AI Studio"
    >
      <span className="inline-flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ICON_SRC}
          alt=""
          width={s.icon}
          height={s.icon}
          className="relative z-[1] -me-1 shrink-0 rounded-md object-contain"
          style={{ width: s.icon, height: s.icon }}
          aria-hidden
        />
        <span className={`${s.text} -ms-0.5 text-white`}>yronix</span>
      </span>
      <span className={`neon-ai-badge ${s.badge}`}>AI Studio</span>
    </span>
  );
}
