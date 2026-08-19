import { NextResponse } from "next/server";
import { INSPIRE_CATALOG, mergeInspireItems } from "@/lib/inspire-catalog";
import { enrichInspirePosters } from "@/lib/inspire-posters";
import { fetchTmdbTrending } from "@/lib/inspire-tmdb";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  let items = INSPIRE_CATALOG;
  let source: "catalog" | "tmdb" | "mixed" = "catalog";

  if (apiKey) {
    const live = await fetchTmdbTrending(apiKey);
    if (live.length) {
      items = mergeInspireItems(live, INSPIRE_CATALOG);
      source = live.length >= INSPIRE_CATALOG.length ? "tmdb" : "mixed";
    }
  }

  items = await enrichInspirePosters(items, { tmdbApiKey: apiKey });

  return NextResponse.json({
    items,
    source,
    updatedAt: new Date().toISOString(),
  });
}
