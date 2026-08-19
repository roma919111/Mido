import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { liveCategoryMatchScore, pickDefaultLiveCategoryId } from "@/lib/iptv-live-default";
import type { IptvKind, XtreamAccountInfo, XtreamCategory, XtreamChannel, XtreamCredentials } from "@/lib/xtream-url";
import {
  fetchXtreamLive,
  fetchXtreamLiveByCategory,
  fetchXtreamLiveCategories,
  fetchXtreamMoviesByCategory,
  fetchXtreamSeriesByCategory,
  fetchXtreamSeriesCategories,
  fetchXtreamVodCategories,
} from "@/lib/xtream-url";

export type IptvSessionCategory = {
  id: string;
  name: string;
  count: number;
};

type SessionRecord = {
  creds: XtreamCredentials;
  origin: string;
  expiresAt: number;
  live: XtreamChannel[];
  liveCategoryMeta: XtreamCategory[] | null;
  liveByCategory: Map<string, XtreamChannel[]>;
  liveLoading: Set<string>;
  vodCategories: XtreamCategory[] | null;
  seriesCategories: XtreamCategory[] | null;
  vodByCategory: Map<string, XtreamChannel[]>;
  seriesByCategory: Map<string, XtreamChannel[]>;
  vodLoading: Set<string>;
  seriesLoading: Set<string>;
  accountInfo?: XtreamAccountInfo;
};

type DiskSession = {
  creds: XtreamCredentials;
  origin: string;
  expiresAt: number;
  liveCategoryMeta: XtreamCategory[] | null;
};

const TTL_MS = 12 * 60 * 60 * 1000;
const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "iptv-sessions.json");
const sessions = new Map<string, SessionRecord>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function emptyCaches(): Pick<
  SessionRecord,
  | "liveByCategory"
  | "liveLoading"
  | "vodCategories"
  | "seriesCategories"
  | "vodByCategory"
  | "seriesByCategory"
  | "vodLoading"
  | "seriesLoading"
> {
  return {
    liveByCategory: new Map(),
    liveLoading: new Set(),
    vodCategories: null,
    seriesCategories: null,
    vodByCategory: new Map(),
    seriesByCategory: new Map(),
    vodLoading: new Set(),
    seriesLoading: new Set(),
  };
}

function hydrate(disk: DiskSession): SessionRecord {
  return {
    creds: disk.creds,
    origin: disk.origin,
    expiresAt: disk.expiresAt,
    live: [],
    liveCategoryMeta: disk.liveCategoryMeta,
    ...emptyCaches(),
  };
}

function readDisk(): Record<string, DiskSession> {
  try {
    if (!existsSync(FILE)) return {};
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as { sessions?: Record<string, DiskSession> };
    return parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {};
  } catch {
    return {};
  }
}

function writeDisk(dump: Record<string, DiskSession>) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ sessions: dump }, null, 2), "utf8");
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const now = Date.now();
    const dump: Record<string, DiskSession> = {};
    for (const [id, row] of sessions) {
      if (row.expiresAt <= now) continue;
      dump[id] = {
        creds: row.creds,
        origin: row.origin,
        expiresAt: row.expiresAt,
        liveCategoryMeta: row.liveCategoryMeta,
      };
    }
    try {
      writeDisk(dump);
    } catch {
      /* ignore disk errors */
    }
  }, 800);
}

function restoreFromDisk(sessionId: string): SessionRecord | null {
  const dump = readDisk();
  const disk = dump[sessionId];
  if (!disk || disk.expiresAt <= Date.now()) return null;
  const row = hydrate(disk);
  sessions.set(sessionId, row);
  return row;
}

function pruneExpired() {
  const now = Date.now();
  for (const [id, row] of sessions) {
    if (row.expiresAt <= now) sessions.delete(id);
  }
}

function touchSession(row: SessionRecord) {
  row.expiresAt = Date.now() + TTL_MS;
  schedulePersist();
}

export function createIptvSession(
  live: XtreamChannel[],
  creds: XtreamCredentials,
  origin: string,
  liveCategoryMeta: XtreamCategory[] | null = null,
): string {
  pruneExpired();
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    creds,
    origin,
    expiresAt: Date.now() + TTL_MS,
    live,
    liveCategoryMeta,
    ...emptyCaches(),
  });
  schedulePersist();
  return sessionId;
}

export function getIptvSession(sessionId: string): SessionRecord | null {
  pruneExpired();
  let row = sessions.get(sessionId);
  if (!row || row.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    row = restoreFromDisk(sessionId) ?? undefined;
  }
  if (!row || row.expiresAt <= Date.now()) {
    if (row) sessions.delete(sessionId);
    return null;
  }
  touchSession(row);
  return row;
}

export function listIptvCategories(items: XtreamChannel[]): IptvSessionCategory[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const ch of items) {
    const id = ch.categoryId ?? ch.group ?? "other";
    const name = ch.group ?? "Other";
    const prev = counts.get(id);
    counts.set(id, { name, count: (prev?.count ?? 0) + 1 });
  }
  return Array.from(counts.entries())
    .map(([id, v]) => ({ id, name: v.name, count: v.count }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function categoriesFromXtream(
  rows: XtreamCategory[],
  activeCategoryId: string | null,
  activeCount: number,
): IptvSessionCategory[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    count: row.id === activeCategoryId ? activeCount : 0,
  }));
}

export function queryIptvChannels(
  items: XtreamChannel[],
  options: { categoryId?: string | null; search?: string; offset?: number; limit?: number },
): { items: XtreamChannel[]; total: number; hasMore: boolean } {
  const categoryId = options.categoryId?.trim();
  const search = options.search?.trim().toLowerCase() ?? "";
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(200, Math.max(1, options.limit ?? 60));

  let list = items;
  if (categoryId && categoryId !== "all") {
    list = list.filter((c) => (c.categoryId ?? c.group ?? "other") === categoryId);
  }
  if (search.length >= 2) {
    list = list.filter((c) => c.name.toLowerCase().includes(search));
  }

  const total = list.length;
  const slice = list.slice(offset, offset + limit);
  return { items: slice, total, hasMore: offset + limit < total };
}

export function proxyChannelUrl(origin: string, id: string, upstreamUrl: string): string {
  return `${origin}/api/iptv/proxy?id=${encodeURIComponent(id)}&src=${Buffer.from(upstreamUrl, "utf8").toString("base64url")}`;
}

export function proxyPosterUrl(origin: string, raw: string | null | undefined): string | null {
  const logo = raw?.trim();
  if (!logo) return null;
  if (logo.startsWith("https://")) return logo;
  return `${origin}/api/iptv/poster?src=${Buffer.from(logo, "utf8").toString("base64url")}`;
}

function pickCategoryId(categories: XtreamCategory[], requested?: string | null): string | null {
  if (requested && requested !== "all") return requested;
  return categories[0]?.id ?? null;
}

function liveCategoriesForClient(session: SessionRecord): IptvSessionCategory[] {
  const meta = session.liveCategoryMeta ?? [];
  if (!meta.length) return listIptvCategories(session.live);
  return meta.map((row) => ({
    id: row.id,
    name: row.name,
    count:
      session.liveByCategory.get(row.id)?.length ??
      session.live.filter((ch) => (ch.categoryId ?? ch.group ?? "other") === row.id).length,
  }));
}

export async function getCatalogForKind(
  sessionId: string,
  kind: IptvKind,
  categoryId?: string | null,
): Promise<{
  session: SessionRecord;
  items: XtreamChannel[];
  categories: IptvSessionCategory[];
  loading: boolean;
}> {
  const session = getIptvSession(sessionId);
  if (!session) throw new Error("انتهت الجلسة — جاري إعادة الاتصال");

  if (kind === "live") {
    if (!session.liveCategoryMeta) {
      session.liveCategoryMeta = await fetchXtreamLiveCategories(session.creds);
    }
    const requested = categoryId?.trim() ?? "";
    const categories = liveCategoriesForClient(session);

    if (requested === "all") {
      if (!session.live.length) {
        if (session.liveLoading.has("_all")) {
          return { session, items: [], categories, loading: true };
        }
        session.liveLoading.add("_all");
        try {
          session.live = await fetchXtreamLive(session.creds);
        } finally {
          session.liveLoading.delete("_all");
        }
      }
      return { session, items: session.live, categories: liveCategoriesForClient(session), loading: false };
    }

    const activeCategory =
      requested && requested !== "favorite" && requested !== "recent"
        ? requested
        : pickDefaultLiveCategoryId(session.liveCategoryMeta);

    if (!activeCategory) {
      return { session, items: [], categories, loading: false };
    }

    if (session.liveLoading.has(activeCategory)) {
      return { session, items: [], categories, loading: true };
    }

    if (!session.liveByCategory.has(activeCategory)) {
      if (session.live.length) {
        session.liveByCategory.set(
          activeCategory,
          session.live.filter((ch) => (ch.categoryId ?? ch.group ?? "other") === activeCategory),
        );
      } else {
        session.liveLoading.add(activeCategory);
        try {
          const catName = session.liveCategoryMeta.find((row) => row.id === activeCategory)?.name;
          const items = await fetchXtreamLiveByCategory(session.creds, activeCategory, catName);
          session.liveByCategory.set(activeCategory, items);
        } finally {
          session.liveLoading.delete(activeCategory);
        }
      }
    }

    return {
      session,
      items: session.liveByCategory.get(activeCategory) ?? [],
      categories: liveCategoriesForClient(session),
      loading: false,
    };
  }

  if (kind === "movie") {
    if (!session.vodCategories) {
      session.vodCategories = await fetchXtreamVodCategories(session.creds);
    }
    const activeCategory = pickCategoryId(session.vodCategories, categoryId);
    if (!activeCategory) {
      return { session, items: [], categories: [], loading: false };
    }

    if (session.vodLoading.has(activeCategory)) {
      return {
        session,
        items: [],
        categories: categoriesFromXtream(session.vodCategories, activeCategory, 0),
        loading: true,
      };
    }

    if (!session.vodByCategory.has(activeCategory)) {
      session.vodLoading.add(activeCategory);
      try {
        const items = await fetchXtreamMoviesByCategory(session.creds, activeCategory);
        session.vodByCategory.set(activeCategory, items);
      } finally {
        session.vodLoading.delete(activeCategory);
      }
    }

    const items = session.vodByCategory.get(activeCategory) ?? [];
    return {
      session,
      items,
      categories: categoriesFromXtream(session.vodCategories, activeCategory, items.length),
      loading: false,
    };
  }

  if (!session.seriesCategories) {
    session.seriesCategories = await fetchXtreamSeriesCategories(session.creds);
  }
  const activeCategory = pickCategoryId(session.seriesCategories, categoryId);
  if (!activeCategory) {
    return { session, items: [], categories: [], loading: false };
  }

  if (session.seriesLoading.has(activeCategory)) {
    return {
      session,
      items: [],
      categories: categoriesFromXtream(session.seriesCategories, activeCategory, 0),
      loading: true,
    };
  }

  if (!session.seriesByCategory.has(activeCategory)) {
    session.seriesLoading.add(activeCategory);
    try {
      const items = await fetchXtreamSeriesByCategory(session.creds, activeCategory);
      session.seriesByCategory.set(activeCategory, items);
    } finally {
      session.seriesLoading.delete(activeCategory);
    }
  }

  const items = session.seriesByCategory.get(activeCategory) ?? [];
  return {
    session,
    items,
    categories: categoriesFromXtream(session.seriesCategories, activeCategory, items.length),
    loading: false,
  };
}

export function categoryPriority(name: string, kind: IptvKind): number {
  const n = name.toUpperCase();
  if (kind === "live") {
    const preferred = liveCategoryMatchScore(name);
    if (preferred < 99) return preferred;
    if (n.includes("LIVE") || n.includes("مباشر")) return 8;
    if (n.includes("SPORT") || n.includes("رياض")) return 9;
    if (n.includes("MBC") || n.includes("OSN")) return 10;
    return 20;
  }
  if (kind === "movie") {
    if (n.includes("2026")) return 0;
    if (n.includes("2025")) return 1;
    if (n.includes("NETFLIX") || n.includes("نتف")) return 2;
    if (n.includes("ACTION") || n.includes("أكشن")) return 3;
    return 10;
  }
  if (n.includes("2026")) return 0;
  if (n.includes("2025")) return 1;
  if (n.includes("NETFLIX")) return 2;
  return 10;
}

export function mapChannelForClient(session: SessionRecord, channel: XtreamChannel) {
  return {
    id: channel.id,
    name: channel.name,
    group: channel.group,
    logo: proxyPosterUrl(session.origin, channel.logo),
    kind: channel.kind,
    seriesId: channel.seriesId,
    url: channel.url ? proxyChannelUrl(session.origin, channel.id, channel.url) : "",
  };
}
