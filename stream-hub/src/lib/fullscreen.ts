import { Capacitor } from "@capacitor/core";
import { enterImmersiveChrome } from "./browser-chrome";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

export const THEATER_CLASS = "stream-hub-theater";

export function isFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function isTheaterMode(): boolean {
  return document.documentElement.classList.contains(THEATER_CLASS);
}

export function enterTheaterMode(): void {
  document.documentElement.classList.add(THEATER_CLASS);
  document.body.classList.add(THEATER_CLASS);
}

export function exitTheaterMode(): void {
  document.documentElement.classList.remove(THEATER_CLASS);
  document.body.classList.remove(THEATER_CLASS);
}

function requestFullscreenOn(el: FullscreenElement): void {
  try {
    if (typeof el.requestFullscreen === "function") {
      void el.requestFullscreen();
      return;
    }
    if (typeof el.webkitRequestFullscreen === "function") {
      el.webkitRequestFullscreen();
    }
  } catch {
    /* theater CSS fallback — still covers the viewport */
  }
}

function playbackFullscreenTarget(target?: HTMLElement | null): FullscreenElement {
  return (target ?? document.body) as FullscreenElement;
}

/** Theater CSS + browser fullscreen — must run synchronously from click/tap. */
export function enterPlaybackMode(target?: HTMLElement | null): void {
  enterTheaterMode();
  enterImmersiveChrome();

  if (Capacitor.isNativePlatform()) {
    /* APK/WebView: native MainActivity hides system bars; element fullscreen breaks TV taps. */
    return;
  }

  requestFullscreenOn(playbackFullscreenTarget(target));
}

export async function exitPlaybackMode(): Promise<void> {
  exitTheaterMode();
  await exitFullscreen();
}

export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen()) return;
  const doc = document as FullscreenDocument;
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }
    if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    }
  } catch {
    /* ignore */
  }
}
