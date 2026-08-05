import { Capacitor } from "@capacitor/core";
const CUSTOMER_MODE_KEY = "max.customerMode";
const BOOT_DONE_KEY = "max.customerBootDone";
const PREFERRED_PLATFORM_KEY = "max.preferredPlatform";

/** Native APK: always customer UI — admin is hidden (5× logo tap). */
export function isCustomerMode(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  return localStorage.getItem(CUSTOMER_MODE_KEY) !== "0";
}

export function setCustomerMode(enabled: boolean): void {
  localStorage.setItem(CUSTOMER_MODE_KEY, enabled ? "1" : "0");
}

export function isCustomerBootDone(): boolean {
  return localStorage.getItem(BOOT_DONE_KEY) === "1";
}

export function markCustomerBootDone(): void {
  localStorage.setItem(BOOT_DONE_KEY, "1");
}

export function resetCustomerBoot(): void {
  localStorage.removeItem(BOOT_DONE_KEY);
}

export function getPreferredPlatform(): string | null {
  return localStorage.getItem(PREFERRED_PLATFORM_KEY);
}

export function setPreferredPlatform(platform: string): void {
  localStorage.setItem(PREFERRED_PLATFORM_KEY, platform);
}

/** One-click: ready for customer — skip boot screen, customer tiles only. */
export function prepareCustomerHandoff(): void {
  setCustomerMode(true);
  markCustomerBootDone();
}

