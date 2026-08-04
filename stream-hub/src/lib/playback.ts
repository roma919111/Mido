import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { deepLinkHint } from "./deeplink";
import { addContinueWatching } from "./library";
import {
  buildLaunchTarget,
  openPlatformPlayback,
  PLATFORMS,
  toOfficialWebUrl,
} from "./platforms";

export const LAUNCH_COUNTDOWN_MS = 1200;

let launchTimer: number | undefined;

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

  if (launchTimer) window.clearTimeout(launchTimer);
  launchTimer = window.setTimeout(() => {
    void openPlatformPlayback(platform, webUrl).then((result) => {
      onComplete?.({ success: result.success, url: result.directUrl });
      launchTimer = undefined;
    });
  }, LAUNCH_COUNTDOWN_MS);
}

export function cancelLaunch() {
  if (launchTimer) {
    window.clearTimeout(launchTimer);
    launchTimer = undefined;
  }
}

export function openLaunchTarget(state: LaunchState): void {
  void openPlatformPlayback(state.platform, state.url);
}
