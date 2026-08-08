import { Capacitor } from "@capacitor/core";
import type { PlatformId } from "../types";
import { markPlatformOpened } from "./app-navigation";
import { openPlatformWebView } from "./platform-browser";
import {
  isPlatformAppInstalled,
  launchNativePlatformApp,
  openPlatformPlayStore,
} from "./platform-launch-native";
import { PLATFORMS } from "./platforms";

export type OpenPlatformResult = "app" | "store" | "browser" | "failed";

export type OpenPlatformOptions = {
  url?: string;
  searchQuery?: string;
};

/** Deeplink with locked MAX shell — kiosk stays, returns via ← MAX button. */
export async function openPlatformLocked(
  platform: PlatformId,
  target: string | OpenPlatformOptions = {},
): Promise<OpenPlatformResult> {
  const meta = PLATFORMS[platform];
  const opts: OpenPlatformOptions =
    typeof target === "string"
      ? { url: target.trim() || meta.homeUrl }
      : {
          url: target.url?.trim() || undefined,
          searchQuery: target.searchQuery?.trim() || undefined,
        };

  if (!opts.url && !opts.searchQuery) {
    opts.url = meta.homeUrl;
  }

  markPlatformOpened();

  if (Capacitor.isNativePlatform()) {
    const installed = await isPlatformAppInstalled(platform);
    if (installed) {
      const ok = await launchNativePlatformApp(platform, opts);
      if (ok) return "app";
    }

    const storeOk = await openPlatformPlayStore(platform);
    if (storeOk) return "store";

    if (opts.url) {
      const browserOk = await openPlatformWebView(opts.url);
      return browserOk ? "browser" : "failed";
    }
    return "failed";
  }

  if (opts.url) {
    const browserOk = await openPlatformWebView(opts.url);
    return browserOk ? "browser" : "failed";
  }

  return "failed";
}

/** One tap: app → Play Store → browser. No popcorn, no dialogs. */
export async function openPlatformNow(
  platform: PlatformId,
  target: string | OpenPlatformOptions = {},
): Promise<OpenPlatformResult> {
  const meta = PLATFORMS[platform];
  const opts: OpenPlatformOptions =
    typeof target === "string"
      ? { url: target.trim() || meta.homeUrl }
      : {
          url: target.url?.trim() || undefined,
          searchQuery: target.searchQuery?.trim() || undefined,
        };

  if (!opts.url && !opts.searchQuery) {
    opts.url = meta.homeUrl;
  }

  markPlatformOpened();

  if (Capacitor.isNativePlatform()) {
    const installed = await isPlatformAppInstalled(platform);
    if (installed) {
      const ok = await launchNativePlatformApp(platform, opts);
      return ok ? "app" : "failed";
    }
    const storeOk = await openPlatformPlayStore(platform);
    if (storeOk) return "store";
  }

  if (opts.url) {
    const browserOk = await openPlatformWebView(opts.url);
    return browserOk ? "browser" : "failed";
  }

  return "failed";
}

export async function openCatalogItem(
  platform: PlatformId,
  url: string,
): Promise<OpenPlatformResult> {
  return openPlatformNow(platform, { url });
}
