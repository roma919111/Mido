const DELIVERED_KEY = "max.deviceDelivered";
const CUSTOMER_LABEL_KEY = "max.customerLabel";
const ADMIN_UNLOCK_KEY = "max.adminUnlocked";

export function isDeviceDelivered(): boolean {
  return localStorage.getItem(DELIVERED_KEY) === "1";
}

/** Mohammed finished setup — hand box to customer. */
export function deliverToCustomer(label?: string): void {
  localStorage.setItem(DELIVERED_KEY, "1");
  if (label?.trim()) {
    localStorage.setItem(CUSTOMER_LABEL_KEY, label.trim());
  }
  sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
}

export function getCustomerLabel(): string | null {
  return localStorage.getItem(CUSTOMER_LABEL_KEY);
}

export function setCustomerLabel(label: string): void {
  localStorage.setItem(CUSTOMER_LABEL_KEY, label.trim());
}

/** Re-open admin on a delivered device (e.g. service visit). */
export function undeliverDevice(): void {
  localStorage.setItem(DELIVERED_KEY, "0");
}

export function isAdminSessionOpen(): boolean {
  return sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "1";
}

export function openAdminSession(): void {
  sessionStorage.setItem(ADMIN_UNLOCK_KEY, "1");
}

export function closeAdminSession(): void {
  sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
}
