import { Capacitor } from "@capacitor/core";
import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { clearPendingReturnHome, markPendingReturnHome } from "./app-navigation";
import { exitPlaybackMode } from "./fullscreen";
import { deepLinkHint } from "./deeplink";
import { addContinueWatching, ensureInMyList } from "./library";
import { buildLaunchTarget, openPlatformPlayback, PLATFORMS, toOfficialWebUrl } from "./platforms";

export const LAUNCH_COUNTDOWN_MS = 0;
export const POPCORN_DURATION_MS = 8000;

let pendingComplete: ((result: { success: boolean; url: string }) => void) | undefined;
let pendingDestination: string | null = null;
let pendingPlatform: PlatformId | null = null;
let pendingUrl: string | null = null;

export function isSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|Firefox/i.test(ua);
}

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

/** Prepare launch — do NOT mark return-home yet (was resetting UI during popcorn). */
export function beginOfficialLaunch(state: LaunchState): void {
  const target = buildLaunchTarget(state.platform, state.url);
  pendingDestination = target.directUrl;
  pendingPlatform = state.platform;
  pendingUrl = state.url;
  clearPendingReturnHome();
}

export type PlatformLaunchResult = {
  opened: boolean;
  destination: string;
};

/**
 * After popcorn: navigate to the official platform.
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
    markPendingReturnHome();
    void openPlatformPlayback(platform, url).then((result) => {
      notifyLaunchComplete(result.success, result.directUrl);
    });
    await exitPlaybackMode();
    return { opened: true, destination };
  }

  notifyLaunchComplete(true, destination);
  await exitPlaybackMode();

  if (isSafariBrowser()) {
    markPendingReturnHome();
    window.location.assign(destination);
    return { opened: true, destination };
  }

  markPendingReturnHome();
  const tab = window.open(destination, "_blank");
  if (tab) {
    tab.focus();
    return { opened: true, destination };
  }

  window.location.assign(destination);
  return { opened: true, destination };
}

export function cancelLaunch() {
  pendingComplete = undefined;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;
  clearPendingReturnHome();
  void exitPlaybackMode();
}
