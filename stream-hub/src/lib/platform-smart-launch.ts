import { Capacitor } from "@capacitor/core";
import type { PlatformId } from "../types";
import { markPlatformOpened } from "./app-navigation";
import { openPlatformWebView } from "./platform-browser";
import {
  isPlatformAppInstalled,
  launchNativePlatformApp,
  openPlatformPlayStore,
} from "./platform-launch-native";
import { openPlatformPlayback } from "./platforms";

const PENDING_KEY = "max.pendingPlatformPlay";

export type PendingPlatformPlay = {
  platform: PlatformId;
  url: string;
  title: string;
  savedAt: number;
};

export type SmartLaunchResult =
  | { action: "opened-app"; url: string }
  | { action: "opened-browser"; url: string }
  | { action: "opened-play-store"; url: string }
  | { action: "needs-install-prompt"; platform: PlatformId; url: string; title: string }
  | { action: "failed"; url: string };

export function savePendingPlatformPlay(play: PendingPlatformPlay): void {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(play));
}

export function peekPendingPlatformPlay(): PendingPlatformPlay | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingPlatformPlay;
  } catch {
    return null;
  }
}

export function clearPendingPlatformPlay(): void {
  sessionStorage.removeItem(PENDING_KEY);
}

export async function smartLaunchPlatform(
  platform: PlatformId,
  url: string,
  title: string,
): Promise<SmartLaunchResult> {
  if (!Capacitor.isNativePlatform()) {
    markPlatformOpened();
    const ok = await openPlatformWebView(url);
    return ok ? { action: "opened-browser", url } : { action: "failed", url };
  }

  const installed = await isPlatformAppInstalled(platform);
  if (installed) {
    markPlatformOpened();
    clearPendingPlatformPlay();
    const ok = await launchNativePlatformApp(platform, url);
    return ok ? { action: "opened-app", url } : { action: "failed", url };
  }

  return { action: "needs-install-prompt", platform, url, title };
}

export async function openPlatformViaBrowser(url: string): Promise<boolean> {
  markPlatformOpened();
  clearPendingPlatformPlay();
  return openPlatformWebView(url);
}

export async function installPlatformAndRemember(
  platform: PlatformId,
  url: string,
  title: string,
): Promise<boolean> {
  savePendingPlatformPlay({ platform, url, title, savedAt: Date.now() });
  return openPlatformPlayStore(platform);
}

/** After returning from Play Store — open app if now installed. */
export async function retryPendingPlatformPlay(): Promise<SmartLaunchResult | null> {
  const pending = peekPendingPlatformPlay();
  if (!pending) return null;

  const installed = await isPlatformAppInstalled(pending.platform);
  if (!installed) return null;

  markPlatformOpened();
  clearPendingPlatformPlay();
  const ok = await launchNativePlatformApp(pending.platform, pending.url);
  if (ok) {
    return { action: "opened-app", url: pending.url };
  }
  return { action: "failed", url: pending.url };
}

export async function forceAppLaunch(
  platform: PlatformId,
  url: string,
  title: string,
): Promise<SmartLaunchResult> {
  if (!Capacitor.isNativePlatform()) {
    const result = await openPlatformPlayback(platform, url);
    return result.success
      ? { action: "opened-browser", url: result.directUrl }
      : { action: "failed", url };
  }

  const installed = await isPlatformAppInstalled(platform);
  if (installed) {
    markPlatformOpened();
    const ok = await launchNativePlatformApp(platform, url);
    return ok ? { action: "opened-app", url } : { action: "failed", url };
  }

  savePendingPlatformPlay({ platform, url, title, savedAt: Date.now() });
  const ok = await openPlatformPlayStore(platform);
  return ok ? { action: "opened-play-store", url } : { action: "failed", url };
}
