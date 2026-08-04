import type { Session } from "../types";

const SESSION_KEY = "stream-hub-session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function expectedUsername(): string {
  return import.meta.env.VITE_APP_USERNAME?.trim() || "admin";
}

function expectedPassword(): string {
  return import.meta.env.VITE_APP_PASSWORD?.trim() || "changeme";
}

export function login(username: string, password: string): boolean {
  const ok =
    username.trim() === expectedUsername() && password === expectedPassword();
  if (!ok) return false;

  const session: Session = {
    username: username.trim(),
    issuedAt: Date.now(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return true;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
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
