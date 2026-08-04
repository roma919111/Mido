import { Capacitor } from "@capacitor/core";
import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { clearAllReturnFlags, clearPendingReturnHome, markPlatformOpened } from "./app-navigation";
import { isBrowserTab, isStandaloneApp } from "./display-mode";
import { exitPlaybackMode } from "./fullscreen";
import { deepLinkHint } from "./deeplink";
import { addContinueWatching, ensureInMyList } from "./library";
import { buildLaunchTarget, openPlatformPlayback, PLATFORMS, toOfficialWebUrl } from "./platforms";

export const LAUNCH_COUNTDOWN_MS = 0;
/** Popcorn runs for 5 seconds before navigating to the platform (single browser tab). */
export const POPCORN_DURATION_MS = 5000;

const PLATFORM_WINDOW_NAME = "max_platform";

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

export function keepStreamHubFocused(): void {
  window.focus();
}

export function startStreamHubFocusLoop(): () => void {
  keepStreamHubFocused();
  const id = window.setInterval(keepStreamHubFocused, 120);
  return () => window.clearInterval(id);
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
  sameTab: boolean;
};

function shouldUseSameTabLaunch(): boolean {
  if (Capacitor.isNativePlatform()) return false;
  return isBrowserTab() || isStandaloneApp();
}

function navigateSameTab(destination: string): void {
  markPlatformOpened();
  window.location.assign(destination);
}

/**
 * Prepare launch during the user click — web uses a single tab (no extra tab strip).
 * Platform navigation happens after the 5s popcorn overlay.
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
    return { opened: true, destination, needsManualOpen: false, sameTab: false };
  }

  if (shouldUseSameTabLaunch()) {
    notifyLaunchComplete(true, destination);
    return { opened: false, destination, needsManualOpen: false, sameTab: true };
  }

  const tab = window.open(destination, PLATFORM_WINDOW_NAME);
  if (tab) {
    markPlatformOpened();
    notifyLaunchComplete(true, destination);
    try {
      tab.blur();
    } catch {
      /* ignore */
    }
    window.focus();
    return { opened: true, destination, needsManualOpen: false, sameTab: false };
  }

  markPlatformOpened();
  notifyLaunchComplete(true, destination);
  return { opened: false, destination, needsManualOpen: true, sameTab: false };
}

/** After 5s popcorn: navigate in the same tab or focus the platform window. */
export async function finishPopcornOverlay(state: LaunchState): Promise<void> {
  const destination =
    pendingDestination ?? buildLaunchTarget(state.platform, state.url).directUrl;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;

  await exitPlaybackMode();

  if (Capacitor.isNativePlatform()) return;

  if (shouldUseSameTabLaunch()) {
    navigateSameTab(destination);
    return;
  }

  try {
    const tab = window.open("", PLATFORM_WINDOW_NAME);
    if (tab && !tab.closed) {
      tab.focus();
    } else {
      window.open(destination, PLATFORM_WINDOW_NAME)?.focus();
    }
  } catch {
    window.location.assign(destination);
  }

  void state;
}

export function openPlatformManually(destination: string): boolean {
  navigateSameTab(destination);
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
