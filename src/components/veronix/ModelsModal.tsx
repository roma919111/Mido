"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { CatalogModel } from "@/lib/model-catalog";

interface ModelsModalProps {
  open: boolean;
  kind: "image" | "video";
  imageModels: CatalogModel[];
  videoModels: CatalogModel[];
  selectedIds: string[];
  onClose: () => void;
  onChange: (ids: string[]) => void;
}

export function ModelsModal({
  open,
  kind,
  imageModels,
  videoModels,
  selectedIds,
  onClose,
  onChange,
}: ModelsModalProps) {
  const [tab, setTab] = useState<"all" | "image" | "video">(kind === "video" ? "video" : "all");
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const base =
      tab === "image" ? imageModels : tab === "video" ? videoModels : [...imageModels, ...videoModels];
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  }, [tab, imageModels, videoModels, query]);

  if (!open) return null;

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
      return;
    }
    if (selectedIds.length >= 4) return;
    onChange([...selectedIds, id]);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl border border-white/10 bg-[#12151c] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Models</p>
            <p className="text-xs text-white/45">Select Multiple Up to 4 · {selectedIds.length}/4</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto text-xs">
            {[
              { id: "all", label: "All models" },
              { id: "image", label: "Image" },
              { id: "video", label: "Video" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`shrink-0 rounded-full px-3 py-1.5 ${
                  tab === item.id
                    ? "bg-white text-black"
                    : "border border-white/10 text-white/70"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {list.map((model) => {
              const selected = selectedIds.includes(model.id);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => toggle(model.id)}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    selected
                      ? "border-[#22f0ff] bg-[rgba(34,240,255,0.08)]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white">{model.name}</p>
                    <span
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${
                        selected ? "border-[#22f0ff] bg-[#22f0ff]" : "border-white/25"
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">
                    {model.kind} · {model.available ? "Live MCP" : "Listed"}
                    {model.badge ? ` · ${model.badge}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/8 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black"
          >
            Done · {selectedIds.length} selected
          </button>
        </div>
      </div>
    </div>
  );
}
