import type { PlatformId } from "../types";

export type PlatformCredentials = {
  username: string;
  password: string;
  updatedAt: number;
};

export type PlatformAccountsStore = Partial<Record<PlatformId, PlatformCredentials>>;

const STORAGE_KEY = "stream-hub-platform-accounts";

export function loadPlatformAccounts(): PlatformAccountsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PlatformAccountsStore;
  } catch {
    return {};
  }
}

export function savePlatformAccount(
  platform: PlatformId,
  username: string,
  password: string,
): PlatformAccountsStore {
  const current = loadPlatformAccounts();
  const next: PlatformAccountsStore = {
    ...current,
    [platform]: {
      username: username.trim(),
      password,
      updatedAt: Date.now(),
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearPlatformAccount(platform: PlatformId): PlatformAccountsStore {
  const current = loadPlatformAccounts();
  const next = { ...current };
  delete next[platform];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function hasPlatformAccount(platform: PlatformId): boolean {
  const entry = loadPlatformAccounts()[platform];
  return Boolean(entry?.username?.trim());
}
