export type XtreamCredentials = {
  host: string;
  username: string;
  password: string;
};

export type IptvKind = "live" | "movie" | "series";

export type XtreamCategory = {
  id: string;
  name: string;
};

export type XtreamChannel = {
  id: string;
  name: string;
  group: string | null;
  categoryId: string | null;
  logo: string | null;
  url: string;
  kind: IptvKind;
  seriesId?: number;
};

export function normalizeHost(host: string): string {
  let h = host.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(h)) h = `http://${h}`;
  // Xtream panels on custom ports (e.g. :2052) usually only serve HTTP.
  if (/^https:\/\/[^/]+:\d+/i.test(h)) {
    h = h.replace(/^https:\/\//i, "http://");
  }
  return h;
}

export function xtreamHostFallbacks(host: string): string[] {
  const primary = normalizeHost(host);
  const swapped = primary.startsWith("https://")
    ? `http://${primary.slice("https://".length)}`
    : `https://${primary.slice("http://".length)}`;
  return swapped === primary ? [primary] : [primary, swapped];
}

const XTREAM_UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";

export function buildM3uPlusUrl(creds: XtreamCredentials): string {
  const base = normalizeHost(creds.host);
  const params = new URLSearchParams({
    username: creds.username.trim(),
    password: creds.password,
    type: "m3u_plus",
  });
  return `${base}/get.php?${params}`;
}

export function buildPlayerApiUrl(creds: XtreamCredentials): string {
  const base = normalizeHost(creds.host);
  const params = new URLSearchParams({
    username: creds.username.trim(),
    password: creds.password,
  });
  return `${base}/player_api.php?${params}`;
}

export type XtreamAccountInfo = {
  user_info?: {
    auth?: number;
    status?: string;
    exp_date?: string;
    username?: string;
    max_connections?: string | number;
    active_cons?: string | number;
    is_trial?: string | number;
    created_at?: string;
  };
  server_info?: {
    timezone?: string;
  };
};

export async function verifyXtreamLogin(creds: XtreamCredentials): Promise<XtreamAccountInfo> {
  const url = buildPlayerApiUrl(creds);
  const res = await fetch(url, {
    headers: { "User-Agent": XTREAM_UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
  const data = (await readXtreamJson(res)) as XtreamAccountInfo;
  if (data.user_info?.auth === 0) throw new Error("Invalid username or password");
  return data;
}

type XtreamCategoryRow = { category_id?: string; category_name?: string };
type XtreamStreamRow = {
  stream_id?: number;
  series_id?: number;
  name?: string;
  stream_icon?: string;
  cover?: string;
  category_id?: string;
  category_name?: string;
  container_extension?: string;
  added?: string;
};

type XtreamEpisodeRow = {
  id?: string;
  title?: string;
  episode_num?: number;
  container_extension?: string;
  info?: {
    movie_image?: string;
    plot?: string;
    duration?: string | number;
  };
};

type XtreamSeriesInfo = {
  info?: {
    name?: string;
    cover?: string;
    plot?: string;
    genre?: string;
    director?: string;
    cast?: string;
    rating?: string;
    releaseDate?: string;
    releasedate?: string;
  };
  episodes?: Record<string, XtreamEpisodeRow[]>;
};

type XtreamVodInfo = {
  info?: {
    name?: string;
    movie_image?: string;
    plot?: string;
    genre?: string;
    director?: string;
    cast?: string;
    rating?: string;
    releasedate?: string;
    releaseDate?: string;
    duration?: string;
    container_extension?: string;
  };
  movie_data?: {
    stream_id?: number;
    name?: string;
    container_extension?: string;
  };
};

export type IptvVodDetails = {
  vodId: number;
  title: string;
  plot: string | null;
  genre: string | null;
  director: string | null;
  cast: string | null;
  rating: string | null;
  year: string | null;
  duration: string | null;
  cover: string | null;
  playUrl: string;
};

export type IptvSeriesEpisode = {
  id: string;
  episodeNum: number;
  title: string;
  duration: string | null;
  cover: string | null;
  plot: string | null;
  playUrl: string;
};

export type IptvSeriesSeason = {
  season: string;
  name: string;
  episodes: IptvSeriesEpisode[];
};

export type IptvSeriesDetails = {
  seriesId: number;
  title: string;
  plot: string | null;
  genre: string | null;
  director: string | null;
  cast: string | null;
  rating: string | null;
  year: string | null;
  cover: string | null;
  seasons: IptvSeriesSeason[];
};

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function yearFromDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  return match?.[0] ?? null;
}

function assertSafeHost(host: string): void {
  const base = normalizeHost(host);
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(base)) {
    throw new Error("Host not allowed");
  }
}

async function readXtreamJson(res: Response): Promise<unknown> {
  const text = (await res.text()).replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("Empty Xtream response");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("تعذّر قراءة رد لوحة البث");
  }
}

function coerceXtreamRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== "object") return [];
  const rec = data as Record<string, unknown>;
  for (const key of ["categories", "available_categories", "streams", "movies", "series"]) {
    if (Array.isArray(rec[key])) return rec[key] as T[];
  }
  const values = Object.values(rec).filter((row) => row && typeof row === "object");
  if (
    values.length &&
    values.every((row) => {
      const item = row as Record<string, unknown>;
      return "category_id" in item || "stream_id" in item || "series_id" in item || "name" in item;
    })
  ) {
    return values as T[];
  }
  return [];
}

async function fetchXtreamAction<T>(
  creds: XtreamCredentials,
  action: string,
  extra?: Record<string, string>,
): Promise<T> {
  const params = new URLSearchParams({
    username: creds.username.trim(),
    password: creds.password,
    action,
    ...extra,
  });
  const url = `${normalizeHost(creds.host)}/player_api.php?${params}`;
  assertSafeHost(creds.host);
  const res = await fetch(url, {
    headers: { "User-Agent": XTREAM_UA, Accept: "application/json, text/plain, */*" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Xtream API failed (${res.status})`);
  const data = (await readXtreamJson(res)) as T & {
    user_info?: { auth?: number; message?: string };
    message?: string;
  };
  const message = data?.user_info?.message || data?.message || "";
  if (data?.user_info?.auth === 0 || /expired|you should login/i.test(message)) {
    throw new Error("تعذّر الاتصال بالبث — أعد المحاولة دون الحاجة لتحديث الصفحة");
  }
  return data as T;
}

function buildCategoryMap(rows: XtreamCategoryRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const cat of rows) {
    if (cat.category_id) map.set(String(cat.category_id), cat.category_name ?? "Other");
  }
  return map;
}

function buildLiveStreamUrl(creds: XtreamCredentials, streamId: number): string {
  const base = normalizeHost(creds.host);
  return `${base}/live/${encodeURIComponent(creds.username.trim())}/${encodeURIComponent(creds.password)}/${streamId}.ts`;
}

function buildVodStreamUrl(creds: XtreamCredentials, streamId: number, ext = "mp4"): string {
  const base = normalizeHost(creds.host);
  return `${base}/movie/${encodeURIComponent(creds.username.trim())}/${encodeURIComponent(creds.password)}/${streamId}.${ext}`;
}

function buildSeriesEpisodeUrl(creds: XtreamCredentials, episodeId: string, ext = "mp4"): string {
  const base = normalizeHost(creds.host);
  return `${base}/series/${encodeURIComponent(creds.username.trim())}/${encodeURIComponent(creds.password)}/${episodeId}.${ext}`;
}

function mapCategoryRows(rows: XtreamCategoryRow[]): XtreamCategory[] {
  return rows
    .filter((row) => row.category_id)
    .map((row) => ({
      id: String(row.category_id),
      name: row.category_name?.trim() || "Other",
    }));
}

export async function fetchXtreamLiveCategories(creds: XtreamCredentials): Promise<XtreamCategory[]> {
  const rows = coerceXtreamRows<XtreamCategoryRow>(
    await fetchXtreamAction<unknown>(creds, "get_live_categories").catch(() => []),
  );
  return mapCategoryRows(rows);
}

export async function fetchXtreamVodCategories(creds: XtreamCredentials): Promise<XtreamCategory[]> {
  const rows = coerceXtreamRows<XtreamCategoryRow>(
    await fetchXtreamAction<unknown>(creds, "get_vod_categories").catch(() => []),
  );
  return mapCategoryRows(rows).sort((a, b) => {
    const pa = categorySortKey(a.name, "movie");
    const pb = categorySortKey(b.name, "movie");
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, "ar");
  });
}

export async function fetchXtreamSeriesCategories(creds: XtreamCredentials): Promise<XtreamCategory[]> {
  const rows = coerceXtreamRows<XtreamCategoryRow>(
    await fetchXtreamAction<unknown>(creds, "get_series_categories").catch(() => []),
  );
  return mapCategoryRows(rows).sort((a, b) => {
    const pa = categorySortKey(a.name, "series");
    const pb = categorySortKey(b.name, "series");
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, "ar");
  });
}

function categorySortKey(name: string, kind: IptvKind): number {
  const n = name.toUpperCase();
  if (kind === "movie") {
    if (n.includes("2026")) return 0;
    if (n.includes("2025")) return 1;
    if (n.includes("NETFLIX") || n.includes("نتف")) return 2;
    return 10;
  }
  if (n.includes("2026")) return 0;
  if (n.includes("2025")) return 1;
  if (n.includes("NETFLIX")) return 2;
  return 10;
}

export async function fetchXtreamLive(creds: XtreamCredentials): Promise<XtreamChannel[]> {
  const categoryNames = buildCategoryMap(
    await fetchXtreamAction<XtreamCategoryRow[]>(creds, "get_live_categories").catch(
      () => [] as XtreamCategoryRow[],
    ),
  );
  const rows = await fetchXtreamAction<XtreamStreamRow[]>(creds, "get_live_streams");

  return rows.map((row) => {
    const streamId = row.stream_id ?? 0;
    const catId = row.category_id ? String(row.category_id) : null;
    const group = row.category_name ?? (catId ? categoryNames.get(catId) ?? "Live" : "Live");
    return {
      id: `live-${streamId}`,
      name: row.name?.trim() || `Channel ${streamId}`,
      group,
      categoryId: catId ?? group,
      logo: row.stream_icon?.trim() || null,
      url: buildLiveStreamUrl(creds, streamId),
      kind: "live" as const,
    };
  });
}

export async function fetchXtreamLiveByCategory(
  creds: XtreamCredentials,
  categoryId: string,
  categoryName?: string,
): Promise<XtreamChannel[]> {
  const rows = await fetchXtreamAction<XtreamStreamRow[]>(creds, "get_live_streams", {
    category_id: categoryId,
  });
  const group = categoryName?.trim() || "Live";

  return rows.map((row) => {
    const streamId = row.stream_id ?? 0;
    return {
      id: `live-${streamId}`,
      name: row.name?.trim() || `Channel ${streamId}`,
      group,
      categoryId,
      logo: row.stream_icon?.trim() || null,
      url: buildLiveStreamUrl(creds, streamId),
      kind: "live" as const,
    };
  });
}

export type XtreamEpgEvent = {
  streamId: number;
  channelName: string;
  title: string;
  startAt: number;
  endAt: number | null;
};

function decodeEpgText(raw: string | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value) return "";
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8").trim();
    if (decoded && /[\u0600-\u06FFa-zA-Z0-9]/.test(decoded)) return decoded;
  } catch {
    /* keep raw */
  }
  return value;
}

function parseEpgTimestamp(value: string | number | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  const n = Number(value);
  if (Number.isFinite(n) && n > 1e8) {
    return n > 1e12 ? n : n * 1000;
  }
  const parsed = Date.parse(String(value).replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchXtreamShortEpg(
  creds: XtreamCredentials,
  streamId: number,
  limit = 8,
): Promise<Array<{ title: string; startAt: number; endAt: number | null }>> {
  const data = await fetchXtreamAction<{
    epg_listings?: Array<{
      title?: string;
      start?: string;
      end?: string;
      stop?: string;
      start_timestamp?: string | number;
      stop_timestamp?: string | number;
    }>;
  }>(creds, "get_short_epg", { stream_id: String(streamId), limit: String(limit) }).catch(() => ({
    epg_listings: [],
  }));

  return (data.epg_listings ?? [])
    .map((row) => ({
      title: decodeEpgText(row.title),
      startAt: parseEpgTimestamp(row.start_timestamp ?? row.start) ?? 0,
      endAt: parseEpgTimestamp(row.stop_timestamp ?? row.end ?? row.stop),
    }))
    .filter((row) => row.title && row.startAt);
}

export async function fetchXtreamMoviesByCategory(
  creds: XtreamCredentials,
  categoryId: string,
): Promise<XtreamChannel[]> {
  const categoryNames = buildCategoryMap(
    await fetchXtreamAction<XtreamCategoryRow[]>(creds, "get_vod_categories").catch(
      () => [] as XtreamCategoryRow[],
    ),
  );
  const rows = await fetchXtreamAction<XtreamStreamRow[]>(creds, "get_vod_streams", {
    category_id: categoryId,
  });
  const group = categoryNames.get(categoryId) ?? "Movies";

  return rows.map((row) => {
    const streamId = row.stream_id ?? 0;
    const ext = row.container_extension?.trim() || "mp4";
    return {
      id: `movie-${streamId}`,
      name: row.name?.trim() || `Movie ${streamId}`,
      group,
      categoryId,
      logo: row.stream_icon?.trim() || null,
      url: buildVodStreamUrl(creds, streamId, ext),
      kind: "movie" as const,
    };
  });
}

export async function fetchXtreamSeriesByCategory(
  creds: XtreamCredentials,
  categoryId: string,
): Promise<XtreamChannel[]> {
  const categoryNames = buildCategoryMap(
    await fetchXtreamAction<XtreamCategoryRow[]>(creds, "get_series_categories").catch(
      () => [] as XtreamCategoryRow[],
    ),
  );
  const rows = await fetchXtreamAction<XtreamStreamRow[]>(creds, "get_series", {
    category_id: categoryId,
  });
  const group = categoryNames.get(categoryId) ?? "Series";

  return rows.map((row) => {
    const seriesId = row.series_id ?? row.stream_id ?? 0;
    return {
      id: `series-${seriesId}`,
      name: row.name?.trim() || `Series ${seriesId}`,
      group,
      categoryId,
      logo: (row.cover ?? row.stream_icon)?.trim() || null,
      url: "",
      kind: "series" as const,
      seriesId,
    };
  });
}

/** Resolve first episode URL for series playback. */
export async function resolveSeriesPlayUrl(
  creds: XtreamCredentials,
  seriesId: number,
  episodeId?: string,
): Promise<{ url: string; title: string } | null> {
  const info = await fetchXtreamAction<XtreamSeriesInfo>(creds, "get_series_info", {
    series_id: String(seriesId),
  });

  const seasons = info.episodes ?? {};
  const seasonKeys = Object.keys(seasons).sort((a, b) => Number(a) - Number(b));
  const seriesTitle = info.info?.name ?? `Series ${seriesId}`;

  for (const key of seasonKeys) {
    const eps = seasons[key] ?? [];
    const sorted = [...eps].sort((a, b) => (a.episode_num ?? 0) - (b.episode_num ?? 0));
    const match = episodeId ? sorted.find((ep) => String(ep.id) === episodeId) : sorted[0];
    const first = match ?? (episodeId ? undefined : sorted[0]);
    if (first?.id) {
      const ext = first.container_extension?.trim() || "mp4";
      const epLabel = first.title?.trim() || `S${key}E${first.episode_num ?? 1}`;
      return {
        url: buildSeriesEpisodeUrl(creds, String(first.id), ext),
        title: `${seriesTitle} · ${epLabel}`,
      };
    }
  }
  return null;
}

const DETAILS_TTL_MS = 20 * 60 * 1000;
const vodDetailsCache = new Map<string, { at: number; data: IptvVodDetails }>();
const seriesDetailsCache = new Map<string, { at: number; data: IptvSeriesDetails }>();

function detailsCacheKey(creds: XtreamCredentials, kind: string, id: number): string {
  return `${normalizeHost(creds.host)}|${creds.username.trim()}|${kind}|${id}`;
}

export async function fetchXtreamVodDetails(
  creds: XtreamCredentials,
  vodId: number,
): Promise<IptvVodDetails> {
  const key = detailsCacheKey(creds, "movie", vodId);
  const cached = vodDetailsCache.get(key);
  if (cached && Date.now() - cached.at < DETAILS_TTL_MS) return cached.data;

  const info = await fetchXtreamAction<XtreamVodInfo>(creds, "get_vod_info", {
    vod_id: String(vodId),
  }).catch(() => ({} as XtreamVodInfo));

  const ext = info.movie_data?.container_extension?.trim() || info.info?.container_extension?.trim() || "mp4";
  const streamId = info.movie_data?.stream_id ?? vodId;

  const data: IptvVodDetails = {
    vodId,
    title: textOrNull(info.movie_data?.name) || textOrNull(info.info?.name) || `Movie ${vodId}`,
    plot: textOrNull(info.info?.plot),
    genre: textOrNull(info.info?.genre),
    director: textOrNull(info.info?.director),
    cast: textOrNull(info.info?.cast),
    rating: textOrNull(info.info?.rating),
    year: yearFromDate(textOrNull(info.info?.releasedate) || textOrNull(info.info?.releaseDate)),
    duration: textOrNull(info.info?.duration),
    cover: textOrNull(info.info?.movie_image),
    playUrl: buildVodStreamUrl(creds, streamId, ext),
  };
  vodDetailsCache.set(key, { at: Date.now(), data });
  return data;
}

export async function fetchXtreamSeriesDetails(
  creds: XtreamCredentials,
  seriesId: number,
): Promise<IptvSeriesDetails> {
  const key = detailsCacheKey(creds, "series", seriesId);
  const cached = seriesDetailsCache.get(key);
  if (cached && Date.now() - cached.at < DETAILS_TTL_MS) return cached.data;
  const info = await fetchXtreamAction<XtreamSeriesInfo>(creds, "get_series_info", {
    series_id: String(seriesId),
  });

  const seriesTitle = textOrNull(info.info?.name) || `Series ${seriesId}`;
  const seasonsMap = info.episodes ?? {};
  const seasons: IptvSeriesSeason[] = Object.keys(seasonsMap)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => {
      const eps = [...(seasonsMap[key] ?? [])].sort((a, b) => (a.episode_num ?? 0) - (b.episode_num ?? 0));
      return {
        season: key,
        name: `الموسم ${key}`,
        episodes: eps
          .filter((ep) => ep.id)
          .map((ep) => {
            const ext = ep.container_extension?.trim() || "mp4";
            const episodeNum = ep.episode_num ?? 0;
            const title = ep.title?.trim() || `الحلقة ${episodeNum || ""}`.trim();
            return {
              id: String(ep.id),
              episodeNum,
              title,
              duration: ep.info?.duration != null ? String(ep.info.duration) : null,
              cover: textOrNull(ep.info?.movie_image),
              plot: textOrNull(ep.info?.plot),
              playUrl: buildSeriesEpisodeUrl(creds, String(ep.id), ext),
            };
          }),
      };
    })
    .filter((season) => season.episodes.length);

  const data: IptvSeriesDetails = {
    seriesId,
    title: seriesTitle,
    plot: textOrNull(info.info?.plot),
    genre: textOrNull(info.info?.genre),
    director: textOrNull(info.info?.director),
    cast: textOrNull(info.info?.cast),
    rating: textOrNull(info.info?.rating),
    year: yearFromDate(textOrNull(info.info?.releaseDate) || textOrNull(info.info?.releasedate)),
    cover: textOrNull(info.info?.cover),
    seasons,
  };
  seriesDetailsCache.set(key, { at: Date.now(), data });
  return data;
}

/** @deprecated use fetchXtreamLive */
export async function fetchXtreamChannels(creds: XtreamCredentials): Promise<XtreamChannel[]> {
  return fetchXtreamLive(creds);
}
