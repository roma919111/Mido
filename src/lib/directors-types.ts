import type { Locale } from "@/lib/i18n/dictionaries";

export type DirectorStyle = {
  id: string;
  name: Record<Locale, string>;
  tagline: Record<Locale, string>;
  gradient: string;
  /** Visual keywords for the prompt */
  look: Record<Locale, string>;
};
