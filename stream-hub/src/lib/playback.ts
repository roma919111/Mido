import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { deepLinkHint } from "./deeplink";
import { addContinueWatching, ensureInMyList } from "./library";
import {
  buildLaunchTarget,
  openPlatformPlayback,
  PLATFORMS,
  toOfficialWebUrl,
} from "./platforms";
import { markPendingReturnHome } from "./app-navigation";

export const LAUNCH_COUNTDOWN_MS = 0;

let pendingComplete: ((result: { success: boolean; url: string }) => void) | undefined;
let preparedLaunchWindow: Window | null = null;

/** Call synchronously on user click — Safari blocks delayed window.open. */
export function prepareLaunchWindow(): void {
  preparedLaunchWindow = null;
  try {
    preparedLaunchWindow = window.open("about:blank", "_blank");
  } catch {
    preparedLaunchWindow = null;
  }
}

export function clearPreparedLaunchWindow(): void {
  if (preparedLaunchWindow && !preparedLaunchWindow.closed) {
    preparedLaunchWindow.close();
  }
  preparedLaunchWindow = null;
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

export function cancelLaunch() {
  pendingComplete = undefined;
  clearPreparedLaunchWindow();
}

export function openLaunchTarget(state: LaunchState): void {
  const target = buildLaunchTarget(state.platform, state.url);
  const destination = target.directUrl;

  if (preparedLaunchWindow && !preparedLaunchWindow.closed) {
    try {
      preparedLaunchWindow.location.href = destination;
      preparedLaunchWindow.focus();
      markPendingReturnHome();
      pendingComplete?.({ success: true, url: destination });
      pendingComplete = undefined;
      preparedLaunchWindow = null;
      return;
    } catch {
      clearPreparedLaunchWindow();
    }
  }

  void openPlatformPlayback(state.platform, state.url).then((result) => {
    if (result.success) markPendingReturnHome();
    pendingComplete?.({ success: result.success, url: result.directUrl });
    pendingComplete = undefined;
  });
}
