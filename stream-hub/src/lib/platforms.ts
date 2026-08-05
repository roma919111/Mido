import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import type { PlatformId } from "../types";
import { normalizeDeepLink } from "./deeplink";
import { getAndroidPackages, isAndroidTvDevice, launchNativePlatformApp } from "./platform-launch-native";

function openHref(href: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function openPlatformHref(href: string): void {
  openHref(href);
}

export type PlatformMeta = {
  id: PlatformId;
  name: string;
  color: string;
  homeUrl: string;
  androidPackage: string;
  playStoreUrl: string;
};

export const PLATFORMS: Record<PlatformId, PlatformMeta> = {
  netflix: {
    id: "netflix",
    name: "Netflix",
    color: "#e50914",
    homeUrl: "https://www.netflix.com/browse",
    androidPackage: "com.netflix.mediaclient",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.netflix.mediaclient",
  },
  shahid: {
    id: "shahid",
    name: "شاهد",
    color: "#00c853",
    homeUrl: "https://shahid.mbc.net/ar",
    androidPackage: "net.mbc.shahid",
    playStoreUrl: "https://play.google.com/store/apps/details?id=net.mbc.shahid",
  },
  tod: {
    id: "tod",
    name: "TOD",
    color: "#7c3aed",
    homeUrl: "https://www.tod.tv/ar",
    androidPackage: "com.beincom.tod",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.beincom.tod",
  },
};

export type LaunchMode = "android-app" | "app-link";

export function isAndroidDevice(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function toOfficialWebUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function buildLaunchTarget(
  platform: PlatformId,
  webUrl: string,
): { href: string; mode: LaunchMode; label: string; directUrl: string } {
  const directUrl = normalizeDeepLink(platform, webUrl);
  const parsed = new URL(directUrl);
  const meta = PLATFORMS[platform];

  if (isAndroidDevice()) {
    const fallback = Capacitor.isNativePlatform()
      ? meta.playStoreUrl
      : directUrl;
    const launchFlags = Capacitor.isNativePlatform() ? "0" : "0x10000000";
    const { primary } = getAndroidPackages(platform);
    const intent = [
      `intent://${parsed.host}${parsed.pathname}${parsed.search}`,
      `#Intent`,
      `scheme=https`,
      `package=${primary}`,
      `launchFlags=${launchFlags}`,
      `S.browser_fallback_url=${encodeURIComponent(fallback)}`,
      `end`,
    ].join(";");
    return {
      href: intent,
      mode: "android-app",
      label: `تطبيق ${meta.name}`,
      directUrl,
    };
  }

  return {
    href: directUrl,
    mode: "app-link",
    label: meta.name,
    directUrl,
  };
}

export async function openPlatformPlayback(
  platform: PlatformId,
  url: string,
): Promise<{ success: boolean; mode: LaunchMode; href: string; directUrl: string }> {
  const target = buildLaunchTarget(platform, url);
  const isNative = Capacitor.isNativePlatform();

  try {
    if (isNative && isAndroidDevice()) {
      const ok = await launchNativePlatformApp(platform, target.directUrl);
      if (ok) {
        return { success: true, mode: target.mode, href: target.href, directUrl: target.directUrl };
      }
      openHref(target.href);
      return { success: true, mode: target.mode, href: target.href, directUrl: target.directUrl };
    }

    if (isAndroidDevice() && target.mode === "android-app") {
      openHref(target.href);
      return { success: true, mode: target.mode, href: target.href, directUrl: target.directUrl };
    }

    if (isNative) {
      await Browser.open({ url: target.directUrl, toolbarColor: "#0e0e10" });
      return { success: true, mode: "app-link", href: target.directUrl, directUrl: target.directUrl };
    }

    if (target.mode === "android-app") {
      openHref(target.href);
      return { success: true, mode: target.mode, href: target.href, directUrl: target.directUrl };
    }

    window.open(target.directUrl, "_blank", "noopener,noreferrer");
    return { success: true, mode: target.mode, href: target.href, directUrl: target.directUrl };
  } catch {
    try {
      if (isNative && isAndroidDevice()) {
        const ok = await launchNativePlatformApp(platform, target.directUrl);
        if (ok) {
          return { success: true, mode: target.mode, href: target.href, directUrl: target.directUrl };
        }
      }
      await Browser.open({ url: target.directUrl });
      return { success: true, mode: "app-link", href: target.directUrl, directUrl: target.directUrl };
    } catch {
      return { success: false, mode: target.mode, href: target.href, directUrl: target.directUrl };
    }
  }
}

export { isAndroidTvDevice };
