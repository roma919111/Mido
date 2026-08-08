export const TMDB_PROVIDER_IDS = {
  netflix: 8,
  shahid: 1718,
} as const;

export type WatchPlatform = "netflix" | "shahid" | "tod";

type ProviderEntry = { provider_id: number };

export function pickPlatformFromProviders(
  flatrate: ProviderEntry[] | undefined,
  hints?: { originalLanguage?: string | null; preferred?: WatchPlatform },
): WatchPlatform {
  const ids = new Set(flatrate?.map((p) => p.provider_id) ?? []);
  const hasNetflix = ids.has(TMDB_PROVIDER_IDS.netflix);
  const hasShahid = ids.has(TMDB_PROVIDER_IDS.shahid);

  if (hasShahid && !hasNetflix) return "shahid";
  if (hasNetflix && !hasShahid) return "netflix";
  if (hasShahid && hasNetflix) {
    if (hints?.preferred) return hints.preferred;
    if (hints?.originalLanguage === "ar") return "shahid";
    return "netflix";
  }
  return hints?.preferred ?? "netflix";
}

export async function fetchItemPlatform(
  apiKey: string,
  tmdbId: number,
  tmdbType: "movie" | "tv",
  region = "SA",
  hints?: { originalLanguage?: string | null; preferred?: WatchPlatform },
): Promise<WatchPlatform> {
  const segment = tmdbType === "tv" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${segment}/${tmdbId}/watch/providers?api_key=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return hints?.preferred ?? "netflix";

    const data = (await res.json()) as {
      results?: Record<string, { flatrate?: ProviderEntry[] }>;
    };
    const flatrate = data.results?.[region]?.flatrate;
    return pickPlatformFromProviders(flatrate, hints);
  } catch {
    return hints?.preferred ?? "netflix";
  }
}

export async function enrichDiscoverPlatforms<T extends { tmdbId: number; tmdbType: "movie" | "tv" }>(
  apiKey: string,
  items: T[],
  options?: {
    region?: string;
    preferred?: WatchPlatform;
    originalLanguages?: Map<string, string | null>;
    concurrency?: number;
  },
): Promise<(T & { platform: WatchPlatform })[]> {
  const region = options?.region ?? "SA";
  const preferred = options?.preferred;
  const concurrency = options?.concurrency ?? 8;
  const originalLanguages = options?.originalLanguages;

  const out: (T & { platform: WatchPlatform })[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      const item = items[i]!;
      const langKey = `${item.tmdbType}:${item.tmdbId}`;
      const originalLanguage = originalLanguages?.get(langKey) ?? null;
      const platform = await fetchItemPlatform(apiKey, item.tmdbId, item.tmdbType, region, {
        preferred,
        originalLanguage,
      });
      out[i] = { ...item, platform };
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}
