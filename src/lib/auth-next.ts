import { isAdminEmail } from "@/lib/admin-shared";

const AUTH_PATHS = new Set(["/login", "/signup"]);

/** Same-origin return path only — never protocol-relative or auth loops. */
export function safeAuthNextPath(
  raw: string | null | undefined,
  fallback = "/",
): string {
  const value = String(raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  if (value.includes("://")) return fallback;
  const pathOnly = value.split("?")[0]?.split("#")[0] || "/";
  if (AUTH_PATHS.has(pathOnly) || pathOnly.startsWith("/login/") || pathOnly.startsWith("/signup/")) {
    return fallback;
  }
  if (pathOnly === "/api" || pathOnly.startsWith("/api/")) return fallback;
  return value;
}

export function authReturnPath(pathname: string, existingNext?: string | null): string {
  const path = (pathname || "/").split("?")[0] || "/";
  if (AUTH_PATHS.has(path) || path.startsWith("/login/") || path.startsWith("/signup/")) {
    return safeAuthNextPath(existingNext);
  }
  return safeAuthNextPath(path);
}

export function loginHref(nextPath?: string | null): string {
  const next = safeAuthNextPath(nextPath);
  if (next === "/") return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}

export function signupHref(nextPath?: string | null): string {
  const next = safeAuthNextPath(nextPath);
  if (next === "/") return "/signup";
  return `/signup?next=${encodeURIComponent(next)}`;
}

/** Operator account should land on the admin console, not marketing home. */
export function postAuthDestination(
  next: string | null | undefined,
  email?: string | null,
): string {
  const dest = safeAuthNextPath(next);
  if (dest === "/" && isAdminEmail(email)) return "/admin";
  return dest;
}
