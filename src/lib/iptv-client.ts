export type IptvChannel = {
  id: string;
  name: string;
  group: string | null;
  logo: string | null;
  url: string;
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
  total: number;
  categories: IptvCategory[];
};

export type IptvChannelPage = {
  channels: IptvChannel[];
  total: number;
  hasMore: boolean;
  offset: number;
};

const STORAGE_KEY = "max.iptv.credentials";
const SESSION_KEY = "max.iptv.session";

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

export function getSavedSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export async function loginIptv(creds: IptvCredentials): Promise<IptvLoginResult> {
  const res = await fetch("/api/iptv/playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
    cache: "no-store",
  });

  const data = (await res.json()) as IptvLoginResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Login failed");

  saveCredentials(creds);
  saveSessionId(data.sessionId);
  return data;
}

export async function fetchIptvChannels(params: {
  sessionId: string;
  categoryId?: string;
  search?: string;
  offset?: number;
  limit?: number;
}): Promise<IptvChannelPage> {
  const q = new URLSearchParams({
    session: params.sessionId,
    offset: String(params.offset ?? 0),
    limit: String(params.limit ?? 60),
  });
  if (params.categoryId && params.categoryId !== "all") {
    q.set("category", params.categoryId);
  }
  if (params.search && params.search.trim().length >= 2) {
    q.set("q", params.search.trim());
  }

  const res = await fetch(`/api/iptv/channels?${q}`, { cache: "no-store" });
  const data = (await res.json()) as IptvChannelPage & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to load channels");
  return data;
}

export type IptvRow = {
  id: string;
  title: string;
  channels: IptvChannel[];
};

export async function fetchIptvRows(sessionId: string): Promise<IptvRow[]> {
  const res = await fetch(`/api/iptv/rows?session=${encodeURIComponent(sessionId)}`, {
    cache: "no-store",
  });
  const data = (await res.json()) as { rows?: IptvRow[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to load rows");
  return data.rows ?? [];
}
