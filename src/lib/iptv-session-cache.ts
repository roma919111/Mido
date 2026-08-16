import type { XtreamChannel, XtreamCredentials } from "@/lib/xtream-url";

export type IptvSessionCategory = {
  id: string;
  name: string;
  count: number;
};

type SessionRecord = {
  creds: XtreamCredentials;
  channels: XtreamChannel[];
  origin: string;
  expiresAt: number;
};

const TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, SessionRecord>();

function pruneExpired() {
  const now = Date.now();
  for (const [id, row] of sessions) {
    if (row.expiresAt <= now) sessions.delete(id);
  }
}

export function createIptvSession(
  channels: XtreamChannel[],
  creds: XtreamCredentials,
  origin: string,
): string {
  pruneExpired();
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    creds,
    channels,
    origin,
    expiresAt: Date.now() + TTL_MS,
  });
  return sessionId;
}

export function getIptvSession(sessionId: string): SessionRecord | null {
  pruneExpired();
  const row = sessions.get(sessionId);
  if (!row || row.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return row;
}

export function listIptvCategories(channels: XtreamChannel[]): IptvSessionCategory[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const ch of channels) {
    const id = ch.group ?? "other";
    const name = ch.group ?? "Other";
    const prev = counts.get(id);
    counts.set(id, { name, count: (prev?.count ?? 0) + 1 });
  }
  return Array.from(counts.entries())
    .map(([id, v]) => ({ id, name: v.name, count: v.count }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function queryIptvChannels(
  channels: XtreamChannel[],
  options: { categoryId?: string | null; search?: string; offset?: number; limit?: number },
): { items: XtreamChannel[]; total: number; hasMore: boolean } {
  const categoryId = options.categoryId?.trim();
  const search = options.search?.trim().toLowerCase() ?? "";
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(120, Math.max(1, options.limit ?? 60));

  let list = channels;
  if (categoryId && categoryId !== "all") {
    list = list.filter((c) => (c.group ?? "other") === categoryId);
  }
  if (search.length >= 2) {
    list = list.filter((c) => c.name.toLowerCase().includes(search));
  }

  const total = list.length;
  const items = list.slice(offset, offset + limit);
  return { items, total, hasMore: offset + limit < total };
}

export function proxyChannelUrl(origin: string, id: string, upstreamUrl: string): string {
  return `${origin}/api/iptv/proxy?id=${encodeURIComponent(id)}&src=${Buffer.from(upstreamUrl, "utf8").toString("base64url")}`;
}
