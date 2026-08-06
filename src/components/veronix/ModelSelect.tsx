"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { CatalogModel } from "@/lib/model-catalog";
import { ModelLogo } from "@/components/veronix/ModelLogo";

type ModelSelectProps = {
  models: CatalogModel[];
  value: string;
  onChange: (id: string) => void;
  comingSoonLabel: string;
  label: string;
};

export function ModelSelect({
  models,
  value,
  onChange,
  comingSoonLabel,
  label,
}: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = models.find((m) => m.id === value) ?? models[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-left text-sm text-white outline-none transition hover:border-white/20 sm:py-2.5"
      >
        {selected ? <ModelLogo model={selected} size={24} /> : null}
        <span className="min-w-0 flex-1 truncate">
          {selected
            ? selected.available
              ? selected.name
              : `${selected.name} · ${comingSoonLabel}`
            : label}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/50 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-50 mt-1.5 max-h-[min(18rem,50vh)] w-full overflow-y-auto rounded-xl border border-white/10 bg-[#12151c] py-1 shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
        >
          {models.map((model) => {
            const isSelected = model.id === value;
            const disabled = !model.available;
            return (
              <li key={model.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    onChange(model.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition ${
                    disabled
                      ? "cursor-not-allowed opacity-45"
                      : isSelected
                        ? "bg-[rgba(34,240,255,0.1)] text-white"
                        : "text-white/90 hover:bg-white/[0.06]"
                  }`}
                >
                  <ModelLogo model={model} size={24} />
                  <span className="min-w-0 flex-1 truncate">
                    {model.available
                      ? model.name
                      : `${model.name} · ${comingSoonLabel}`}
                  </span>
                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0 text-[#22f0ff]" />
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
