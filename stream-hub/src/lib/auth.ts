import { Capacitor } from "@capacitor/core";
import type { Session } from "../types";
import { isDeviceDelivered } from "./admin-mode";
import { isCustomerMode } from "./customer-mode";

const SESSION_KEY = "stream-hub-session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 365; // 1 year on TV boxes

function expectedUsername(): string {
  return import.meta.env.VITE_APP_USERNAME?.trim() || "admin";
}

function expectedPassword(): string {
  return import.meta.env.VITE_APP_PASSWORD?.trim() || "changeme";
}

function storage(): Storage {
  return Capacitor.isNativePlatform() ? localStorage : sessionStorage;
}

export function login(username: string, password: string): boolean {
  const ok =
    username.trim() === expectedUsername() && password === expectedPassword();
  if (!ok) return false;

  const session: Session = {
    username: username.trim(),
    issuedAt: Date.now(),
  };
  storage().setItem(SESSION_KEY, JSON.stringify(session));
  return true;
}

/** Auto session only after admin delivered device to customer. */
export function ensureAutoSession(): Session | null {
  const existing = getSession();
  if (existing) return existing;
  if (!Capacitor.isNativePlatform() || !isDeviceDelivered() || !isCustomerMode()) {
    return null;
  }
  const ok = login(expectedUsername(), expectedPassword());
  return ok ? getSession() : null;
}

export function isAdminUser(): boolean {
  const session = getSession();
  return session?.username === expectedUsername();
}

export function logout() {
  storage().removeItem(SESSION_KEY);
}

export function getSession(): Session | null {
  try {
    const raw = storage().getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (Date.now() - session.issuedAt > SESSION_TTL_MS) {
      logout();
      return null;
    }
    return session;
  } catch {
    logout();
    return null;
  }
}
