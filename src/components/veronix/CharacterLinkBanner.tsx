"use client";

import { normalizeCharacterName } from "@/lib/character-names";
import type { VisualReference } from "@/lib/types";

type Props = {
  linkedCharacters: VisualReference[];
  showHint: boolean;
  hint: string;
  title: string;
  dir?: "rtl" | "ltr";
  imageSrc?: (url: string) => string;
};

export function CharacterLinkBanner({
  linkedCharacters,
  showHint,
  hint,
  title,
  dir,
  imageSrc = (url) => url,
}: Props) {
  if (linkedCharacters.length > 0) {
    return (
      <div
        className="mb-3 rounded-xl border border-[#22f0ff]/45 bg-[#22f0ff]/12 px-3 py-2.5"
        dir={dir}
      >
        <p className="mb-1.5 text-sm font-bold text-[#22f0ff]">{title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {linkedCharacters.map((ref) => (
            <span
              key={ref.id}
              className="inline-flex items-center gap-1 rounded-full border border-[#22f0ff]/35 bg-black/25 px-2.5 py-1 text-[12px] font-semibold text-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc(ref.url) || ref.url}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
              />
              {normalizeCharacterName(ref.label)}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (!showHint) return null;
  return (
    <p className="mb-2 text-[11px] leading-relaxed text-white/35" dir={dir}>
      {hint}
    </p>
  );
}
