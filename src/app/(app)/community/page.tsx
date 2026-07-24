"use client";

import { useEffect, useState } from "react";
import { MasonryFeed } from "@/components/gallery/MasonryFeed";
import type { GenerationRecord } from "@/lib/types";

export default function CommunityPage() {
  const [tab, setTab] = useState<"community" | "private">("community");
  const [community, setCommunity] = useState<GenerationRecord[]>([]);
  const [mine, setMine] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [communityRes, mineRes] = await Promise.all([
          fetch("/api/community"),
          fetch("/api/generations"),
        ]);
        const communityData = await communityRes.json();
        setCommunity(communityData.items ?? []);
        if (mineRes.ok) {
          const mineData = await mineRes.json();
          setMine(mineData.items ?? []);
        } else {
          setMine([]);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const items = tab === "community" ? community : mine;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/70">Discover</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white sm:text-4xl">
          Community Feed
        </h1>
      </div>

      <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
        {[
          { id: "community" as const, label: "Explore Community" },
          { id: "private" as const, label: "My Private Generations" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-xl px-4 py-2 text-sm transition ${
              tab === item.id
                ? "bg-cyan-400/15 text-cyan-100"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-white/45">Loading feed…</p>
      ) : (
        <MasonryFeed
          items={items}
          emptyTitle={tab === "community" ? "No public posts yet" : "Your private library is empty"}
          emptySubtitle={
            tab === "community"
              ? "Share a generation to the community from the create workbench."
              : "Sign in and generate to populate your private feed."
          }
          onItemsChange={tab === "community" ? setCommunity : setMine}
        />
      )}
    </div>
  );
}
