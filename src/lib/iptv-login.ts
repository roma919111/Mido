import { fetchAndParseM3u } from "@/lib/m3u-parser";
import { assertSafeIptvUrl } from "@/lib/iptv-ssrf";
import { categoriesFromXtream, createIptvSession, listIptvCategories } from "@/lib/iptv-session-cache";
import {
  buildM3uPlusUrl,
  fetchXtreamLive,
  fetchXtreamLiveCategories,
  verifyXtreamLogin,
  type XtreamChannel,
  type XtreamCredentials,
} from "@/lib/xtream-url";

async function loadLive(creds: XtreamCredentials): Promise<{ live: XtreamChannel[]; source: "api" | "m3u" }> {
  try {
    const live = await fetchXtreamLive(creds);
    return { live, source: "api" };
  } catch {
    const m3uUrl = buildM3uPlusUrl(creds);
    assertSafeIptvUrl(m3uUrl);
    const parsed = await fetchAndParseM3u(m3uUrl);
    const live: XtreamChannel[] = parsed.slice(0, 8000).map((c) => ({
      id: c.id,
      name: c.name,
      group: c.group ?? null,
      categoryId: c.group ?? "other",
      logo: c.logo ?? null,
      url: c.url,
      kind: "live" as const,
    }));
    return { live, source: "m3u" };
  }
}

export type IptvLoginPayload = {
  sessionId: string;
  host: string;
  username: string;
  label: string;
  source: "api" | "m3u";
  totals: { live: number; movies: number | null; series: number | null };
  liveCategories: ReturnType<typeof listIptvCategories>;
  movieCategories: [];
  seriesCategories: [];
};

export async function loginIptvServer(creds: XtreamCredentials, origin: string): Promise<IptvLoginPayload> {
  await verifyXtreamLogin(creds).catch(() => undefined);

  const { live, source } = await loadLive(creds);
  if (!live.length) {
    throw new Error("Playlist is empty");
  }

  const sessionId = createIptvSession(live, creds, origin);
  const liveCategories = listIptvCategories(live);

  return {
    sessionId,
    host: creds.host,
    username: creds.username,
    label: creds.username,
    source,
    totals: { live: live.length, movies: null, series: null },
    liveCategories,
    movieCategories: [],
    seriesCategories: [],
  };
}

/** Fast device connect — verifies creds and defers full live catalog load. */
export async function loginIptvServerFast(creds: XtreamCredentials, origin: string): Promise<IptvLoginPayload> {
  await verifyXtreamLogin(creds);

  const liveCategoryMeta = await fetchXtreamLiveCategories(creds);
  const sessionId = createIptvSession([], creds, origin, liveCategoryMeta);
  const liveCategories = categoriesFromXtream(liveCategoryMeta, null, 0);

  return {
    sessionId,
    host: creds.host,
    username: creds.username,
    label: creds.username,
    source: "api",
    totals: { live: liveCategories.length, movies: null, series: null },
    liveCategories,
    movieCategories: [],
    seriesCategories: [],
  };
}
