import { Capacitor } from "@capacitor/core";

export type LaunchPreference = "smart" | "web" | "app";

const STORAGE_KEY = "max.launchMode";

/** Default on APK/TV: smart lazy install. Web/PWA: browser. */
export function getLaunchPreference(): LaunchPreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "smart" || stored === "web" || stored === "app") {
    return stored;
  }
  return Capacitor.isNativePlatform() ? "smart" : "web";
}

export function setLaunchPreference(mode: LaunchPreference): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function launchPreferenceLabel(mode: LaunchPreference): string {
  switch (mode) {
    case "smart":
      return "ذكي — ثبّت من Play Store عند الحاجة";
    case "web":
      return "المتصفح (بدون تحميل تطبيقات)";
    case "app":
      return "تطبيق المنصة دائماً";
  }
}
