import { Capacitor } from "@capacitor/core";

const NATIVE_CLASS = "max-native-app";

export function setupNativeShellClass(): void {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add(NATIVE_CLASS);
  document.body.classList.add(NATIVE_CLASS);
}

export function isNativeShell(): boolean {
  return document.documentElement.classList.contains(NATIVE_CLASS);
}
