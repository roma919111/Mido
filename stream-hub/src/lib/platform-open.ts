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
import { platformSearchUrl } from "./tmdb-discover";

export type OpenPlatformResult = "app" | "store" | "browser" | "failed";

export type OpenPlatformOptions = {
  url?: string;
  searchQuery?: string;
  tmdbId?: number;
  tmdbType?: "movie" | "tv";
};

function normalizeOpts(
  platform: PlatformId,
  target: string | OpenPlatformOptions,
): OpenPlatformOptions {
  const meta = PLATFORMS[platform];
  const opts: OpenPlatformOptions =
    typeof target === "string"
      ? { url: target.trim() || meta.homeUrl }
      : {
          url: target.url?.trim() || undefined,
          searchQuery: target.searchQuery?.trim() || undefined,
          tmdbId: target.tmdbId,
          tmdbType: target.tmdbType,
        };

  if (!opts.url && !opts.searchQuery) {
    opts.url = meta.homeUrl;
  }
  return opts;
}

/** Deeplink with locked MAX shell — kiosk stays, returns via ← MAX button. */
export async function openPlatformLocked(
  platform: PlatformId,
  target: string | OpenPlatformOptions = {},
): Promise<OpenPlatformResult> {
  const opts = normalizeOpts(platform, target);

  if (Capacitor.isNativePlatform()) {
    // Launch first — avoids losing the Android tap gesture after async work.
    const launched = await launchNativePlatformApp(platform, opts);
    if (launched) {
      markPlatformOpened();
      return "app";
    }

    const installed = await isPlatformAppInstalled(platform);
    if (!installed) {
      const storeOk = await openPlatformPlayStore(platform);
      if (storeOk) {
        markPlatformOpened();
        return "store";
      }
    }

    if (opts.url) {
      const browserOk = await openPlatformWebView(opts.url);
      if (browserOk) {
        markPlatformOpened();
        return "browser";
      }
    }

    if (opts.searchQuery) {
      const searchUrl = platformSearchUrl(platform, opts.searchQuery);
      const browserOk = await openPlatformWebView(searchUrl);
      if (browserOk) {
        markPlatformOpened();
        return "browser";
      }
    }

    return "failed";
  }

  if (opts.url) {
    const browserOk = await openPlatformWebView(opts.url);
    if (browserOk) {
      markPlatformOpened();
      return "browser";
    }
  }

  if (opts.searchQuery) {
    const searchUrl = platformSearchUrl(platform, opts.searchQuery);
    const browserOk = await openPlatformWebView(searchUrl);
    if (browserOk) {
      markPlatformOpened();
      return "browser";
    }
  }

  return "failed";
}

/** One tap: app → Play Store → browser. No popcorn, no dialogs. */
export async function openPlatformNow(
  platform: PlatformId,
  target: string | OpenPlatformOptions = {},
): Promise<OpenPlatformResult> {
  return openPlatformLocked(platform, target);
}

export async function openCatalogItem(
  platform: PlatformId,
  url: string,
): Promise<OpenPlatformResult> {
  return openPlatformNow(platform, { url });
}
