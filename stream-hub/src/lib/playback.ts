import { Capacitor } from "@capacitor/core";
import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { markPendingReturnHome } from "./app-navigation";
import { deepLinkHint } from "./deeplink";
import { addContinueWatching, ensureInMyList } from "./library";
import { buildLaunchTarget, openPlatformPlayback, PLATFORMS, toOfficialWebUrl } from "./platforms";

export const LAUNCH_COUNTDOWN_MS = 0;
export const POPCORN_DURATION_MS = 3000;

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

/** Keep Stream Hub tab focused while popcorn plays. */
export function keepStreamHubFocused(): void {
  window.focus();
}

/** Repeated focus during popcorn — returns cleanup. */
export function startStreamHubFocusLoop(): () => void {
  keepStreamHubFocused();
  const intervalId = window.setInterval(keepStreamHubFocused, 120);
  const timeoutIds = [50, 150, 350, 700, 1200, 1800, 2500].map((ms) =>
    window.setTimeout(keepStreamHubFocused, ms),
  );
  return () => {
    window.clearInterval(intervalId);
    timeoutIds.forEach((id) => window.clearTimeout(id));
  };
}

/**
 * Step 1 (user click): reserve a hidden tab for Safari, show popcorn — no platform yet.
 */
export function beginOfficialLaunch(state: LaunchState): void {
  const target = buildLaunchTarget(state.platform, state.url);
  pendingDestination = target.directUrl;
  pendingPlatform = state.platform;
  pendingUrl = state.url;
  platformTab = null;
  markPendingReturnHome();

  if (Capacitor.isNativePlatform()) {
    return;
  }

  try {
    platformTab = window.open("about:blank", "_blank");
    if (platformTab) {
      try {
        platformTab.blur();
      } catch {
        /* ignore */
      }
    }
  } catch {
    platformTab = null;
  }

  keepStreamHubFocused();
}

/**
 * Step 2 (after popcorn): navigate to the official platform.
 */
export function finishPlatformLaunch(state: LaunchState): void {
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
    return;
  }

  if (platformTab && !platformTab.closed) {
    try {
      platformTab.location.href = destination;
      platformTab.focus();
      notifyLaunchComplete(true, destination);
      platformTab = null;
      return;
    } catch {
      platformTab = null;
    }
  }

  const opened = window.open(destination, "_blank", "noopener,noreferrer");
  notifyLaunchComplete(Boolean(opened), destination);
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
}
