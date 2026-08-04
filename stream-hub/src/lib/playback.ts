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
let platformTab: Window | null = null;
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

function reservePlatformTab(): Window | null {
  try {
    const tab = window.open("about:blank", PLATFORM_WINDOW_NAME);
    if (tab) {
      try {
        tab.blur();
      } catch {
        /* ignore */
      }
    }
    return tab;
  } catch {
    return null;
  }
}

function navigatePlatformTab(tab: Window, url: string): boolean {
  try {
    tab.location.href = url;
    tab.focus();
    return true;
  } catch {
    return false;
  }
}

/** Open platform — must run inside a user click/tap handler when possible. */
export function openPlatformWithGesture(url: string): boolean {
  if (platformTab && !platformTab.closed) {
    if (navigatePlatformTab(platformTab, url)) {
      platformTab = null;
      return true;
    }
    platformTab = null;
  }

  const reserved = reservePlatformTab();
  if (reserved && navigatePlatformTab(reserved, url)) {
    return true;
  }

  try {
    const tab = window.open(url, "_blank");
    if (tab) {
      tab.focus();
      return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

/** Keep Stream Hub tab visible while popcorn plays. */
export function keepStreamHubFocused(): void {
  window.focus();
}

export function startStreamHubFocusLoop(): () => void {
  keepStreamHubFocused();
  const intervalId = window.setInterval(keepStreamHubFocused, 100);
  return () => window.clearInterval(intervalId);
}

/**
 * Step 1 (user click): reserve Safari tab + show popcorn. Must run synchronously on click.
 */
export function beginOfficialLaunch(state: LaunchState): void {
  const target = buildLaunchTarget(state.platform, state.url);
  pendingDestination = target.directUrl;
  pendingPlatform = state.platform;
  pendingUrl = state.url;
  markPendingReturnHome();

  if (Capacitor.isNativePlatform()) {
    platformTab = null;
    return;
  }

  platformTab = reservePlatformTab();
  keepStreamHubFocused();
}

export type PlatformLaunchResult = {
  opened: boolean;
  destination: string;
};

/**
 * Step 2 (after popcorn): navigate reserved tab to the official platform.
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

  if (platformTab && !platformTab.closed && navigatePlatformTab(platformTab, destination)) {
    platformTab = null;
    notifyLaunchComplete(true, destination);
    await exitFullscreen();
    return { opened: true, destination };
  }
  platformTab = null;

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

/** Last resort — navigate current tab to platform (always works). */
export async function forcePlatformNavigation(destination: string): Promise<void> {
  markPendingReturnHome();
  notifyLaunchComplete(true, destination);
  await exitFullscreen();
  window.location.assign(destination);
}

export function cancelLaunch() {
  pendingComplete = undefined;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;
  if (platformTab && !platformTab.closed) {
    try {
      platformTab.close();
    } catch {
      /* ignore */
    }
  }
  platformTab = null;
  void exitFullscreen();
}
