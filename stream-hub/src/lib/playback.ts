import { Capacitor } from "@capacitor/core";
import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { clearAllReturnFlags, clearPendingReturnHome, markPlatformOpened } from "./app-navigation";
import { exitPlaybackMode } from "./fullscreen";
import { deepLinkHint } from "./deeplink";
import { addContinueWatching, ensureInMyList } from "./library";
import { buildLaunchTarget, openPlatformPlayback, PLATFORMS, toOfficialWebUrl } from "./platforms";

export const LAUNCH_COUNTDOWN_MS = 0;
export const POPCORN_DURATION_MS = 8000;

const PLATFORM_WINDOW_NAME = "max_platform";

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

function reservePlatformTab(): void {
  platformTab = null;
  if (Capacitor.isNativePlatform()) return;

  try {
    const tab = window.open("about:blank", PLATFORM_WINDOW_NAME);
    if (tab) {
      platformTab = tab;
      try {
        tab.blur();
      } catch {
        /* ignore */
      }
    }
  } catch {
    platformTab = null;
  }
  window.focus();
}

export function keepStreamHubFocused(): void {
  window.focus();
}

export function startStreamHubFocusLoop(): () => void {
  keepStreamHubFocused();
  const id = window.setInterval(keepStreamHubFocused, 120);
  return () => window.clearInterval(id);
}

export function beginOfficialLaunch(state: LaunchState): void {
  const target = buildLaunchTarget(state.platform, state.url);
  pendingDestination = target.directUrl;
  pendingPlatform = state.platform;
  pendingUrl = state.url;
  clearPendingReturnHome();
  reservePlatformTab();
}

export type PlatformLaunchResult = {
  opened: boolean;
  destination: string;
  needsManualOpen: boolean;
};

function navigatePlatformTab(destination: string): boolean {
  if (!platformTab || platformTab.closed) return false;
  try {
    platformTab.location.href = destination;
    platformTab.focus();
    return true;
  } catch {
    return false;
  }
}

export async function finishPlatformLaunch(state: LaunchState): Promise<PlatformLaunchResult> {
  const destination =
    pendingDestination ?? buildLaunchTarget(state.platform, state.url).directUrl;
  const platform = pendingPlatform ?? state.platform;
  const url = pendingUrl ?? state.url;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;

  if (Capacitor.isNativePlatform()) {
    markPlatformOpened();
    void openPlatformPlayback(platform, url).then((result) => {
      notifyLaunchComplete(result.success, result.directUrl);
    });
    await exitPlaybackMode();
    platformTab = null;
    return { opened: true, destination, needsManualOpen: false };
  }

  notifyLaunchComplete(true, destination);
  await exitPlaybackMode();

  if (navigatePlatformTab(destination)) {
    platformTab = null;
    markPlatformOpened();
    return { opened: true, destination, needsManualOpen: false };
  }
  platformTab = null;

  const tab = window.open(destination, PLATFORM_WINDOW_NAME);
  if (tab) {
    markPlatformOpened();
    tab.focus();
    return { opened: true, destination, needsManualOpen: false };
  }

  markPlatformOpened();
  return { opened: false, destination, needsManualOpen: true };
}

export function openPlatformManually(destination: string): boolean {
  const tab = window.open(destination, PLATFORM_WINDOW_NAME);
  if (tab) {
    tab.focus();
    return true;
  }
  return false;
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
  clearAllReturnFlags();
  void exitPlaybackMode();
}
