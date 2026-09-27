import { normalizeCharacterName } from "@/lib/character-names";
import type { LinkedCharacterRef } from "@/hooks/useLinkedCharacters";

type Props = {
  linkedCharacters: LinkedCharacterRef[];
  showHint?: boolean;
  hint?: string;
  title?: string;
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
        {title ? (
          <p className="mb-1.5 text-sm font-bold text-[#22f0ff]">{title}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          {linkedCharacters.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full border border-[#22f0ff]/35 bg-black/25 px-2.5 py-1 text-[12px] font-semibold text-white"
            >
              <img
                src={imageSrc(item.url) || item.url}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
              />
              {normalizeCharacterName(item.label)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (showHint && hint) {
    return (
      <p className="mb-2 text-[11px] leading-relaxed text-white/35" dir={dir}>
        {hint}
      </p>
    );
  }

  return null;
}
