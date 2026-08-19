import type { InspireItem } from "@/lib/inspire-types";
import type { Locale } from "@/lib/i18n/dictionaries";

export function buildInspirePrompt(item: InspireItem, locale: Locale): string {
  const title = item.title[locale];
  const overview = item.overview[locale];
  const genreHint = item.genres.slice(0, 2).join(", ");
  const mediaLabel = item.mediaType === "movie" ? "film" : "series";

  if (locale === "ar") {
    return [
      `مشهد سينمائي بأسلوب ${title} (${item.year}) — ${genreHint}.`,
      overview,
      "إضاءة درامية، عمق ميدان ضحل، حبيبات فيلم، حركة كamera سلسة، 16:9، جودة إنتاج عالية.",
    ].join(" ");
  }

  return [
    `Cinematic ${mediaLabel} scene inspired by ${title} (${item.year}) — ${genreHint}.`,
    overview,
    "Dramatic lighting, shallow depth of field, film grain, smooth camera motion, 16:9, high production value.",
  ].join(" ");
}

export function createInspireHref(prompt: string, modelId = "veronix"): string {
  const params = new URLSearchParams({
    prompt,
    model: modelId,
  });
  return `/create/video?${params.toString()}`;
}
