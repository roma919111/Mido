"use client";

import { useLocale } from "@/components/veronix/LocaleProvider";
import type { Locale } from "@/lib/i18n/dictionaries";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();

  function pick(next: Locale) {
    if (next === locale) return;
    setLocale(next);
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border border-white/12 bg-white/5 font-semibold ${
        compact ? "p-0.5 text-[10px]" : "p-0.5 text-[11px]"
      }`}
      role="group"
      aria-label={t.lang.switchTo}
    >
      <button
        type="button"
        onClick={() => pick("ar")}
        className={`rounded-full transition ${
          compact ? "px-1.5 py-0.5" : "px-2 py-1"
        } ${
          locale === "ar"
            ? "bg-white text-black"
            : "text-white/60 hover:text-white"
        }`}
        aria-pressed={locale === "ar"}
      >
        {compact ? "ع" : t.lang.ar}
      </button>
      <button
        type="button"
        onClick={() => pick("en")}
        className={`rounded-full transition ${
          compact ? "px-1.5 py-0.5" : "px-2 py-1"
        } ${
          locale === "en"
            ? "bg-white text-black"
            : "text-white/60 hover:text-white"
        }`}
        aria-pressed={locale === "en"}
      >
        {compact ? "EN" : t.lang.en}
      </button>
    </div>
  );
}
