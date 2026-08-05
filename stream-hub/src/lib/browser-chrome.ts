import { isBrowserTab, isIosDevice, isSafariBrowser, isStandaloneApp } from "./display-mode";

export const IMMERSIVE_CLASS = "max-immersive";

/** Collapse Safari/Chrome UI chrome and lock the app to the visible viewport. */
export function enterImmersiveChrome(): void {
  if (typeof window === "undefined") return;

  document.documentElement.classList.add(IMMERSIVE_CLASS);

  const syncViewport = () => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty("--app-vh", `${height}px`);
  };

  syncViewport();
  window.visualViewport?.addEventListener("resize", syncViewport);
  window.addEventListener("orientationchange", syncViewport);

  if (!isStandaloneApp() && isBrowserTab()) {
    collapseSafariAddressBar();
  }
}

export function collapseSafariAddressBar(): void {
  if (!isIosDevice() || !isSafariBrowser() || isStandaloneApp()) return;

  requestAnimationFrame(() => {
    window.scrollTo(0, 1);
    requestAnimationFrame(() => window.scrollTo(0, 0));
  });
}
