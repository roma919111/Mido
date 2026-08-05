/** Running as installed app (no browser address bar). */
export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

export function isBrowserTab(): boolean {
  return !isStandaloneApp();
}

const DISMISS_KEY = "max.installBannerDismissed";

export function isInstallBannerDismissed(): boolean {
  return localStorage.getItem(DISMISS_KEY) === "1";
}

export function dismissInstallBanner(): void {
  localStorage.setItem(DISMISS_KEY, "1");
}

export function isSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|Firefox/i.test(ua);
}

export function isIosDevice(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isAndroidDevice(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function isChromeBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Chrome|CriOS/i.test(ua) && !/Edg|OPR|Firefox/i.test(ua);
}

/** Safari/Chrome tab — address bar cannot be hidden without install (iOS) or fullscreen (Android). */
export function mustInstallToHideBrowser(): boolean {
  return isBrowserTab() && isIosDevice() && isSafariBrowser();
}

export function canTapToHideBrowser(): boolean {
  return isBrowserTab() && !isIosDevice();
}
