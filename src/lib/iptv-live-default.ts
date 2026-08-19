export type NamedIptvCategory = {
  id: string;
  name: string;
};

function normalizeLiveCategoryName(name: string): string {
  return name
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[|_/\\,.\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLocalToken(normalized: string, raw: string): boolean {
  return /\bLOCAL\b/.test(normalized) || raw.includes("لوكال") || raw.includes("محلي");
}

function hasBeinToken(normalized: string, raw: string): boolean {
  return normalized.includes("BEIN") || /بي\s*ا?[نيي]/.test(raw) || raw.includes("بيين");
}

/** Lower is better. 0 = Local beIN. */
export function liveCategoryMatchScore(name: string): number {
  const normalized = normalizeLiveCategoryName(name);
  const local = hasLocalToken(normalized, name);
  const bein = hasBeinToken(normalized, name);
  if (local && bein) return 0;
  if (local && /SPORT|رياض/.test(normalized)) return 2;
  if (bein) return 5;
  return 99;
}

export function pickDefaultLiveCategoryId(categories: NamedIptvCategory[]): string {
  if (!categories.length) return "";

  let bestId = "";
  let bestScore = 99;
  for (const cat of categories) {
    const score = liveCategoryMatchScore(cat.name);
    if (score < bestScore) {
      bestScore = score;
      bestId = cat.id;
    }
  }

  if (bestScore < 99 && bestId) return bestId;
  return categories[0]?.id ?? "";
}

export function sortLiveCategoriesForUi<T extends NamedIptvCategory>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const score = liveCategoryMatchScore(a.name) - liveCategoryMatchScore(b.name);
    if (score !== 0) return score;
    return a.name.localeCompare(b.name, "ar");
  });
}
