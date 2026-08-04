import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { deepLinkHint } from "./deeplink";
import { addContinueWatching, ensureInMyList } from "./library";
import {
  buildLaunchTarget,
  openPlatformPlayback,
  PLATFORMS,
  toOfficialWebUrl,
} from "./platforms";

export const LAUNCH_COUNTDOWN_MS = 0;

let pendingComplete: ((result: { success: boolean; url: string }) => void) | undefined;

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
}

export function openLaunchTarget(state: LaunchState): void {
  void openPlatformPlayback(state.platform, state.url).then((result) => {
    pendingComplete?.({ success: result.success, url: result.directUrl });
    pendingComplete = undefined;
  });
}
