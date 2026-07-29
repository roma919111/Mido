"use client";

import { useLocale } from "@/components/veronix/LocaleProvider";
import type { Locale } from "@/lib/i18n/dictionaries";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();

  function pick(next: Locale) {
    if (next === locale) return;
    setLocale(next);
  }

  if (compact) {
    const next: Locale = locale === "ar" ? "en" : "ar";
    return (
      <button
        type="button"
        onClick={() => pick(next)}
        className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full border border-white/12 bg-white/5 px-2 text-[11px] font-semibold text-white/85"
        aria-label={t.lang.switchTo}
        title={t.lang.switchTo}
      >
        {locale === "ar" ? "ع" : "EN"}
      </button>
    );
  }

  return (
    <div
      className="inline-flex items-center rounded-full border border-white/12 bg-white/5 p-0.5 text-[11px] font-semibold"
      role="group"
      aria-label={t.lang.switchTo}
    >
      <button
        type="button"
        onClick={() => pick("ar")}
        className={`rounded-full px-2 py-1 transition ${
          locale === "ar"
            ? "bg-white text-black"
            : "text-white/60 hover:text-white"
        }`}
        aria-pressed={locale === "ar"}
      >
        {t.lang.ar}
      </button>
      <button
        type="button"
        onClick={() => pick("en")}
        className={`rounded-full px-2 py-1 transition ${
          locale === "en"
            ? "bg-white text-black"
            : "text-white/60 hover:text-white"
        }`}
        aria-pressed={locale === "en"}
      >
        {t.lang.en}
      </button>
    </div>
  );
}
