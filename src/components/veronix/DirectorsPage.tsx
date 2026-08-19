"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clapperboard, Copy, Search, Sparkles, X } from "lucide-react";
import { AppHeader } from "@/components/veronix/AppHeader";
import { BottomNav } from "@/components/veronix/BottomNav";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { DIRECTORS_CATALOG } from "@/lib/directors-catalog";
import {
  buildDirectorPrompt,
  createDirectorHref,
} from "@/lib/directors-prompts";
import type { DirectorStyle } from "@/lib/directors-types";

export function DirectorsPage() {
  const { t, dir, locale } = useLocale();
  const { user, logout, ready, refreshing } = useCustomerUser();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DirectorStyle | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return DIRECTORS_CATALOG;
    return DIRECTORS_CATALOG.filter((d) => {
      const name = d.name[locale].toLowerCase();
      const tag = d.tagline[locale].toLowerCase();
      return name.includes(q) || tag.includes(q);
    });
  }, [search, locale]);

  const selectedPrompt = selected
    ? buildDirectorPrompt(selected, locale)
    : "";

  return (
    <div className="min-h-dvh bg-[#0b0d12] text-white" dir={dir}>
      <AppHeader
        user={user}
        onLogout={logout}
        ready={ready}
        refreshing={refreshing}
      />

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pb-32 sm:pt-8">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#7c5cff]/15 text-[#b9a6ff] ring-1 ring-[#7c5cff]/25">
            <Clapperboard className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[#22f0ff]/90">
              {t.directors.eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {t.directors.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
              {t.directors.subtitle}
            </p>
          </div>
        </div>

        <div className="relative mt-6">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.directors.searchPlaceholder}
            className="w-full rounded-2xl border border-white/10 bg-[#141821] py-3 pe-4 ps-10 text-sm text-white placeholder:text-white/35 focus:border-[#22f0ff]/40 focus:outline-none focus:ring-1 focus:ring-[#22f0ff]/30"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#141821] px-4 py-10 text-center text-sm text-white/50">
            {t.directors.empty}
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((director) => {
              const name = director.name[locale];
              const tagline = director.tagline[locale];
              return (
                <button
                  key={director.id}
                  type="button"
                  onClick={() => {
                    setSelected(director);
                    setCopied(false);
                  }}
                  className="group rounded-2xl border border-white/10 bg-[#141821] p-3 text-start transition hover:border-[#7c5cff]/30 hover:bg-[#171b24]"
                >
                  <div
                    className={`flex aspect-[16/10] w-full items-end rounded-xl bg-gradient-to-br ${director.gradient} p-4`}
                  >
                    <Clapperboard
                      className="h-8 w-8 text-white/25 transition group-hover:text-white/40"
                      aria-hidden
                    />
                  </div>
                  <div className="mt-3">
                    <h2 className="text-sm font-semibold text-white">{name}</h2>
                    <p className="mt-0.5 text-xs text-white/45">{tagline}</p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/45">
                    {director.look[locale]}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#7c5cff]/90">
                    {t.directors.usePrompt} →
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#141821] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="director-dialog-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/8 p-5">
              <div>
                <p className="text-xs font-semibold text-[#7c5cff]/90">
                  {t.directors.eyebrow}
                </p>
                <h2
                  id="director-dialog-title"
                  className="mt-1 text-lg font-bold text-white"
                >
                  {selected.name[locale]}
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  {selected.tagline[locale]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 hover:text-white"
                aria-label={t.directors.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <p className="text-xs font-semibold text-white/45">
                {t.directors.promptLabel}
              </p>
              <p className="mt-2 rounded-2xl border border-white/8 bg-black/30 p-4 text-sm leading-relaxed text-white/80">
                {selectedPrompt}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={createDirectorHref(selectedPrompt)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-3 text-sm font-bold text-white sm:flex-none"
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {t.directors.createCta}
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(selectedPrompt);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/30"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  {copied ? t.directors.copied : t.directors.copyPrompt}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
