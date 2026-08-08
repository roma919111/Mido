/** Resolve Netflix /title|watch URL by scraping TMDB's public watch page. */
export async function resolveNetflixUrlFromTmdb(
  tmdbId: number,
  tmdbType: "movie" | "tv",
): Promise<string | null> {
  const segment = tmdbType === "tv" ? "tv" : "movie";
  const pageUrl = `https://www.themoviedb.org/${segment}/${tmdbId}/watch`;

  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const encoded = html.match(/netflix\.com%2F(?:title|watch)%2F(\d+)/i)?.[1];
    const plain = html.match(/netflix\.com\/(?:title|watch)\/(\d+)/i)?.[1];
    const id = encoded ?? plain;
    return id ? `https://www.netflix.com/watch/${id}` : null;
  } catch {
    return null;
  }
}

export function normalizeNetflixWatchUrl(url: string): string {
  const id = url.match(/netflix\.com\/(?:title|watch)\/(\d+)/i)?.[1];
  return id ? `https://www.netflix.com/watch/${id}` : url;
}
