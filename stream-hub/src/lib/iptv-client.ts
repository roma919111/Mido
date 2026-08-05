export type IptvChannel = {
  id: string;
  name: string;
  group: string | null;
  logo: string | null;
  url: string;
};

export type IptvPlaylist = {
  code: string;
  label: string | null;
  channels: IptvChannel[];
};

const CODE_KEY = "max.iptv.code";
const LABEL_KEY = "max.iptv.label";

function apiBase(): string {
  const raw =
    import.meta.env.VITE_IPTV_API?.trim() ||
    import.meta.env.VITE_ACTIVATION_API?.replace(/\/activate\/?$/, "/iptv") ||
    "";
  return raw.replace(/\/$/, "");
}

export function getSavedCode(): string | null {
  return localStorage.getItem(CODE_KEY);
}

export function saveCode(code: string, label?: string | null): void {
  localStorage.setItem(CODE_KEY, code);
  if (label) localStorage.setItem(LABEL_KEY, label);
}

export function clearSavedCode(): void {
  localStorage.removeItem(CODE_KEY);
  localStorage.removeItem(LABEL_KEY);
}

export function getSavedLabel(): string | null {
  return localStorage.getItem(LABEL_KEY);
}

export async function loadPlaylist(code: string): Promise<IptvPlaylist> {
  const base = apiBase();
  if (!base) {
    throw new Error("السيرفر غير مربوط — تواصل مع المزود");
  }

  const res = await fetch(`${base}/playlist?code=${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
  const data = (await res.json()) as IptvPlaylist & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to load playlist");

  // Make proxy URLs absolute when API returns relative paths
  const origin = new URL(base).origin;
  const channels = data.channels.map((c) => ({
    ...c,
    url: c.url.startsWith("http") ? c.url : `${origin}${c.url}`,
  }));

  return { ...data, channels };
}

export function resolveApiOrigin(): string | null {
  const base = apiBase();
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}
