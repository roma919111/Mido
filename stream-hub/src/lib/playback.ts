import { Capacitor } from "@capacitor/core";
import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { markPendingReturnHome } from "./app-navigation";
import { deepLinkHint } from "./deeplink";
import { addContinueWatching, ensureInMyList } from "./library";
import { buildLaunchTarget, openPlatformPlayback, PLATFORMS, toOfficialWebUrl } from "./platforms";

export const LAUNCH_COUNTDOWN_MS = 0;

let pendingComplete: ((result: { success: boolean; url: string }) => void) | undefined;
let platformTab: Window | null = null;

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

/** Opens official site/app on user click; Netflix loads while popcorn plays on Stream Hub. */
export function openOfficialPlatformNow(state: LaunchState): boolean {
  const target = buildLaunchTarget(state.platform, state.url);
  const destination = target.directUrl;
  platformTab = null;

  if (Capacitor.isNativePlatform()) {
    void openPlatformPlayback(state.platform, state.url);
    markPendingReturnHome();
    return true;
  }

  try {
    platformTab = window.open(destination, "_blank");
    if (platformTab) {
      try {
        platformTab.blur();
        window.focus();
      } catch {
        /* keep Stream Hub visible for popcorn */
      }
      markPendingReturnHome();
      return true;
    }
  } catch {
    platformTab = null;
  }

  void openPlatformPlayback(state.platform, state.url).then((result) => {
    if (result.success) markPendingReturnHome();
  });

  return false;
}

/** After popcorn — switch to platform and notify launch complete. */
export function finishPlatformLaunch(state: LaunchState): void {
  focusPlatformTab();
  const destination = buildLaunchTarget(state.platform, state.url).directUrl;
  notifyLaunchComplete(true, destination);
}

export function focusPlatformTab(): void {
  if (platformTab && !platformTab.closed) {
    try {
      platformTab.focus();
    } catch {
      /* ignore */
    }
  }
  platformTab = null;
}

export function cancelLaunch() {
  pendingComplete = undefined;
  platformTab = null;
}
