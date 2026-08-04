import { Capacitor } from "@capacitor/core";
import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { clearAllReturnFlags, clearPendingReturnHome, markPlatformOpened } from "./app-navigation";
import { exitPlaybackMode } from "./fullscreen";
import { deepLinkHint } from "./deeplink";
import { addContinueWatching, ensureInMyList } from "./library";
import { buildLaunchTarget, openPlatformPlayback, PLATFORMS, toOfficialWebUrl } from "./platforms";

export const LAUNCH_COUNTDOWN_MS = 0;
/** Popcorn runs while the browser opens — 5 seconds in parallel. */
export const POPCORN_DURATION_MS = 5000;

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
};

function openNamedTab(destination: string): Window | null {
  try {
    const tab = window.open(destination, PLATFORM_WINDOW_NAME);
    if (tab) return tab;
  } catch {
    /* fall through to anchor click */
  }

  try {
    const anchor = document.createElement("a");
    anchor.href = destination;
    anchor.target = PLATFORM_WINDOW_NAME;
    anchor.rel = "noopener noreferrer";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return window.open("", PLATFORM_WINDOW_NAME);
  } catch {
    return null;
  }
}

/**
 * Open platform browser synchronously inside the user click — before React
 * re-render or fullscreen, so Safari does not defer the popup until later.
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
    platformTab = null;
    return { opened: true, destination, needsManualOpen: false };
  }

  const tab = openNamedTab(destination);
  if (tab) {
    platformTab = tab;
    markPlatformOpened();
    notifyLaunchComplete(true, destination);
    try {
      tab.blur();
    } catch {
      /* ignore */
    }
    window.focus();
    return { opened: true, destination, needsManualOpen: false };
  }

  platformTab = null;
  markPlatformOpened();
  notifyLaunchComplete(true, destination);
  return { opened: false, destination, needsManualOpen: true };
}

/** After 5s popcorn: hide overlay and focus the tab opened at click time. */
export async function finishPopcornOverlay(state: LaunchState): Promise<void> {
  const destination =
    pendingDestination ?? buildLaunchTarget(state.platform, state.url).directUrl;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;

  await exitPlaybackMode();

  if (!Capacitor.isNativePlatform()) {
    try {
      let tab = platformTab;
      if (!tab || tab.closed) {
        tab = window.open("", PLATFORM_WINDOW_NAME);
      }
      if (tab && !tab.closed) {
        tab.focus();
      } else {
        openNamedTab(destination)?.focus();
      }
    } catch {
      /* ignore */
    }
    platformTab = null;
  }

  void state;
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
