import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDictionary,
  localeDir,
  normalizeLocale,
  type Dictionary,
  type Locale,
} from "@/lib/i18n/dictionaries";

export {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  getDictionary,
  isLocale,
  localeDir,
  normalizeLocale,
  type Dictionary,
  type Locale,
} from "@/lib/i18n/dictionaries";

/** Server-side locale from cookie (App Router). */
export async function getRequestLocale(): Promise<Locale> {
  try {
    const jar = await cookies();
    return normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function getRequestDictionary(): Promise<{
  locale: Locale;
  dir: "rtl" | "ltr";
  t: Dictionary;
}> {
  const locale = await getRequestLocale();
  return { locale, dir: localeDir(locale), t: getDictionary(locale) };
}
