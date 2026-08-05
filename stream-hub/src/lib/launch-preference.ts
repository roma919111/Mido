export type LaunchPreference = "web" | "app";

const STORAGE_KEY = "max.launchMode";

/** Default: web browser — no Netflix/Shahid app install required. */
export function getLaunchPreference(): LaunchPreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "app") return "app";
  return "web";
}

export function setLaunchPreference(mode: LaunchPreference): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function launchPreferenceLabel(mode: LaunchPreference): string {
  return mode === "web" ? "المتصفح (بدون تحميل تطبيقات)" : "تطبيق المنصة (Netflix / شاهد)";
}
