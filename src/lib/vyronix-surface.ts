/** Deploy-time surface: studio (Singapore) vs media player (Europe). */

export type VyronixSurface = "studio" | "player";

export function getVyronixSurface(): VyronixSurface {
  const raw = (process.env.VYRONIX_SURFACE || "").trim().toLowerCase();
  return raw === "player" || raw === "media" ? "player" : "studio";
}

export function isPlayerSurface(): boolean {
  return getVyronixSurface() === "player";
}

export function isPlayerPath(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  return (
    path === "/maxmediaplayer" ||
    path.startsWith("/maxmediaplayer/") ||
    path === "/vyronixmaxmediaplayer" ||
    path.startsWith("/vyronixmaxmediaplayer/") ||
    path === "/player" ||
    path.startsWith("/player/") ||
    path === "/max" ||
    path.startsWith("/max/") ||
    path === "/maxvyronixmerdia" ||
    path.startsWith("/maxvyronixmerdia/") ||
    path === "/maxvyronixmedia" ||
    path.startsWith("/maxvyronixmedia/") ||
    path === "/maxvronixmedia" ||
    path.startsWith("/maxvronixmedia/") ||
    path === "/iptv" ||
    path.startsWith("/iptv/") ||
    path === "/admin/iptv" ||
    path.startsWith("/admin/iptv/") ||
    path === "/api/iptv" ||
    path.startsWith("/api/iptv/") ||
    path === "/stream" ||
    path.startsWith("/stream/")
  );
}

export function isPlayerPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/promo/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png"
  );
}
