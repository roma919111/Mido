import { THEATER_CLASS } from "./fullscreen";
import { enterImmersiveChrome } from "./browser-chrome";

const APP_SHELL_CLASS = "max-app-shell";

export function enterAppShellMode(): void {
  document.documentElement.classList.add(APP_SHELL_CLASS);
  document.body.classList.add(APP_SHELL_CLASS);
  enterImmersiveChrome();
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
