/** Resolve avatar URL for `<img src>` — external or local generations path. */
export function resolveAvatarSrc(avatarUrl: string | null | undefined): string | null {
  const raw = avatarUrl?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/generations/")) {
    const filename = raw.replace(/^\/generations\//, "");
    if (!filename || filename.includes("..")) return null;
    const qs = new URLSearchParams({ local: filename, type: "image" });
    return `/api/media/stream?${qs.toString()}`;
  }
  return raw;
}

export function userInitials(name: string | null | undefined): string {
  const parts = (name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}
