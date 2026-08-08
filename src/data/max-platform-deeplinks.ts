/** TMDB id → official platform title URLs (from MAX catalog). */
export type PlatformDeepLink = {
  tmdbId: number;
  tmdbType: "movie" | "tv";
  platform: "netflix" | "shahid" | "tod";
  url: string;
};

export const MAX_PLATFORM_DEEPLINKS: PlatformDeepLink[] = [
  { tmdbId: 1396, tmdbType: "tv", platform: "netflix", url: "https://www.netflix.com/title/70143836" },
  { tmdbId: 71446, tmdbType: "tv", platform: "netflix", url: "https://www.netflix.com/title/80192098" },
  { tmdbId: 216616, tmdbType: "tv", platform: "shahid", url: "https://shahid.mbc.net/ar/series/Al-Hashashin/988896" },
  { tmdbId: 66732, tmdbType: "tv", platform: "netflix", url: "https://www.netflix.com/title/80057281" },
  { tmdbId: 569094, tmdbType: "movie", platform: "netflix", url: "https://www.netflix.com/title/81657227" },
  { tmdbId: 119051, tmdbType: "tv", platform: "netflix", url: "https://www.netflix.com/title/81257204" },
  { tmdbId: 93405, tmdbType: "tv", platform: "netflix", url: "https://www.netflix.com/title/81040344" },
  { tmdbId: 70523, tmdbType: "tv", platform: "netflix", url: "https://www.netflix.com/title/80100172" },
  { tmdbId: 65494, tmdbType: "tv", platform: "netflix", url: "https://www.netflix.com/title/80025678" },
  { tmdbId: 545609, tmdbType: "movie", platform: "netflix", url: "https://www.netflix.com/title/81652327" },
  { tmdbId: 568124, tmdbType: "movie", platform: "netflix", url: "https://www.netflix.com/title/81008321" },
];

export function findPlatformDeepLink(
  tmdbId: number,
  tmdbType: "movie" | "tv",
  platform: string,
): string | null {
  const row = MAX_PLATFORM_DEEPLINKS.find(
    (d) => d.tmdbId === tmdbId && d.tmdbType === tmdbType && d.platform === platform,
  );
  return row?.url ?? null;
}
