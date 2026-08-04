import { Capacitor } from "@capacitor/core";
import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { exitFullscreen } from "./fullscreen";
import { markPendingReturnHome } from "./app-navigation";
import { deepLinkHint } from "./deeplink";
import { addContinueWatching, ensureInMyList } from "./library";
import { buildLaunchTarget, openPlatformPlayback, PLATFORMS, toOfficialWebUrl } from "./platforms";

export const LAUNCH_COUNTDOWN_MS = 0;
export const POPCORN_DURATION_MS = 3000;

const PLATFORM_WINDOW_NAME = "streamhub_platform";

let pendingComplete: ((result: { success: boolean; url: string }) => void) | undefined;
let pendingDestination: string | null = null;
let pendingPlatform: PlatformId | null = null;
let pendingUrl: string | null = null;

export function launchOnPlatform(
  item: CatalogItem,
  platform: PlatformId,
  url: string,
  onLaunching: (state: LaunchState) => void,
  onComplete?: (result: { success: boolean; url: string }) => void,
) {
  const meta = PLATFORMS[platform];
  const webUrl = toOfficialWebUrl(url);
  const target = buildLaunchTarget(platform, webUrl);

  addContinueWatching(item, platform, target.directUrl);
  ensureInMyList(item.id);
  pendingComplete = onComplete;
  onLaunching({
    platform,
    platformName: meta.name,
    title: item.title,
    url: target.directUrl,
    launchMode: target.mode,
    launchLabel: target.label,
    deepLinkHint: deepLinkHint(platform, target.directUrl),
    countdownMs: LAUNCH_COUNTDOWN_MS,
  });
}

function notifyLaunchComplete(success: boolean, url: string) {
  pendingComplete?.({ success, url });
  pendingComplete = undefined;
}

function openMaximizedPlatformWindow(url: string): Window | null {
  const width = window.screen.availWidth || window.innerWidth;
  const height = window.screen.availHeight || window.innerHeight;
  const features = [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    "left=0",
    "top=0",
    "noopener",
    "noreferrer",
  ].join(",");

  try {
    const opened = window.open(url, PLATFORM_WINDOW_NAME, features);
    return opened && !opened.closed ? opened : null;
  } catch {
    return null;
  }
}

/** Open platform — must run inside a user click/tap handler when possible. */
export function openPlatformWithGesture(url: string): boolean {
  const popup = openMaximizedPlatformWindow(url);
  if (popup) {
    try {
      popup.focus();
    } catch {
      /* ignore */
    }
    return true;
  }

  try {
    const tab = window.open(url, "_blank", "noopener,noreferrer");
    if (tab) {
      tab.focus();
      return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

/**
 * Step 1 (user click): prepare launch — popcorn + fullscreen only, no browser tab.
 */
export function beginOfficialLaunch(state: LaunchState): void {
  const target = buildLaunchTarget(state.platform, state.url);
  pendingDestination = target.directUrl;
  pendingPlatform = state.platform;
  pendingUrl = state.url;
  markPendingReturnHome();
}

export type PlatformLaunchResult = {
  opened: boolean;
  destination: string;
};

/**
 * Step 2 (after popcorn): open official platform in a separate window/tab.
 */
export async function finishPlatformLaunch(state: LaunchState): Promise<PlatformLaunchResult> {
  const destination =
    pendingDestination ?? buildLaunchTarget(state.platform, state.url).directUrl;
  const platform = pendingPlatform ?? state.platform;
  const url = pendingUrl ?? state.url;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;

  if (Capacitor.isNativePlatform()) {
    void openPlatformPlayback(platform, url).then((result) => {
      notifyLaunchComplete(result.success, result.directUrl);
    });
    await exitFullscreen();
    return { opened: true, destination };
  }

  markPendingReturnHome();
  const opened = openPlatformWithGesture(destination);
  if (opened) {
    notifyLaunchComplete(true, destination);
    await exitFullscreen();
    return { opened: true, destination };
  }

  notifyLaunchComplete(false, destination);
  return { opened: false, destination };
}

/** Manual tap fallback when Safari blocks delayed popups. */
export async function confirmPlatformLaunch(destination: string): Promise<boolean> {
  markPendingReturnHome();
  const opened = openPlatformWithGesture(destination);
  notifyLaunchComplete(opened, destination);
  if (opened) await exitFullscreen();
  return opened;
}

export function cancelLaunch() {
  pendingComplete = undefined;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;
  void exitFullscreen();
}
