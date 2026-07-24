"use client";

import { useRouter } from "next/navigation";
import type { GenerationRecord } from "@/lib/types";
import { GenerationCard } from "./GenerationCard";

interface Props {
  items: GenerationRecord[];
  emptyTitle: string;
  emptySubtitle: string;
  onItemsChange?: (items: GenerationRecord[]) => void;
}

export function MasonryFeed({ items, emptyTitle, emptySubtitle, onItemsChange }: Props) {
  const router = useRouter();

  async function onLike(item: GenerationRecord) {
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationId: item.id }),
    });
    if (!res.ok) return;
    const data = await res.json();
    onItemsChange?.(
      items.map((row) =>
        row.id === item.id
          ? { ...row, likedByMe: data.liked, likesCount: data.likesCount }
          : row,
      ),
    );
  }

  function onReuse(item: GenerationRecord) {
    const params = new URLSearchParams({
      mode: item.mode,
      prompt: item.prompt,
      style: String(item.stylePreset || "cinematic"),
      ratio: String(item.aspectRatio || "1:1"),
    });
    if (item.negativePrompt) params.set("negative", item.negativePrompt);
    router.push(`/create?${params.toString()}`);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-white/8 bg-white/[0.02] px-6 py-16 text-center">
        <p className="text-white/75">{emptyTitle}</p>
        <p className="mt-1 text-sm text-white/40">{emptySubtitle}</p>
      </div>
    );
  }

  return (
    <div className="masonry">
      {items.map((item) => (
        <GenerationCard key={item.id} item={item} onLike={onLike} onReuse={onReuse} />
      ))}
    </div>
  );
}
