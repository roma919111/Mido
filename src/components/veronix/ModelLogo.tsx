"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { CatalogModel } from "@/lib/model-catalog";
import { modelLogoSrc, modelProviderKey } from "@/lib/model-logos";
import { MiniMaxWaveIcon } from "@/components/veronix/MiniMaxWaveIcon";

type ModelLogoProps = {
  model: Pick<CatalogModel, "id" | "name" | "mcpId">;
  size?: number;
  className?: string;
};

export function ModelLogo({ model, size = 22, className = "" }: ModelLogoProps) {
  const [failed, setFailed] = useState(false);
  const src = modelLogoSrc(model);

  if (modelProviderKey(model) === "minimax") {
    return <MiniMaxWaveIcon size={size} className={className} />;
  }

  if (failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#22f0ff] ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Sparkles className="h-[55%] w-[55%]" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-lg bg-white/5 object-contain p-0.5 ${className}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
