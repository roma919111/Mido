import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { addContinueWatching } from "./library";
import {
  buildLaunchTarget,
  openPlatformPlayback,
  PLATFORMS,
  toOfficialWebUrl,
} from "./platforms";

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

  addContinueWatching(item, platform, webUrl);
  onLaunching({
    platform,
    platformName: meta.name,
    title: item.title,
    url: webUrl,
    launchMode: target.mode,
    launchLabel: target.label,
  });

  if (launchTimer) window.clearTimeout(launchTimer);
  launchTimer = window.setTimeout(() => {
    const result = openPlatformPlayback(platform, webUrl);
    onComplete?.({ success: result.success, url: webUrl });
    launchTimer = undefined;
  }, 600);
}

export function cancelLaunch() {
  if (launchTimer) {
    window.clearTimeout(launchTimer);
    launchTimer = undefined;
  }
}

export function openLaunchTarget(state: LaunchState): boolean {
  const result = openPlatformPlayback(state.platform, state.url);
  return result.success;
}
