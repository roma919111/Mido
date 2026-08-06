import type { IptvChannel } from "./iptv-client";

export type IptvNav = "live" | "movies" | "series" | "favorites";

export type IptvRow = {
  id: string;
  title: string;
  channels: IptvChannel[];
};

const MOVIE_RE =
  /movie|film|أفلام|فيلم|vod\s*movie|latest\s*movies|cinema|أحدث\s*الأفلام/i;
const SERIES_RE =
  /series|serie|season|episode|مسلسل|مسلسلات|show|latest\s*series|أحدث\s*المسلسلات|mbc\s*sh/i;
const LIVE_RE =
  /live|tv|sport|news|bein|mbc|قنوات|مباشر|رياض|أخبار|live\s*tv|latest\s*live/i;

export function classifyChannel(ch: IptvChannel): Exclude<IptvNav, "favorites"> {
  const haystack = `${ch.group ?? ""} ${ch.name}`;
  if (MOVIE_RE.test(haystack)) return "movies";
  if (SERIES_RE.test(haystack)) return "series";
  if (LIVE_RE.test(haystack)) return "live";
  return "live";
}

export function filterByNav(channels: IptvChannel[], nav: IptvNav, favoriteIds: string[]): IptvChannel[] {
  if (nav === "favorites") {
    const set = new Set(favoriteIds);
    return channels.filter((ch) => set.has(ch.id));
  }
  return channels.filter((ch) => classifyChannel(ch) === nav);
}

export function buildRows(channels: IptvChannel[], nav: IptvNav): IptvRow[] {
  if (!channels.length) return [];

  if (nav === "favorites") {
    return [{ id: "favorites", title: "My Favorites", channels }];
  }

  const map = new Map<string, IptvChannel[]>();
  for (const ch of channels) {
    const title = ch.group?.trim() || defaultRowTitle(nav);
    if (!map.has(title)) map.set(title, []);
    map.get(title)!.push(ch);
  }

  return [...map.entries()].map(([title, list]) => ({
    id: `${nav}-${title}`,
    title,
    channels: list,
  }));
}

function defaultRowTitle(nav: Exclude<IptvNav, "favorites">): string {
  switch (nav) {
    case "movies":
      return "Latest Movies";
    case "series":
      return "Latest Series";
    default:
      return "Live TV";
  }
}

/** Stable decorative rating for poster badges (1.0–10.0). */
export function channelRating(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const normalized = (Math.abs(hash) % 91) / 10 + 1;
  return Math.round(normalized * 10) / 10;
}

export function posterGradient(id: string): string {
  const hue = Math.abs(hashCode(id)) % 360;
  return `linear-gradient(145deg, hsl(${hue} 62% 38%), hsl(${(hue + 40) % 360} 55% 18%))`;
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}
