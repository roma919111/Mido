"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { GenerationWorkbench } from "@/components/workbench/GenerationWorkbench";
import { MasonryFeed } from "@/components/gallery/MasonryFeed";
import type { AspectRatio, GenerationMode, GenerationRecord, StylePreset } from "@/lib/types";

function CreateContent() {
  const params = useSearchParams();
  const [recent, setRecent] = useState<GenerationRecord[]>([]);

  const initial = useMemo(
    () => ({
      mode: (params.get("mode") as GenerationMode | null) ?? undefined,
      prompt: params.get("prompt") ?? undefined,
      negativePrompt: params.get("negative") ?? undefined,
      stylePreset: (params.get("style") as StylePreset | null) ?? undefined,
      aspectRatio: (params.get("ratio") as AspectRatio | null) ?? undefined,
    }),
    [params],
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/70">Workbench</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white sm:text-4xl">
          Create / Generate
        </h1>
        <p className="mt-2 text-sm text-white/45">
          OpenArt Studio canvas with prompt craft, style presets, and credit-aware generation.
        </p>
      </div>

      <GenerationWorkbench
        initial={initial}
        onGenerated={(item) => setRecent((prev) => [item, ...prev].slice(0, 12))}
      />

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-white">
          Session Results
        </h2>
        <MasonryFeed
          items={recent}
          emptyTitle="No generations in this session yet"
          emptySubtitle="Run a generate job and your outputs will land here instantly."
          onItemsChange={setRecent}
        />
      </section>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="text-white/50">Loading studio…</div>}>
      <CreateContent />
    </Suspense>
  );
}
