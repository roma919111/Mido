import { Browser } from "@capacitor/browser";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PlatformId } from "../types";
import { PLATFORMS } from "./platforms";

type PlatformLaunchPlugin = {
  openPlatform(options: {
    url: string;
    packageName?: string;
    fallbackPackage?: string;
  }): Promise<void>;
  isInstalled(options: {
    packageName: string;
    fallbackPackage?: string;
  }): Promise<{ installed: boolean }>;
  openPlayStore(options: { packageName: string }): Promise<void>;
};

const PlatformLaunch = registerPlugin<PlatformLaunchPlugin>("PlatformLaunch");

const TV_NETFLIX = "com.netflix.ninja";
const PHONE_NETFLIX = "com.netflix.mediaclient";

export function isAndroidTvDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /Android TV|GoogleTV|Google TV|AFT[A-Z0-9]|Bravia|SmartTV|Tizen|Web0S|CrKey/i.test(ua) ||
    (/\bAndroid\b/i.test(ua) &&
      typeof window !== "undefined" &&
      window.screen.width >= 960 &&
      window.screen.height >= 540 &&
      !/Mobile/i.test(ua))
  );
}

export function getAndroidPackages(platform: PlatformId): {
  primary: string;
  fallback?: string;
  playStorePackage: string;
} {
  const meta = PLATFORMS[platform];
  if (platform === "netflix" && isAndroidTvDevice()) {
    return { primary: TV_NETFLIX, fallback: PHONE_NETFLIX, playStorePackage: TV_NETFLIX };
  }
  if (platform === "netflix") {
    return { primary: PHONE_NETFLIX, fallback: TV_NETFLIX, playStorePackage: PHONE_NETFLIX };
  }
  return { primary: meta.androidPackage, playStorePackage: meta.androidPackage };
}

export async function isPlatformAppInstalled(platform: PlatformId): Promise<boolean> {
  const pkgs = getAndroidPackages(platform);
  try {
    const result = await PlatformLaunch.isInstalled({
      packageName: pkgs.primary,
      fallbackPackage: pkgs.fallback,
    });
    return result.installed;
  } catch {
    return false;
  }
}

export async function openPlatformPlayStore(platform: PlatformId): Promise<boolean> {
  const pkgs = getAndroidPackages(platform);
  const webUrl = PLATFORMS[platform].playStoreUrl;

  try {
    await PlatformLaunch.openPlayStore({ packageName: pkgs.playStorePackage });
    return true;
  } catch {
    /* try alternate package on TV */
  }

  if (pkgs.fallback && pkgs.fallback !== pkgs.playStorePackage) {
    try {
      await PlatformLaunch.openPlayStore({ packageName: pkgs.fallback });
      return true;
    } catch {
      /* fall through */
    }
  }

  try {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: webUrl, toolbarColor: "#070b18" });
    } else {
      window.open(webUrl, "_blank", "noopener,noreferrer");
    }
    return true;
  } catch {
    return false;
  }
}

export async function launchNativePlatformApp(platform: PlatformId, url: string): Promise<boolean> {
  const pkgs = getAndroidPackages(platform);
  try {
    await PlatformLaunch.openPlatform({
      url,
      packageName: pkgs.primary,
      fallbackPackage: pkgs.fallback,
    });
    return true;
  } catch {
    return false;
  }
}
