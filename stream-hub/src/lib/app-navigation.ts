const PENDING_RETURN_KEY = "streamhub.pendingReturn";

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
