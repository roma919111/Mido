import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { addContinueWatching } from "./library";
import { PLATFORMS } from "./platforms";

/** Prefer native app on Android when a deep-link scheme exists. */
function toDeepLink(platform: PlatformId, webUrl: string): string {
  if (platform === "netflix" && webUrl.includes("/title/")) {
    const id = webUrl.split("/title/")[1]?.split(/[/?#]/)[0];
    if (id) return `nflx://www.netflix.com/title/${id}`;
  }
  return webUrl;
}

let launchTimer: number | undefined;

export function launchOnPlatform(
  item: CatalogItem,
  platform: PlatformId,
  url: string,
  onLaunching: (state: LaunchState) => void,
) {
  const meta = PLATFORMS[platform];
  addContinueWatching(item, platform, url);
  onLaunching({
    platformName: meta.name,
    title: item.title,
    url,
  });

  if (launchTimer) window.clearTimeout(launchTimer);
  const target = toDeepLink(platform, url);
  launchTimer = window.setTimeout(() => {
    window.location.href = target;
  }, 900);
}

export function cancelLaunch() {
  if (launchTimer) {
    window.clearTimeout(launchTimer);
    launchTimer = undefined;
  }
}
