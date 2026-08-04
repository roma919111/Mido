import type { CatalogItem, ContinueEntry, PlatformId } from "../types";

const CONTINUE_KEY = "stream-hub-continue";
const MYLIST_KEY = "stream-hub-mylist";
const MAX_CONTINUE = 12;

export function getContinueWatching(): ContinueEntry[] {
  try {
    const raw = localStorage.getItem(CONTINUE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ContinueEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addContinueWatching(
  item: CatalogItem,
  platform: PlatformId,
  url: string,
) {
  const entry: ContinueEntry = {
    itemId: item.id,
    title: item.title,
    posterGradient: item.posterGradient,
    platform,
    url,
    watchedAt: Date.now(),
  };
  const next = [
    entry,
    ...getContinueWatching().filter((e) => e.itemId !== item.id),
  ].slice(0, MAX_CONTINUE);
  localStorage.setItem(CONTINUE_KEY, JSON.stringify(next));
}

export function getMyList(): string[] {
  try {
    const raw = localStorage.getItem(MYLIST_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function toggleMyList(itemId: string): boolean {
  const current = getMyList();
  const has = current.includes(itemId);
  const next = has ? current.filter((id) => id !== itemId) : [...current, itemId];
  localStorage.setItem(MYLIST_KEY, JSON.stringify(next));
  return !has;
}

export function isInMyList(itemId: string): boolean {
  return getMyList().includes(itemId);
}
