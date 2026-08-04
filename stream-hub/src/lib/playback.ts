import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { addContinueWatching } from "./library";
import { PLATFORMS } from "./platforms";

let launchTimer: number | undefined;

/** Normalize to a secure official web URL (always works in browser / Custom Tabs). */
export function toOfficialWebUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

/**
 * Open official platform page. Returns whether a new tab/window opened.
 * Never uses nflx:// or other app schemes — they fail silently in most browsers.
 */
export function openOfficialPlayback(url: string): boolean {
  const webUrl = toOfficialWebUrl(url);
  const popup = window.open(webUrl, "_blank", "noopener,noreferrer");
  if (popup) {
    popup.focus?.();
    return true;
  }
  // Popup blocked (common in embedded previews) — navigate current tab.
  window.location.assign(webUrl);
  return false;
}

export function launchOnPlatform(
  item: CatalogItem,
  platform: PlatformId,
  url: string,
  onLaunching: (state: LaunchState) => void,
  onComplete?: (result: { opened: boolean; url: string }) => void,
) {
  const meta = PLATFORMS[platform];
  const webUrl = toOfficialWebUrl(url);
  addContinueWatching(item, platform, webUrl);
  onLaunching({
    platformName: meta.name,
    title: item.title,
    url: webUrl,
  });

  if (launchTimer) window.clearTimeout(launchTimer);
  launchTimer = window.setTimeout(() => {
    const opened = openOfficialPlayback(webUrl);
    onComplete?.({ opened, url: webUrl });
    launchTimer = undefined;
  }, 700);
}

export function cancelLaunch() {
  if (launchTimer) {
    window.clearTimeout(launchTimer);
    launchTimer = undefined;
  }
}

/** Immediate open — for manual tap on overlay button. */
export function openLaunchTarget(state: LaunchState): boolean {
  return openOfficialPlayback(state.url);
}
