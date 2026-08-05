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

/** One tap: app → Play Store → browser. No popcorn, no dialogs. */
export async function openPlatformNow(
  platform: PlatformId,
  url?: string,
): Promise<OpenPlatformResult> {
  const meta = PLATFORMS[platform];
  const targetUrl = url?.trim() || meta.homeUrl;
  markPlatformOpened();

  if (Capacitor.isNativePlatform()) {
    const installed = await isPlatformAppInstalled(platform);
    if (installed) {
      const ok = await launchNativePlatformApp(platform, targetUrl);
      return ok ? "app" : "failed";
    }
    const storeOk = await openPlatformPlayStore(platform);
    if (storeOk) return "store";
  }

  const browserOk = await openPlatformWebView(targetUrl);
  return browserOk ? "browser" : "failed";
}

export async function openCatalogItem(
  platform: PlatformId,
  url: string,
): Promise<OpenPlatformResult> {
  return openPlatformNow(platform, url);
}
