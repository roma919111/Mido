import type { InspireItem } from "@/lib/inspire-types";
import { inspirePosterUrl } from "@/lib/inspire-types";

const WIKI_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary";
const FETCH_HEADERS = {
  "User-Agent": "VyronixInspire/1.0 (https://vyronix.app; inspire@vyronix.app)",
  Accept: "application/json",
};

function upscaleWikiThumb(url: string): string {
  return url.replace(/\/(\d+)px-/, "/440px-");
}

export async function fetchWikiPoster(wikiTitle: string): Promise<string | null> {
  const url = `${WIKI_BASE}/${encodeURIComponent(wikiTitle)}`;
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail?: { source?: string } };
    const src = data.thumbnail?.source?.trim();
    return src ? upscaleWikiThumb(src) : null;
  } catch {
    return null;
  }
}

export async function enrichInspirePosters(
  items: InspireItem[],
  opts?: { tmdbApiKey?: string },
): Promise<InspireItem[]> {
  const tmdbKey = opts?.tmdbApiKey?.trim();

  return Promise.all(
    items.map(async (item) => {
      if (item.posterPath?.startsWith("http")) return item;

      if (tmdbKey && item.tmdbId) {
        const fromTmdb = await fetchTmdbPoster(item.mediaType, item.tmdbId, tmdbKey);
        if (fromTmdb) return { ...item, posterPath: fromTmdb };
      }

      if (item.wikiTitle) {
        const fromWiki = await fetchWikiPoster(item.wikiTitle);
        if (fromWiki) return { ...item, posterPath: fromWiki };
      }

      if (item.posterPath && !item.posterPath.startsWith("http")) {
        const tmdbUrl = inspirePosterUrl(item.posterPath);
        if (tmdbUrl && (await probeImage(tmdbUrl))) {
          return { ...item, posterPath: tmdbUrl };
        }
      }

      return { ...item, posterPath: null };
    }),
  );
}

async function fetchTmdbPoster(
  mediaType: "movie" | "tv",
  id: number,
  apiKey: string,
): Promise<string | null> {
  const path = mediaType === "movie" ? `/movie/${id}` : `/tv/${id}`;
  const url = `https://api.themoviedb.org/3${path}?api_key=${apiKey}`;
  try {
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { poster_path?: string | null };
    return inspirePosterUrl(data.poster_path || null);
  } catch {
    return null;
  }
}

async function probeImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", next: { revalidate: 86_400 } });
    return res.ok;
  } catch {
    return false;
  }
}
