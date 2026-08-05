import { Capacitor } from "@capacitor/core";
import { enterImmersiveChrome, collapseSafariAddressBar } from "./browser-chrome";
import { isStandaloneApp } from "./display-mode";
import { enterPlaybackMode, exitPlaybackMode, isFullscreen } from "./fullscreen";

const KIOSK_KEY = "max.kioskMode";

export const KIOSK_CLASS = "max-kiosk";

type WakeLockSentinel = { release: () => Promise<void> };

let wakeLock: WakeLockSentinel | null = null;
let guardsAttached = false;

export function isKioskEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(KIOSK_KEY);
  if (stored === "0") return false;
  if (stored === "1") return true;
  // Default on when installed as PWA / native app
  return isStandaloneApp() || Capacitor.isNativePlatform();
}

export function setKioskEnabled(enabled: boolean): void {
  localStorage.setItem(KIOSK_KEY, enabled ? "1" : "0");
  if (enabled) void enterKioskMode();
  else void exitKioskMode();
}

export async function enterKioskMode(): Promise<void> {
  document.documentElement.classList.add(KIOSK_CLASS);
  document.body.classList.add(KIOSK_CLASS);

  if (Capacitor.isNativePlatform()) {
    // MainActivity already hides system bars — theater/fullscreen breaks WebView taps on TV.
    await acquireWakeLock();
    attachKioskGuards();
    return;
  }

  enterImmersiveChrome();
  enterPlaybackMode();
  await acquireWakeLock();
  attachKioskGuards();
}

export async function exitKioskMode(): Promise<void> {
  document.documentElement.classList.remove(KIOSK_CLASS);
  document.body.classList.remove(KIOSK_CLASS);
  await releaseWakeLock();
  await exitPlaybackMode();
}

async function acquireWakeLock(): Promise<void> {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await (
      navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> } }
    ).wakeLock.request("screen");
  } catch {
    /* ignore — needs fullscreen or PWA on some browsers */
  }
}

async function releaseWakeLock(): Promise<void> {
  try {
    await wakeLock?.release();
  } catch {
    /* ignore */
  }
  wakeLock = null;
}

function onVisibilityRestoreKiosk(): void {
  if (document.visibilityState !== "visible") return;
  if (!isKioskEnabled()) return;
  enterImmersiveChrome();
  enterPlaybackMode();
  void acquireWakeLock();
}

function attachKioskGuards(): void {
  if (guardsAttached) return;
  guardsAttached = true;

  document.addEventListener("contextmenu", preventWhenKiosk);
  document.addEventListener("visibilitychange", onVisibilityRestoreKiosk);
  window.addEventListener("focus", onVisibilityRestoreKiosk);
  document.addEventListener(
    "touchstart",
    () => {
      if (!isKioskEnabled()) return;
      enterImmersiveChrome();
      if (!isFullscreen()) enterPlaybackMode();
      collapseSafariAddressBar();
    },
    { passive: true },
  );
}

/** Call from a user tap — only way to hide Chrome toolbar in browser tab. */
export async function requestHideBrowserChrome(): Promise<boolean> {
  setKioskEnabled(true);
  await enterKioskMode();
  return isFullscreen() || isStandaloneApp() || Capacitor.isNativePlatform();
}

export function setupKioskOnBoot(): void {
  attachKioskGuards();
  if (Capacitor.isNativePlatform()) {
    void exitPlaybackMode();
    document.documentElement.classList.remove(KIOSK_CLASS);
    document.body.classList.remove(KIOSK_CLASS);
    if (isKioskEnabled()) void enterKioskMode();
    return;
  }
  if (isKioskEnabled()) void enterKioskMode();
}

function preventWhenKiosk(e: Event): void {
  if (!isKioskEnabled()) return;
  e.preventDefault();
}
