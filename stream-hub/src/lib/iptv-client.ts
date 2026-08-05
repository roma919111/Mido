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
  const configured = import.meta.env.VITE_IPTV_API?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const legacy = import.meta.env.VITE_ACTIVATION_API?.replace(/\/activate\/?$/, "/iptv");
  if (legacy) return legacy.replace(/\/$/, "");

  // Local dev: Vite proxies /api/max → localhost:3000
  if (import.meta.env.DEV) return "/api/max/iptv";

  return "";
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
    throw new Error("السيرفر غير مربوط — المزود لم يضبط التطبيق بعد");
  }

  let res: Response;
  try {
    res = await fetch(`${base}/playlist?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
  } catch {
    throw new Error("تعذر الاتصال بالسيرفر — تأكد أن المزود شغّل السيرفر");
  }

  let data: IptvPlaylist & { error?: string };
  try {
    data = (await res.json()) as IptvPlaylist & { error?: string };
  } catch {
    throw new Error("استجابة غير صالحة من السيرفر");
  }

  if (!res.ok) {
    throw new Error(data.error ?? "فشل التفعيل — تحقق من الكود");
  }

  const origin = base.startsWith("http") ? new URL(base).origin : window.location.origin;
  const channels = data.channels.map((c) => ({
    ...c,
    url: c.url.startsWith("http") ? c.url : `${origin}${c.url}`,
  }));

  return { ...data, channels };
}

export function isDevMode(): boolean {
  return import.meta.env.DEV;
}
