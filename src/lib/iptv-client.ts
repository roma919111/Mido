export type IptvChannel = {
  id: string;
  name: string;
  group: string | null;
  logo: string | null;
  url: string;
};

export type IptvCredentials = {
  host: string;
  username: string;
  password: string;
};

export type IptvPlaylist = {
  host: string;
  username: string;
  label: string;
  channels: IptvChannel[];
};

const STORAGE_KEY = "max.iptv.credentials";

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
}

export async function loadPlaylist(creds: IptvCredentials): Promise<IptvPlaylist> {
  const res = await fetch("/api/iptv/playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
    cache: "no-store",
  });

  const data = (await res.json()) as IptvPlaylist & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Login failed");
  }

  saveCredentials(creds);
  return data;
}
