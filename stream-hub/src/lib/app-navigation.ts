const PENDING_RETURN_KEY = "streamhub.pendingReturn";
const PLATFORM_OPENED_KEY = "max.platformOpened";

export function markPendingReturnHome(): void {
  sessionStorage.setItem(PENDING_RETURN_KEY, "1");
}

export function clearPendingReturnHome(): void {
  sessionStorage.removeItem(PENDING_RETURN_KEY);
}

export function hasPendingReturnHome(): boolean {
  return sessionStorage.getItem(PENDING_RETURN_KEY) === "1";
}

export function consumePendingReturnHome(): boolean {
  if (sessionStorage.getItem(PENDING_RETURN_KEY) !== "1") return false;
  sessionStorage.removeItem(PENDING_RETURN_KEY);
  return true;
}

export function markPlatformOpened(): void {
  sessionStorage.setItem(PLATFORM_OPENED_KEY, "1");
  markPendingReturnHome();
}

export function clearPlatformOpened(): void {
  sessionStorage.removeItem(PLATFORM_OPENED_KEY);
  clearPendingReturnHome();
}

export function wasPlatformOpened(): boolean {
  return sessionStorage.getItem(PLATFORM_OPENED_KEY) === "1";
}

export function clearAllReturnFlags(): void {
  clearPlatformOpened();
}
