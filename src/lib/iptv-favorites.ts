import type { IptvChannel } from "@/lib/iptv-client";

const FAV_KEY = "max.iptv.favorites";

export function getFavoriteChannels(): IptvChannel[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? (JSON.parse(raw) as IptvChannel[]) : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteChannel(channel: IptvChannel): boolean {
  const list = getFavoriteChannels();
  const idx = list.findIndex((c) => c.id === channel.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
    return false;
  }
  list.unshift(channel);
  localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 200)));
  return true;
}

export function isFavoriteChannel(id: string): boolean {
  return getFavoriteChannels().some((c) => c.id === id);
}

const RECENT_KEY = "max.iptv.recent";

export function pushRecentChannel(channel: IptvChannel): void {
  const list = getRecentChannels().filter((c) => c.id !== channel.id);
  list.unshift(channel);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 50)));
}

export function getRecentChannels(): IptvChannel[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as IptvChannel[]) : [];
  } catch {
    return [];
  }
}
