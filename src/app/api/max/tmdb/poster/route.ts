import { NextResponse } from "next/server";
import { maxApiCors } from "@/lib/max-api-cors";

export const runtime = "nodejs";

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: maxApiCors });
}

/** Proxy TMDB poster — keeps API key on server. */
export async function GET(request: Request) {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY not configured" },
      { status: 503, headers: maxApiCors },
    );
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const type = url.searchParams.get("type") === "movie" ? "movie" : "tv";
  const query = url.searchParams.get("query")?.trim();

  try {
    if (id) {
      const res = await fetch(
        `https://api.themoviedb.org/3/${type}/${encodeURIComponent(id)}?api_key=${apiKey}&language=ar`,
        { next: { revalidate: 86400 } },
      );
      if (!res.ok) {
        return NextResponse.json({ error: "Not found" }, { status: 404, headers: maxApiCors });
      }
      const data = (await res.json()) as { poster_path?: string | null; vote_average?: number };
      if (!data.poster_path) {
        return NextResponse.json({ error: "No poster" }, { status: 404, headers: maxApiCors });
      }
      return NextResponse.json(
        {
          posterUrl: `${TMDB_IMAGE}${data.poster_path}`,
          rating: data.vote_average ?? null,
        },
        { headers: maxApiCors },
      );
    }

    if (query) {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=ar`,
        { next: { revalidate: 86400 } },
      );
      if (!res.ok) {
        return NextResponse.json({ error: "Search failed" }, { status: 502, headers: maxApiCors });
      }
      const data = (await res.json()) as {
        results?: { poster_path?: string | null; vote_average?: number; media_type?: string }[];
      };
      const hit = data.results?.find((r) => r.poster_path && r.media_type !== "person");
      if (!hit?.poster_path) {
        return NextResponse.json({ error: "No results" }, { status: 404, headers: maxApiCors });
      }
      return NextResponse.json(
        {
          posterUrl: `${TMDB_IMAGE}${hit.poster_path}`,
          rating: hit.vote_average ?? null,
        },
        { headers: maxApiCors },
      );
    }

    return NextResponse.json({ error: "id or query required" }, { status: 400, headers: maxApiCors });
  } catch {
    return NextResponse.json({ error: "TMDB error" }, { status: 502, headers: maxApiCors });
  }
}
