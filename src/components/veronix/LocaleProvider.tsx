"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDictionary,
  localeDir,
  normalizeLocale,
  type Dictionary,
  type Locale,
} from "@/lib/i18n/dictionaries";

type LocaleContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: Dictionary;
  setLocale: (next: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  return normalizeLocale(match?.[1] ? decodeURIComponent(match[1]) : null);
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale?: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale || DEFAULT_LOCALE,
  );

  useEffect(() => {
    const fromCookie = readCookieLocale();
    if (fromCookie !== locale) setLocaleState(fromCookie);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot sync once
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDir(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    const normalized = normalizeLocale(next);
    setLocaleState(normalized);
    document.cookie = `${LOCALE_COOKIE}=${normalized};path=/;max-age=31536000;samesite=lax`;
    void fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: normalized }),
    }).catch(() => undefined);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: localeDir(locale),
      t: getDictionary(locale),
      setLocale,
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    const locale = DEFAULT_LOCALE;
    return {
      locale,
      dir: localeDir(locale),
      t: getDictionary(locale),
      setLocale: () => undefined,
    };
  }
  return ctx;
}
