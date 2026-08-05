import { Capacitor } from "@capacitor/core";
import type { CatalogItem, LaunchState, PlatformId } from "../types";
import { clearAllReturnFlags, clearPendingReturnHome, markPlatformOpened } from "./app-navigation";
import { isIosDevice } from "./display-mode";
import { exitPlaybackMode } from "./fullscreen";
import { deepLinkHint } from "./deeplink";
import { getLaunchPreference } from "./launch-preference";
import { addContinueWatching, ensureInMyList } from "./library";
import { openPlatformWebView } from "./platform-browser";
import {
  forceAppLaunch,
  installPlatformAndRemember,
  openPlatformViaBrowser,
  smartLaunchPlatform,
  type SmartLaunchResult,
} from "./platform-smart-launch";
import {
  buildLaunchTarget,
  isAndroidDevice,
  openPlatformPlayback,
  PLATFORMS,
  toOfficialWebUrl,
} from "./platforms";

export const LAUNCH_COUNTDOWN_MS = 0;
export const POPCORN_DURATION_MS = 5000;

let pendingComplete: ((result: { success: boolean; url: string }) => void) | undefined;
let pendingDestination: string | null = null;
let pendingPlatform: PlatformId | null = null;
let pendingUrl: string | null = null;
let pendingTitle: string | null = null;

export type InstallPromptPayload = {
  platform: PlatformId;
  url: string;
  title: string;
};

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
  pendingTitle = item.title;
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

export function prepareLaunch(state: LaunchState): void {
  const target = buildLaunchTarget(state.platform, state.url);
  pendingDestination = target.directUrl;
  pendingPlatform = state.platform;
  pendingUrl = state.url;
  pendingTitle = state.title;
  clearPendingReturnHome();
}

export type PlatformLaunchResult = {
  opened: boolean;
  destination: string;
  needsManualOpen: boolean;
};

function navigateToPlatformSameTab(destination: string): void {
  markPlatformOpened();
  const go = new URL(window.location.href);
  go.search = "";
  go.hash = "";
  go.searchParams.set("maxGo", "1");
  go.searchParams.set("dest", destination);
  window.location.assign(go.toString());
}

export function openPlatformBrowserSync(state: LaunchState): PlatformLaunchResult {
  const destination =
    pendingDestination ?? buildLaunchTarget(state.platform, state.url).directUrl;

  notifyLaunchComplete(true, destination);
  return { opened: false, destination, needsManualOpen: false };
}

export type PopcornFinishResult = {
  success: boolean;
  destination: string;
  installPrompt?: InstallPromptPayload;
};

async function dispatchLaunch(
  platform: PlatformId,
  url: string,
  title: string,
  destination: string,
): Promise<PopcornFinishResult> {
  const pref = getLaunchPreference();

  if (Capacitor.isNativePlatform() && pref === "smart") {
    const result = await smartLaunchPlatform(platform, destination, title);
    return mapSmartResult(result, destination);
  }

  if (Capacitor.isNativePlatform() && pref === "app") {
    const result = await forceAppLaunch(platform, destination, title);
    return mapSmartResult(result, destination);
  }

  if (pref === "web" || Capacitor.isNativePlatform()) {
    const ok = await openPlatformWebView(destination);
    notifyLaunchComplete(ok, destination);
    return { success: ok, destination };
  }

  if (isAndroidDevice() || isIosDevice()) {
    const result = await openPlatformPlayback(platform, url);
    notifyLaunchComplete(result.success, result.directUrl);
    return { success: result.success, destination: result.directUrl };
  }

  navigateToPlatformSameTab(destination);
  return { success: true, destination };
}

function mapSmartResult(result: SmartLaunchResult, destination: string): PopcornFinishResult {
  if (result.action === "needs-install-prompt") {
    notifyLaunchComplete(false, destination);
    return {
      success: false,
      destination,
      installPrompt: {
        platform: result.platform,
        url: result.url,
        title: result.title,
      },
    };
  }

  const success =
    result.action === "opened-app" ||
    result.action === "opened-browser" ||
    result.action === "opened-play-store";
  notifyLaunchComplete(success, result.url);
  return { success, destination: result.url };
}

export async function finishPopcornOverlay(state: LaunchState): Promise<PopcornFinishResult> {
  const platform = pendingPlatform ?? state.platform;
  const url = pendingUrl ?? state.url;
  const title = pendingTitle ?? state.title;
  const destination =
    pendingDestination ?? buildLaunchTarget(platform, url).directUrl;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;
  pendingTitle = null;

  return dispatchLaunch(platform, url, title, destination);
}

export async function openPlatformManually(
  platform: PlatformId,
  destination: string,
  title = platform,
): Promise<PopcornFinishResult> {
  await exitPlaybackMode();
  return dispatchLaunch(platform, destination, title, destination);
}

export async function confirmInstallFromPlayStore(
  platform: PlatformId,
  url: string,
  title: string,
): Promise<boolean> {
  return installPlatformAndRemember(platform, url, title);
}

export async function confirmBrowserPlayback(url: string): Promise<boolean> {
  return openPlatformViaBrowser(url);
}

export function cancelLaunch() {
  pendingComplete = undefined;
  pendingDestination = null;
  pendingPlatform = null;
  pendingUrl = null;
  pendingTitle = null;
  clearAllReturnFlags();
  void exitPlaybackMode();
}
