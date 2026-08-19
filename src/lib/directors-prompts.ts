import type { DirectorStyle } from "@/lib/directors-types";
import type { Locale } from "@/lib/i18n/dictionaries";

export function buildDirectorPrompt(director: DirectorStyle, locale: Locale): string {
  const name = director.name[locale];
  const look = director.look[locale];

  if (locale === "ar") {
    return [
      `مشهد سينمائي بأسلوب ${name}.`,
      look,
      "16:9، جودة إنتاج عالية، حركة كamera سلسة.",
    ].join(" ");
  }

  return [
    `Cinematic scene in the visual style of ${name}.`,
    look,
    "16:9, high production value, smooth camera motion.",
  ].join(" ");
}

export function createDirectorHref(prompt: string, modelId = "veronix"): string {
  const params = new URLSearchParams({
    prompt,
    model: modelId,
  });
  return `/create/video?${params.toString()}`;
}
