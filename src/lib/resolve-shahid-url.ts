/** Resolve Shahid deep link by scraping TMDB's public watch page. */
export async function resolveShahidUrlFromTmdb(
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
    const encoded = html.match(/shahid\.mbc\.net%2F[^"'\\s]+/i)?.[0];
    const plain = html.match(/shahid\.mbc\.net\/[^"'\\s]+/i)?.[0];
    const raw = encoded ?? plain;
    if (!raw) return null;

    const decoded = decodeURIComponent(raw.replace(/&amp;/g, "&"));
    const path = decoded.replace(/^https?:\/\//i, "").replace(/^shahid\.mbc\.net/i, "");
    return `https://shahid.mbc.net${path.startsWith("/") ? path : `/${path}`}`.split(/[?"']/)[0] ?? null;
  } catch {
    return null;
  }
}

export function normalizeShahidUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}
