"use client";

import { useEffect, useState } from "react";
import { MasonryFeed } from "@/components/gallery/MasonryFeed";
import type { GenerationRecord } from "@/lib/types";

export default function LibraryPage() {
  const [items, setItems] = useState<GenerationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/generations");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to load library");
        return;
      }
      setItems(data.items ?? []);
    }
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/70">Personal</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white sm:text-4xl">
          My Library
        </h1>
        <p className="mt-2 text-sm text-white/45">
          Private generations stored for your account with prompts and settings.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
          {error}. <a href="/login" className="underline">Sign in</a> to access your library.
        </div>
      ) : (
        <MasonryFeed
          items={items}
          emptyTitle="No private generations yet"
          emptySubtitle="Create an image or video and it will appear in your library."
          onItemsChange={setItems}
        />
      )}
    </div>
  );
}
