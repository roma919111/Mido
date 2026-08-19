import type { IptvLoginResult } from "@/lib/iptv-client";
import { MEDIA_PLAYER_ACTIVATE_PATH } from "@/lib/media-player-commerce";

export const MAXVRONIX_MEDIA_URL = `https://vyronix.app${MEDIA_PLAYER_ACTIVATE_PATH}`;
export const MAXVRONIX_WHATSAPP = "97334399736";

const MAC_KEY = "maxvr.device.mac";
const PIN_KEY = "maxvr.device.pin";
const SAVED_AT_KEY = "maxvr.device.savedAt";
const COOKIE_NAME = "maxvr_device";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 730;
const IDB_NAME = "maxvr-device-v1";
const IDB_STORE = "kv";
const IDB_KEY = "identity";

export type DeviceIdentity = {
  mac: string;
  devicePin: string;
};

type StoredIdentity = DeviceIdentity & { savedAt: number };

function randomMacTail(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function isValidMac(mac: string | null | undefined): mac is string {
  return Boolean(mac && mac.replace(/[^a-fA-F0-9]/g, "").length === 12);
}

function isValidPin(pin: string | null | undefined): pin is string {
  return Boolean(pin && /^\d{4}$/.test(pin.replace(/\D/g, "")));
}

export function macEquals(a: string, b: string): boolean {
  return a.replace(/[^a-fA-F0-9]/g, "").toUpperCase() === b.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

function asStored(value: unknown): StoredIdentity | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as StoredIdentity;
  if (!isValidMac(parsed.mac) || !isValidPin(parsed.devicePin)) return null;
  return { mac: parsed.mac, devicePin: parsed.devicePin, savedAt: Number(parsed.savedAt) || 0 };
}

function newestIdentity(candidates: Array<StoredIdentity | null>): StoredIdentity | null {
  return candidates.reduce<StoredIdentity | null>((best, row) => {
    if (!row) return best;
    if (!best || row.savedAt >= best.savedAt) return row;
    return best;
  }, null);
}

function readCookieIdentity(): StoredIdentity | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return asStored(JSON.parse(decodeURIComponent(match[1])));
  } catch {
    return null;
  }
}

function writeCookieIdentity(identity: StoredIdentity): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(identity));
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : ""}`;
}

function readLocalIdentity(): StoredIdentity | null {
  if (typeof localStorage === "undefined") return null;
  const macStored = localStorage.getItem(MAC_KEY);
  const pinStored = localStorage.getItem(PIN_KEY);
  if (!isValidMac(macStored) || !isValidPin(pinStored)) return null;
  return { mac: macStored, devicePin: pinStored, savedAt: Number(localStorage.getItem(SAVED_AT_KEY)) || 1 };
}

function openIdentityDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
    } catch {
      resolve(null);
    }
  });
}

function readIdbIdentity(): Promise<StoredIdentity | null> {
  return openIdentityDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const get = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(IDB_KEY);
          get.onsuccess = () => {
            const stored = asStored(get.result);
            db.close();
            resolve(stored);
          };
          get.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      }),
  );
}

function writeIdbIdentity(identity: StoredIdentity): void {
  void openIdentityDb().then((db) => {
    if (!db) return;
    try {
      const put = db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put(identity, IDB_KEY);
      put.onsuccess = () => db.close();
      put.onerror = () => db.close();
    } catch {
      db.close();
    }
  });
}

function persistIdentity(identity: DeviceIdentity, savedAt = Date.now()): DeviceIdentity {
  const stored: StoredIdentity = { mac: identity.mac, devicePin: identity.devicePin, savedAt };
  localStorage.setItem(MAC_KEY, stored.mac);
  localStorage.setItem(PIN_KEY, stored.devicePin);
  localStorage.setItem(SAVED_AT_KEY, String(savedAt));
  writeCookieIdentity(stored);
  writeIdbIdentity(stored);
  return identity;
}

async function readServerIdentity(): Promise<StoredIdentity | null> {
  try {
    const res = await fetch("/api/iptv/device/me", { cache: "no-store", credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { identity?: DeviceIdentity | null };
    if (!isValidMac(data.identity?.mac) || !isValidPin(data.identity?.devicePin)) return null;
    return { mac: data.identity.mac, devicePin: data.identity.devicePin, savedAt: Date.now() };
  } catch {
    return null;
  }
}

function createFreshIdentity(): DeviceIdentity {
  return {
    mac: `00:1A:79:${randomMacTail()}`,
    devicePin: randomPin(),
  };
}

/** Keep MAC + PIN frozen in every browser store that Safari still allows. */
export function getOrCreateDeviceIdentity(): DeviceIdentity {
  const existing = newestIdentity([readCookieIdentity(), readLocalIdentity()]);
  if (existing) return persistIdentity(existing, existing.savedAt || Date.now());
  return persistIdentity(createFreshIdentity());
}

export async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  const local = newestIdentity([readCookieIdentity(), readLocalIdentity(), await readIdbIdentity()]);
  if (local) return persistIdentity(local, local.savedAt || Date.now());

  const fromServer = await readServerIdentity();
  if (fromServer) return persistIdentity(fromServer);

  return persistIdentity(createFreshIdentity());
}

export function saveDeviceIdentity(identity: DeviceIdentity): DeviceIdentity {
  return persistIdentity(identity);
}

/** Never replace a customer's MAC unless they restore it. Same MAC always keeps the original PIN. */
export function adoptServerIdentity(
  local: DeviceIdentity,
  server: { mac?: string; devicePin?: string; status?: string } | null,
  options?: { allowMacChange?: boolean },
): DeviceIdentity {
  if (!server?.mac || !server.devicePin) return saveDeviceIdentity(local);
  if (options?.allowMacChange || macEquals(server.mac, local.mac)) {
    return saveDeviceIdentity({ mac: server.mac, devicePin: server.devicePin });
  }
  return saveDeviceIdentity(local);
}

export function mediaPlayerDeviceUrl(mac: string, devicePin: string): string {
  const q = new URLSearchParams({ mac, pin: devicePin });
  return `${MAXVRONIX_MEDIA_URL}?${q.toString()}`;
}

export function identityFromLocationSearch(search = typeof window === "undefined" ? "" : window.location.search): DeviceIdentity | null {
  const params = new URLSearchParams(search);
  const mac = params.get("mac")?.trim() ?? "";
  const devicePin = (params.get("pin") ?? params.get("devicePin") ?? "").trim();
  if (isValidMac(mac) && isValidPin(devicePin)) {
    return { mac, devicePin };
  }
  return null;
}

export function buildWhatsAppShareUrl(
  mac: string,
  devicePin: string,
  creds?: { host?: string; username?: string; password?: string },
): string {
  const openUrl = mediaPlayerDeviceUrl(mac, devicePin);
  const text = [
    "طلب تفعيل Vyronix Max Media",
    "",
    `افتح هذا الرابط بعد التفعيل:`,
    openUrl,
    "",
    `📡 MAC Address: ${mac}`,
    `🔢 رقم الجهاز: ${devicePin}`,
    `Host: ${creds?.host?.trim() || ""}`,
    `Username: ${creds?.username?.trim() || ""}`,
    `Password: ${creds?.password?.trim() || ""}`,
    "",
    "الرجاء تفعيل الاشتراك على هذا الجهاز.",
  ].join("\n");

  return `https://wa.me/${MAXVRONIX_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

export type DeviceStatusResponse = {
  status: "pending" | "disabled" | "not_found" | "active";
  label?: string;
  mac?: string;
  devicePin?: string;
};

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("تعذّر الاتصال بالسيرفر — حاول مرة أخرى");
  }
}

export async function registerDevice(mac: string, devicePin: string): Promise<DeviceIdentity & { status?: string }> {
  const res = await fetch("/api/iptv/device/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mac, devicePin }),
    cache: "no-store",
    credentials: "include",
  });
  const data = await readJson<{ mac?: string; devicePin?: string; status?: string; error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Register failed");
  return {
    mac: data.mac || mac,
    devicePin: data.devicePin || devicePin,
    status: data.status,
  };
}

export async function checkDeviceStatus(mac: string, devicePin: string): Promise<DeviceStatusResponse> {
  const q = new URLSearchParams({ mac, devicePin });
  const res = await fetch(`/api/iptv/device/status?${q}`, { cache: "no-store", credentials: "include" });
  const data = await readJson<DeviceStatusResponse & { error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Status check failed");
  return data;
}

export async function connectDevice(mac: string, devicePin: string): Promise<IptvLoginResult & { status: "active"; mac?: string; devicePin?: string }> {
  const res = await fetch("/api/iptv/device/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mac, devicePin }),
    cache: "no-store",
    credentials: "include",
  });
  const data = await readJson<IptvLoginResult & { status: "active"; mac?: string; devicePin?: string; error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Connect failed");
  return data;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
