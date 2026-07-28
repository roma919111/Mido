/**
 * Client-side Assets library cache.
 * Lets BottomNav warm the list so /assets paints instantly on navigate.
 */

export type CachedAssetItem = {
  id: string;
  mediaType: "image" | "video";
  url: string;
  prompt: string;
  mode?: string;
  model: string;
  creditsUsed: number;
  status: string;
  createdAt: string;
  historyId?: string;
  error?: string;
  targetSeconds?: number;
  referenceImages?: import("@/lib/types").VisualReference[];
};

type AssetsCachePayload = {
  assets: CachedAssetItem[];
  savedAt: number;
};

const MEMORY_KEY = "__vyronix_assets_cache_v1";
const STORAGE_KEY = "vyronix-assets-cache-v1";
const MAX_AGE_MS = 5 * 60 * 1000;

type MemoryStore = {
  payload: AssetsCachePayload | null;
};

function memory(): MemoryStore {
  const g = globalThis as typeof globalThis & { [MEMORY_KEY]?: MemoryStore };
  if (!g[MEMORY_KEY]) g[MEMORY_KEY] = { payload: null };
  return g[MEMORY_KEY];
}

function isFresh(payload: AssetsCachePayload | null | undefined): boolean {
  if (!payload?.assets) return false;
  return Date.now() - payload.savedAt < MAX_AGE_MS;
}

export function readAssetsCache(): CachedAssetItem[] | null {
  const mem = memory().payload;
  if (isFresh(mem)) return mem!.assets;

  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AssetsCachePayload;
    if (!isFresh(parsed)) return null;
    memory().payload = parsed;
    return parsed.assets;
  } catch {
    return null;
  }
}

export function writeAssetsCache(assets: CachedAssetItem[]): void {
  const payload: AssetsCachePayload = {
    assets,
    savedAt: Date.now(),
  };
  memory().payload = payload;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode — memory cache still helps
  }
}

export function clearAssetsCache(): void {
  memory().payload = null;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Warm first video posters so the feed shows frames immediately. */
export function warmAssetPosters(
  assets: CachedAssetItem[],
  buildPoster: (item: CachedAssetItem) => string | null,
  limit = 1,
): void {
  if (typeof window === "undefined") return;
  const videos = assets
    .filter(
      (a) =>
        a.mediaType === "video" &&
        a.mode !== "sequence-part" &&
        a.status === "completed" &&
        a.url,
    )
    .slice(0, limit);

  // Stagger so poster generation does not compete with the active video stream.
  videos.forEach((item, i) => {
    window.setTimeout(() => {
      const poster = buildPoster(item);
      if (!poster) return;
      const img = new Image();
      img.decoding = "async";
      img.src = poster;
    }, i * 700);
  });
}
