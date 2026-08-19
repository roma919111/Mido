export type IptvKind = "live" | "movie" | "series";

export type IptvChannel = {
  id: string;
  name: string;
  group: string | null;
  logo: string | null;
  url: string;
  kind?: IptvKind;
  seriesId?: number;
};

export type IptvCategory = {
  id: string;
  name: string;
  count: number;
};

export type IptvCredentials = {
  host: string;
  username: string;
  password: string;
};

export type IptvLoginResult = {
  sessionId: string;
  host: string;
  username: string;
  label: string;
  totals: { live: number; movies: number | null; series: number | null };
  liveCategories: IptvCategory[];
  movieCategories: IptvCategory[];
  seriesCategories: IptvCategory[];
};

export type IptvChannelPage = {
  kind?: IptvKind;
  loading?: boolean;
  categories?: IptvCategory[];
  channels: IptvChannel[];
  total: number;
  hasMore: boolean;
  offset: number;
};

const STORAGE_KEY = "max.iptv.credentials";
const SESSION_KEY = "max.iptv.session";

type IptvSessionRestorer = (oldSessionId: string) => Promise<string | null>;
type SessionListener = (sessionId: string) => void;

let activeSessionId = "";
let sessionRestorer: IptvSessionRestorer | null = null;
const sessionListeners = new Set<SessionListener>();
let restoreInFlight: Promise<string | null> | null = null;

export function bindIptvSession(sessionId: string, restore?: IptvSessionRestorer) {
  activeSessionId = sessionId;
  if (restore) sessionRestorer = restore;
  if (sessionId) saveSessionId(sessionId);
}

export function subscribeIptvSession(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function publishSession(sessionId: string) {
  activeSessionId = sessionId;
  saveSessionId(sessionId);
  sessionListeners.forEach((listener) => listener(sessionId));
}

function isSessionExpired(status: number, error?: string): boolean {
  if (status === 401) return true;
  return /expired|login again|you should login|انتهت الجلسة/i.test(error ?? "");
}

async function restoreSession(oldSessionId: string): Promise<string | null> {
  if (!sessionRestorer) return null;
  if (!restoreInFlight) {
    restoreInFlight = sessionRestorer(oldSessionId)
      .then((next) => {
        if (next) publishSession(next);
        return next;
      })
      .finally(() => {
        restoreInFlight = null;
      });
  }
  return restoreInFlight;
}

async function iptvJson<T>(buildUrl: (sessionId: string) => string): Promise<T> {
  let sessionId = activeSessionId;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(buildUrl(sessionId), { cache: "no-store" });
    const data = (await res.json()) as T & { error?: string };
    if (res.ok) return data;
    if (attempt === 0 && isSessionExpired(res.status, data.error)) {
      const next = await restoreSession(sessionId);
      if (next) {
        sessionId = next;
        continue;
      }
    }
    throw new Error(data.error ?? "Failed to load");
  }
  throw new Error("انتهت الجلسة");
}

export function getSavedCredentials(): IptvCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IptvCredentials) : null;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: IptvCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function saveSessionId(sessionId: string): void {
  localStorage.setItem(SESSION_KEY, sessionId);
}

export async function loginIptv(creds: IptvCredentials): Promise<IptvLoginResult> {
  const res = await fetch("/api/iptv/playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
    cache: "no-store",
  });

  const data = (await res.json()) as IptvLoginResult & {
    error?: string;
    categories?: IptvCategory[];
    total?: number;
  };
  if (!res.ok) throw new Error(data.error ?? "Login failed");

  saveCredentials(creds);
  saveSessionId(data.sessionId);
  bindIptvSession(data.sessionId);

  return {
    sessionId: data.sessionId,
    host: data.host,
    username: data.username,
    label: data.label ?? data.username,
    totals: data.totals ?? { live: data.total ?? 0, movies: null, series: null },
    liveCategories: data.liveCategories ?? data.categories ?? [],
    movieCategories: data.movieCategories ?? [],
    seriesCategories: data.seriesCategories ?? [],
  };
}

export async function fetchIptvChannels(params: {
  sessionId: string;
  kind: IptvKind;
  categoryId?: string;
  search?: string;
  offset?: number;
  limit?: number;
}): Promise<IptvChannelPage> {
  if (!activeSessionId) activeSessionId = params.sessionId;
  return iptvJson<IptvChannelPage>((sessionId) => {
    const q = new URLSearchParams({
      session: sessionId,
      type: params.kind,
      offset: String(params.offset ?? 0),
      limit: String(params.limit ?? 48),
    });
    if (params.categoryId) {
      q.set("category", params.categoryId);
    }
    if (params.search && params.search.trim().length >= 2) {
      q.set("q", params.search.trim());
    }
    return `/api/iptv/channels?${q}`;
  });
}

export type IptvRow = {
  id: string;
  title: string;
  channels: IptvChannel[];
};

export async function fetchIptvRows(sessionId: string, kind: IptvKind): Promise<{ rows: IptvRow[]; loading?: boolean }> {
  if (!activeSessionId) activeSessionId = sessionId;
  const data = await iptvJson<{ rows?: IptvRow[]; loading?: boolean }>(
    (sid) => `/api/iptv/rows?session=${encodeURIComponent(sid)}&type=${kind}`,
  );
  return { rows: data.rows ?? [], loading: data.loading };
}

export async function resolveSeriesPlay(
  sessionId: string,
  seriesId: number,
  episodeId?: string,
): Promise<{ url: string; title: string }> {
  if (!activeSessionId) activeSessionId = sessionId;
  const data = await iptvJson<{ url?: string; title?: string }>((sid) => {
    const q = new URLSearchParams({
      session: sid,
      seriesId: String(seriesId),
    });
    if (episodeId) q.set("episodeId", episodeId);
    return `/api/iptv/series?${q}`;
  });
  return { url: data.url ?? "", title: data.title ?? "Series" };
}

export type IptvCatalogDetailsMeta = {
  plot: string | null;
  genre: string | null;
  director: string | null;
  cast: string | null;
  rating: string | null;
  year: string | null;
  duration?: string | null;
  cover: string | null;
  title: string;
};

export type IptvMovieDetails = IptvCatalogDetailsMeta & {
  vodId: number;
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

export type IptvSeriesDetails = IptvCatalogDetailsMeta & {
  seriesId: number;
  seasons: IptvSeriesSeason[];
};

export async function fetchIptvMovieDetails(sessionId: string, vodId: number): Promise<IptvMovieDetails> {
  if (!activeSessionId) activeSessionId = sessionId;
  return iptvJson<IptvMovieDetails>(
    (sid) => `/api/iptv/info?session=${encodeURIComponent(sid)}&type=movie&id=${vodId}`,
  );
}

export async function fetchIptvSeriesDetails(sessionId: string, seriesId: number): Promise<IptvSeriesDetails> {
  if (!activeSessionId) activeSessionId = sessionId;
  return iptvJson<IptvSeriesDetails>(
    (sid) => `/api/iptv/info?session=${encodeURIComponent(sid)}&type=series&id=${seriesId}`,
  );
}

export async function fetchIptvHome(sessionId: string): Promise<IptvHomeDashboard> {
  if (!activeSessionId) activeSessionId = sessionId;
  return iptvJson<IptvHomeDashboard>((sid) => `/api/iptv/home?session=${encodeURIComponent(sid)}`);
}

export async function pingIptvSession(sessionId: string): Promise<boolean> {
  if (!activeSessionId) activeSessionId = sessionId;
  try {
    await iptvJson<{ ok?: boolean }>((sid) => `/api/iptv/session/ping?session=${encodeURIComponent(sid)}`);
    return true;
  } catch {
    return false;
  }
}

export type IptvHomeDashboard = {
  account: {
    username: string;
    status: string;
    statusLabel: string;
    expDate: string | null;
    expLabel: string;
    daysLeft: number | null;
    isTrial: boolean;
    connections: string | null;
  };
  latestMovies: { title: string; items: IptvChannel[] };
  latestSeries: { title: string; items: IptvChannel[] };
  matches: Array<{
    id: string;
    title: string;
    channelName: string;
    startAt: number;
    timeLabel: string;
    dayLabel: string;
    logo: string | null;
    homeLogo?: string | null;
    awayLogo?: string | null;
    live?: boolean;
    channel: IptvChannel | null;
  }>;
}
