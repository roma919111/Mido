import { Capacitor } from "@capacitor/core";
import { deliverToCustomer } from "./admin-mode";
import { ensureAutoSession } from "./auth";
import { prepareCustomerHandoff } from "./customer-mode";

/** Native APK: zero screens for end customer — straight to platform tiles. */
export function bootstrapCustomerApk(): void {
  if (!Capacitor.isNativePlatform()) return;
  prepareCustomerHandoff();
  deliverToCustomer();
  ensureAutoSession();
}

export function isNativeCustomerApk(): boolean {
  return Capacitor.isNativePlatform();
}
