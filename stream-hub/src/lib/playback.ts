import { Capacitor } from "@capacitor/core";
import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { clearAllReturnFlags, clearPendingReturnHome, markPlatformOpened } from "./app-navigation";
import { isIosDevice } from "./display-mode";
import { exitPlaybackMode } from "./fullscreen";
import { deepLinkHint } from "./deeplink";
import { addContinueWatching, ensureInMyList } from "./library";
import {
  buildLaunchTarget,
  isAndroidDevice,
  openPlatformHref,
  openPlatformPlayback,
  PLATFORMS,
  toOfficialWebUrl,
} from "./platforms";

export const LAUNCH_COUNTDOWN_MS = 0;
/** Popcorn then open Netflix / platform app. */
export const POPCORN_DURATION_MS = 5000;

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

export function prepareLaunch(state: LaunchState): void {
  const target = buildLaunchTarget(state.platform, state.url);
  pendingDestination = target.directUrl;
  pendingPlatform = state.platform;
  pendingUrl = state.url;
  clearPendingReturnHome();
}

export type PlatformLaunchResult = {
  opened: boolean;
  destination: string;
  needsManualOpen: boolean;
};

function navigateToPlatformSameTab(destination: string): void {
  markPlatformOpened();
  const go = new URL(window.location.href);
  go.search = "";
  go.hash = "";
  go.searchParams.set("maxGo", "1");
  go.searchParams.set("dest", destination);
  window.location.assign(go.toString());
}

/** Web mobile: open during click. Native/TV: open after popcorn. */
export function openPlatformBrowserSync(state: LaunchState): PlatformLaunchResult {
  const destination =
    pendingDestination ?? buildLaunchTarget(state.platform, state.url).directUrl;
  const platform = pendingPlatform ?? state.platform;
  const url = pendingUrl ?? state.url;

  if (Capacitor.isNativePlatform()) {
    notifyLaunchComplete(true, destination);
    return { opened: false, destination, needsManualOpen: false };
  }

  if (isAndroidDevice()) {
    const target = buildLaunchTarget(platform, url);
    markPlatformOpened();
    openPlatformHref(target.href);
    notifyLaunchComplete(true, destination);
    return { opened: true, destination, needsManualOpen: false };
  }

  if (isIosDevice()) {
    markPlatformOpened();
    openPlatformHref(destination);
    notifyLaunchComplete(true, destination);
    return { opened: true, destination, needsManualOpen: false };
  }

  notifyLaunchComplete(true, destination);
  return { opened: false, destination, needsManualOpen: false };
}

export type PopcornFinishResult = {
  success: boolean;
  destination: string;
};

/** After popcorn: open platform app (native/TV) or navigate (desktop web). */
export async function finishPopcornOverlay(state: LaunchState): Promise<PopcornFinishResult> {
  const platform = pendingPlatform ?? state.platform;
  const url = pendingUrl ?? state.url;
  const destination =
    pendingDestination ?? buildLaunchTarget(platform, url).directUrl;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;

  await exitPlaybackMode();

  if (Capacitor.isNativePlatform()) {
    markPlatformOpened();
    const result = await openPlatformPlayback(platform, url);
    notifyLaunchComplete(result.success, result.directUrl);
    return { success: result.success, destination: result.directUrl };
  }

  if (isAndroidDevice() || isIosDevice()) {
    return { success: true, destination };
  }

  navigateToPlatformSameTab(destination);
  return { success: true, destination };
}

export async function openPlatformManually(
  platform: PlatformId,
  destination: string,
): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    markPlatformOpened();
    const result = await openPlatformPlayback(platform, destination);
    return result.success;
  }
  navigateToPlatformSameTab(destination);
  return true;
}

export function cancelLaunch() {
  pendingComplete = undefined;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;
  clearAllReturnFlags();
  void exitPlaybackMode();
}
