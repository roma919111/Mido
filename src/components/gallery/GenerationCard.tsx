"use client";

import { Check, Copy, Download, Heart, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { GenerationRecord } from "@/lib/types";

interface Props {
  item: GenerationRecord;
  onReuse?: (item: GenerationRecord) => void;
  onLike?: (item: GenerationRecord) => void;
}

export function GenerationCard({ item, onReuse, onLike }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(item.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <article className="masonry-item group overflow-hidden rounded-2xl border border-white/8 bg-[#101622]/80 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
      <div className="relative bg-black/40">
        {item.mediaType === "video" && item.mediaUrl ? (
          <video src={item.mediaUrl} controls playsInline className="w-full object-cover" />
        ) : item.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.mediaUrl} alt={item.prompt} className="w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center text-sm text-white/40">
            {item.status === "failed" ? item.error || "Failed" : "Processing…"}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="m-2 grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-black/70 p-1.5 backdrop-blur">
            <a
              href={item.mediaUrl || undefined}
              download
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center rounded-lg py-2 text-white/80 hover:bg-white/10"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className="flex items-center justify-center rounded-lg py-2 text-white/80 hover:bg-white/10"
              title="Copy Prompt"
            >
              {copied ? <Check className="h-4 w-4 text-cyan-300" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => onReuse?.(item)}
              className="flex items-center justify-center rounded-lg py-2 text-white/80 hover:bg-white/10"
              title="Reuse Settings"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onLike?.(item)}
              className="flex items-center justify-center rounded-lg py-2 text-white/80 hover:bg-white/10"
              title="Like / Favorite"
            >
              <Heart
                className={`h-4 w-4 ${item.likedByMe ? "fill-cyan-300 text-cyan-300" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-white/35">
          <span>{item.mode}</span>
          <span className="inline-flex items-center gap-1 normal-case tracking-normal text-white/45">
            <Heart className="h-3 w-3" /> {item.likesCount}
          </span>
        </div>
        <p className="line-clamp-2 text-sm leading-relaxed text-white/75">{item.prompt}</p>
        {item.authorName && <p className="text-xs text-cyan-100/50">by {item.authorName}</p>}
      </div>
    </article>
  );
}
