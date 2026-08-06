const KEY = "max.iptv.favorites";

export function getFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function isFavorite(id: string): boolean {
  return getFavoriteIds().includes(id);
}

export function toggleFavorite(id: string): boolean {
  const set = new Set(getFavoriteIds());
  if (set.has(id)) set.delete(id);
  else set.add(id);
  localStorage.setItem(KEY, JSON.stringify([...set]));
  return set.has(id);
}
