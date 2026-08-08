import { NextResponse } from "next/server";
import { findPlatformDeepLink } from "@/data/max-platform-deeplinks";
import { maxApiCors } from "@/lib/max-api-cors";

export const runtime = "nodejs";

const WATCH_PROVIDERS: Partial<Record<string, number>> = {
  netflix: 8,
  shahid: 1718,
};

function normalizeNetflixUrl(url: string): string {
  const id = url.match(/netflix\.com\/(?:title|watch)\/(\d+)/i)?.[1];
  return id ? `https://www.netflix.com/watch/${id}` : url;
}

function buildSearchQuery(title: string, year: string | null): string {
  const base = title.trim();
  if (year && !base.includes(year)) return `${base} ${year}`;
  return base;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: maxApiCors });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tmdbId = Number(url.searchParams.get("id"));
  const tmdbType = url.searchParams.get("type") === "tv" ? "tv" : "movie";
  const platform = url.searchParams.get("platform") ?? "netflix";
  const title = url.searchParams.get("title")?.trim() ?? "";
  const year = url.searchParams.get("year");
  const region = url.searchParams.get("region") ?? "SA";

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: "id required" }, { status: 400, headers: maxApiCors });
  }

  const catalogUrl = findPlatformDeepLink(tmdbId, tmdbType, platform);
  if (catalogUrl) {
    const directUrl = platform === "netflix" ? normalizeNetflixUrl(catalogUrl) : catalogUrl;
    return NextResponse.json(
      { url: directUrl, direct: true, platform, tmdbId, tmdbType },
      { headers: maxApiCors },
    );
  }

  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (apiKey) {
    try {
      const providerId = WATCH_PROVIDERS[platform];
      if (providerId) {
        const providersUrl = new URL(
          `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/watch/providers`,
        );
        providersUrl.searchParams.set("api_key", apiKey);
        const res = await fetch(providersUrl.toString(), { next: { revalidate: 86400 } });
        if (res.ok) {
          const data = (await res.json()) as {
            results?: Record<string, { flatrate?: { provider_id: number }[] }>;
          };
          const regionData = data.results?.[region] ?? data.results?.US;
          const available = regionData?.flatrate?.some((p) => p.provider_id === providerId);
          if (!available && regionData) {
            /* Title may still exist on platform in other regions — keep search fallback */
          }
        }
      }
    } catch {
      /* ignore TMDB errors — fall back to search */
    }
  }

  const searchQuery = buildSearchQuery(title, year);
  return NextResponse.json(
    {
      url: null,
      searchQuery,
      direct: false,
      platform,
      tmdbId,
      tmdbType,
    },
    { headers: maxApiCors },
  );
}
