import { NextResponse } from "next/server";
import { findPlatformDeepLink } from "@/data/max-platform-deeplinks";
import { maxApiCors } from "@/lib/max-api-cors";
import { normalizeNetflixWatchUrl, resolveNetflixUrlFromTmdb } from "@/lib/resolve-netflix-url";
import { normalizeShahidUrl, resolveShahidUrlFromTmdb } from "@/lib/resolve-shahid-url";

export const runtime = "nodejs";

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

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: "id required" }, { status: 400, headers: maxApiCors });
  }

  const catalogUrl = findPlatformDeepLink(tmdbId, tmdbType, platform);
  if (catalogUrl) {
    const directUrl =
      platform === "netflix"
        ? normalizeNetflixWatchUrl(catalogUrl)
        : platform === "shahid"
          ? normalizeShahidUrl(catalogUrl)
          : catalogUrl;
    return NextResponse.json(
      { url: directUrl, direct: true, platform, tmdbId, tmdbType },
      { headers: { ...maxApiCors, "Cache-Control": "public, max-age=86400" } },
    );
  }

  if (platform === "netflix") {
    const netflixUrl = await resolveNetflixUrlFromTmdb(tmdbId, tmdbType);
    if (netflixUrl) {
      return NextResponse.json(
        { url: netflixUrl, direct: true, platform, tmdbId, tmdbType },
        { headers: { ...maxApiCors, "Cache-Control": "public, max-age=86400" } },
      );
    }
  }

  if (platform === "shahid") {
    const shahidUrl = await resolveShahidUrlFromTmdb(tmdbId, tmdbType);
    if (shahidUrl) {
      return NextResponse.json(
        { url: normalizeShahidUrl(shahidUrl), direct: true, platform, tmdbId, tmdbType },
        { headers: { ...maxApiCors, "Cache-Control": "public, max-age=86400" } },
      );
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
