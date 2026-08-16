export type XtreamCredentials = {
  host: string;
  username: string;
  password: string;
};

export function normalizeHost(host: string): string {
  let h = host.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(h)) h = `http://${h}`;
  return h;
}

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
  };
};

export async function verifyXtreamLogin(creds: XtreamCredentials): Promise<XtreamAccountInfo> {
  const url = buildPlayerApiUrl(creds);
  const res = await fetch(url, {
    headers: { "User-Agent": "MAX-IPTV/1.0", Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
  const data = (await res.json()) as XtreamAccountInfo;
  if (data.user_info?.auth === 0) throw new Error("Invalid username or password");
  return data;
}

type XtreamStreamRow = {
  stream_id?: number;
  name?: string;
  stream_icon?: string;
  category_id?: string;
  category_name?: string;
  series_id?: number;
};

export type XtreamChannel = {
  id: string;
  name: string;
  group: string | null;
  logo: string | null;
  url: string;
};

function buildLiveStreamUrl(creds: XtreamCredentials, streamId: number): string {
  const base = normalizeHost(creds.host);
  return `${base}/live/${encodeURIComponent(creds.username.trim())}/${encodeURIComponent(creds.password)}/${streamId}.ts`;
}

function buildVodStreamUrl(creds: XtreamCredentials, streamId: number, ext = "mp4"): string {
  const base = normalizeHost(creds.host);
  return `${base}/movie/${encodeURIComponent(creds.username.trim())}/${encodeURIComponent(creds.password)}/${streamId}.${ext}`;
}

async function fetchXtreamAction<T>(creds: XtreamCredentials, action: string): Promise<T> {
  const url = `${buildPlayerApiUrl(creds)}&action=${action}`;
  assertSafeHost(creds.host);
  const res = await fetch(url, {
    headers: { "User-Agent": "MAX-IPTV/1.0", Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Xtream API failed (${res.status})`);
  return (await res.json()) as T;
}

function assertSafeHost(host: string): void {
  const base = normalizeHost(host);
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(base)) {
    throw new Error("Host not allowed");
  }
}

/** Fast path: Xtream JSON API instead of huge M3U file. */
export async function fetchXtreamChannels(creds: XtreamCredentials): Promise<XtreamChannel[]> {
  const categories = await fetchXtreamAction<{ category_id?: string; category_name?: string }[]>(
    creds,
    "get_live_categories",
  ).catch(() => [] as { category_id?: string; category_name?: string }[]);

  const categoryNames = new Map<string, string>();
  for (const cat of categories) {
    if (cat.category_id) categoryNames.set(String(cat.category_id), cat.category_name ?? "Live");
  }

  const liveRows = await fetchXtreamAction<XtreamStreamRow[]>(creds, "get_live_streams");
  const channels: XtreamChannel[] = liveRows.map((row) => {
    const streamId = row.stream_id ?? 0;
    const catId = row.category_id ? String(row.category_id) : null;
    return {
      id: `live-${streamId}`,
      name: row.name?.trim() || `Channel ${streamId}`,
      group: row.category_name ?? (catId ? categoryNames.get(catId) ?? "Live" : "Live"),
      logo: row.stream_icon?.trim() || null,
      url: buildLiveStreamUrl(creds, streamId),
    };
  });

  if (channels.length) return channels;

  const vodRows = await fetchXtreamAction<XtreamStreamRow[]>(creds, "get_vod_streams").catch(
    () => [] as XtreamStreamRow[],
  );
  return vodRows.slice(0, 5000).map((row) => {
    const streamId = row.stream_id ?? 0;
    return {
      id: `vod-${streamId}`,
      name: row.name?.trim() || `Title ${streamId}`,
      group: row.category_name ?? "Movies",
      logo: row.stream_icon?.trim() || null,
      url: buildVodStreamUrl(creds, streamId),
    };
  });
}
