"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { CatalogModel } from "@/lib/model-catalog";
import { modelLogoSrc, modelProviderKey } from "@/lib/model-logos";

type ModelLogoProps = {
  model: Pick<CatalogModel, "id" | "name" | "mcpId">;
  /** Outer square size in px — every logo uses the same frame. */
  size?: number;
  className?: string;
};

export function ModelLogo({ model, size = 28, className = "" }: ModelLogoProps) {
  const [failed, setFailed] = useState(false);
  const src = modelLogoSrc(model);
  const provider = modelProviderKey(model);
  const inner = Math.round(size * (provider === "vyronix" ? 1 : 0.72));
  const frameClass =
    provider === "seedance" || provider === "flux"
      ? "bg-white ring-white/25"
      : provider === "vyronix"
        ? "bg-transparent ring-white/15"
        : provider === "minimax"
          ? "bg-black ring-white/20"
          : "bg-[#141821] ring-white/10";
  const imgClass =
    provider === "vyronix"
      ? "h-full w-full object-contain p-0.5"
      : "object-contain";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[0.55rem] ring-1 ${frameClass} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {failed ? (
        <Sparkles style={{ width: inner, height: inner }} className="text-[#22f0ff]" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={inner}
          height={inner}
          loading="lazy"
          decoding="async"
          className={imgClass}
          style={provider === "vyronix" ? undefined : { width: inner, height: inner }}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
