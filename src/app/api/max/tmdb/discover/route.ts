import { NextResponse } from "next/server";
import { maxApiCors } from "@/lib/max-api-cors";

export const runtime = "nodejs";

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";

/** TMDB watch provider ids (MENA region). */
const WATCH_PROVIDERS: Partial<Record<string, number>> = {
  netflix: 8,
  shahid: 1718,
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: maxApiCors });
}

/** Trending titles on Netflix/Shahid via TMDB discover. */
export async function GET(request: Request) {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY not configured" },
      { status: 503, headers: maxApiCors },
    );
  }

  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") ?? "netflix";
  const mediaType = url.searchParams.get("type") === "tv" ? "tv" : "movie";
  const providerId = WATCH_PROVIDERS[platform];

  if (!providerId) {
    return NextResponse.json({ results: [] }, { headers: maxApiCors });
  }

  const region = url.searchParams.get("region") ?? "SA";
  const discoverUrl = new URL(`https://api.themoviedb.org/3/discover/${mediaType}`);
  discoverUrl.searchParams.set("api_key", apiKey);
  discoverUrl.searchParams.set("watch_region", region);
  discoverUrl.searchParams.set("with_watch_providers", String(providerId));
  discoverUrl.searchParams.set("sort_by", "popularity.desc");
  discoverUrl.searchParams.set("language", "ar");
  discoverUrl.searchParams.set("page", url.searchParams.get("page") ?? "1");

  try {
    const res = await fetch(discoverUrl.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Discover failed" }, { status: 502, headers: maxApiCors });
    }

    const data = (await res.json()) as {
      results?: {
        id: number;
        title?: string;
        name?: string;
        poster_path?: string | null;
        vote_average?: number;
        release_date?: string;
        first_air_date?: string;
      }[];
    };

    const results = (data.results ?? [])
      .filter((r) => r.poster_path)
      .slice(0, 20)
      .map((r) => ({
        tmdbId: r.id,
        tmdbType: mediaType,
        title: r.title ?? r.name ?? "—",
        posterUrl: `${TMDB_IMAGE}${r.poster_path}`,
        rating: r.vote_average ?? null,
        year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4) || null,
      }));

    return NextResponse.json({ results, platform, mediaType }, { headers: maxApiCors });
  } catch {
    return NextResponse.json({ error: "TMDB error" }, { status: 502, headers: maxApiCors });
  }
}
