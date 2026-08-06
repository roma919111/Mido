"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { CatalogModel } from "@/lib/model-catalog";
import { ModelLogo } from "@/components/veronix/ModelLogo";

interface ModelsModalProps {
  open: boolean;
  kind: "image" | "video";
  imageModels: CatalogModel[];
  videoModels: CatalogModel[];
  selectedId: string | null;
  /** When set, hide the other media tab. */
  lockedKind?: "image" | "video";
  onClose: () => void;
  onChange: (id: string) => void;
}

export function ModelsModal({
  open,
  kind,
  imageModels,
  videoModels,
  selectedId,
  lockedKind,
  onClose,
  onChange,
}: ModelsModalProps) {
  const [tab, setTab] = useState<"image" | "video">(kind);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setTab(lockedKind || kind);
      setQuery("");
    }
  }, [open, kind, lockedKind]);

  const list = useMemo(() => {
    const activeTab = lockedKind || tab;
    const base = activeTab === "image" ? imageModels : videoModels;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [tab, lockedKind, imageModels, videoModels, query]);

  if (!open) return null;

  const activeTab = lockedKind || tab;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex h-[min(92vh,720px)] w-full max-w-2xl flex-col rounded-t-3xl border border-white/10 bg-[#12151c] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
          <p className="text-sm font-semibold text-white">اختر موديل واحد</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 space-y-3 px-4 py-3">
          {!lockedKind && (
            <div className="flex gap-2 text-xs">
              {[
                { id: "image" as const, label: "صور" },
                { id: "video" as const, label: "فيديو" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`rounded-full px-3 py-1.5 ${
                    activeTab === item.id
                      ? "bg-white text-black"
                      : "border border-white/10 text-white/70"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن موديل"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/45">
              لا توجد موديلات للعرض حاليًا. حدّث الصفحة وحاول مرة ثانية.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {list.map((model) => {
                const selected = selectedId === model.id;
                const disabled = !model.available;
                return (
                  <button
                    key={model.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      onChange(model.id);
                      onClose();
                    }}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      selected
                        ? "border-[#22f0ff] bg-[rgba(34,240,255,0.08)]"
                        : disabled
                          ? "cursor-not-allowed border-white/5 bg-white/[0.02] opacity-55"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <ModelLogo model={model} size={28} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-white">{model.name}</p>
                          <span
                            className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${
                              selected
                                ? "border-[#22f0ff] bg-[#22f0ff]"
                                : "border-white/25"
                            }`}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-white/40">
                          {model.tagline
                            ? `${model.tagline}${model.badge ? ` · ${model.badge}` : ""}`
                            : `${model.available ? "متاح" : "قريبًا"}${model.badge ? ` · ${model.badge}` : ""}`}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
