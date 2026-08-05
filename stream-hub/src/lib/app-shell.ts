import { THEATER_CLASS } from "./fullscreen";
import { enterImmersiveChrome } from "./browser-chrome";
import { isKioskEnabled, KIOSK_CLASS } from "./kiosk-mode";

const APP_SHELL_CLASS = "max-app-shell";

export function enterAppShellMode(): void {
  document.documentElement.classList.add(APP_SHELL_CLASS);
  document.body.classList.add(APP_SHELL_CLASS);
  document.documentElement.classList.add("gtv-launcher-active");
  document.body.classList.add("gtv-launcher-active");
  enterImmersiveChrome();
  if (isKioskEnabled()) {
    document.documentElement.classList.add(KIOSK_CLASS);
    document.body.classList.add(KIOSK_CLASS);
  }
}

export function exitAppShellMode(): void {
  document.documentElement.classList.remove(APP_SHELL_CLASS);
  document.body.classList.remove(APP_SHELL_CLASS);
  document.documentElement.classList.remove(THEATER_CLASS);
  document.body.classList.remove(THEATER_CLASS);
}

export function isAppShellMode(): boolean {
  return document.documentElement.classList.contains(APP_SHELL_CLASS);
}
