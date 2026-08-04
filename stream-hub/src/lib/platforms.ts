import type { PlatformId } from "../types";

export type PlatformMeta = {
  id: PlatformId;
  name: string;
  color: string;
  homeUrl: string;
  /** Official Android app package — used for Google TV-style app launch. */
  androidPackage: string;
};

export const PLATFORMS: Record<PlatformId, PlatformMeta> = {
  netflix: {
    id: "netflix",
    name: "Netflix",
    color: "#e50914",
    homeUrl: "https://www.netflix.com/browse",
    androidPackage: "com.netflix.mediaclient",
  },
  shahid: {
    id: "shahid",
    name: "شاهد",
    color: "#00c853",
    homeUrl: "https://shahid.mbc.net/ar",
    androidPackage: "net.mbc.shahid",
  },
  tod: {
    id: "tod",
    name: "TOD",
    color: "#7c3aed",
    homeUrl: "https://www.tod.tv/ar",
    androidPackage: "com.beincom.tod",
  },
};

export type LaunchMode = "android-app" | "app-link" | "browser";

export function isAndroidDevice(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * Google TV model: browse in Stream Hub → launch the official streaming APP.
 * On Android: Android Intent opens Netflix/Shahid/TOD app (not Chrome).
 * Fallback: HTTPS app link, then browser.
 */
export function buildLaunchTarget(
  platform: PlatformId,
  webUrl: string,
): { href: string; mode: LaunchMode; label: string } {
  const secure = toOfficialWebUrl(webUrl);
  const parsed = new URL(secure);
  const meta = PLATFORMS[platform];

  if (isAndroidDevice()) {
    const intent = [
      `intent://${parsed.host}${parsed.pathname}${parsed.search}`,
      `#Intent`,
      `scheme=https`,
      `package=${meta.androidPackage}`,
      `S.browser_fallback_url=${encodeURIComponent(secure)}`,
      `end`,
    ].join(";");
    return {
      href: intent,
      mode: "android-app",
      label: `تطبيق ${meta.name}`,
    };
  }

  return {
    href: secure,
    mode: "app-link",
    label: meta.name,
  };
}

export function toOfficialWebUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function openPlatformPlayback(
  platform: PlatformId,
  url: string,
): { success: boolean; mode: LaunchMode; href: string } {
  const target = buildLaunchTarget(platform, url);
  try {
    window.location.assign(target.href);
    return { success: true, mode: target.mode, href: target.href };
  } catch {
    return { success: false, mode: target.mode, href: target.href };
  }
}
