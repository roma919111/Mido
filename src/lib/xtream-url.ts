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
