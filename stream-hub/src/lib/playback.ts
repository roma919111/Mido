import { Capacitor } from "@capacitor/core";
import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { clearAllReturnFlags, clearPendingReturnHome, markPlatformOpened } from "./app-navigation";
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
/** Popcorn on MAX, then same-tab navigation so browser ← returns home. */
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

/** Store launch target — call synchronously at the start of the user click. */
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

/** Same-tab navigation — MAX stays in history so ← back returns home. */
function navigateToPlatformSameTab(destination: string): void {
  markPlatformOpened();

  const go = new URL(window.location.href);
  go.search = "";
  go.hash = "";
  go.searchParams.set("maxGo", "1");
  go.searchParams.set("dest", destination);
  window.location.assign(go.toString());
}

/**
 * Android: open native app during click. iOS/web: defer until after popcorn
 * so MAX remains the previous history entry when Netflix loads.
 */
export function openPlatformBrowserSync(state: LaunchState): PlatformLaunchResult {
  const destination =
    pendingDestination ?? buildLaunchTarget(state.platform, state.url).directUrl;
  const platform = pendingPlatform ?? state.platform;
  const url = pendingUrl ?? state.url;

  if (Capacitor.isNativePlatform()) {
    markPlatformOpened();
    void openPlatformPlayback(platform, url).then((result) => {
      notifyLaunchComplete(result.success, result.directUrl);
    });
    return { opened: true, destination, needsManualOpen: false };
  }

  if (isAndroidDevice()) {
    const target = buildLaunchTarget(platform, url);
    markPlatformOpened();
    openPlatformHref(target.href);
    notifyLaunchComplete(true, destination);
    return { opened: true, destination, needsManualOpen: false };
  }

  notifyLaunchComplete(true, destination);
  return { opened: false, destination, needsManualOpen: false };
}

/** After 5s popcorn: navigate in the same tab (iOS/web) so ← returns to MAX. */
export async function finishPopcornOverlay(state: LaunchState): Promise<void> {
  const destination =
    pendingDestination ?? buildLaunchTarget(state.platform, state.url).directUrl;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;

  await exitPlaybackMode();

  if (Capacitor.isNativePlatform()) return;
  if (isAndroidDevice()) return;

  navigateToPlatformSameTab(destination);
  void state;
}

export function openPlatformManually(destination: string): boolean {
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
