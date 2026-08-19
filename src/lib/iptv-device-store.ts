import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  daysLeftFromIso,
  formatExpiryAr,
  normalizeCustomerPhone,
} from "@/lib/iptv-device-fields";
import { normalizeHost } from "@/lib/xtream-url";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "iptv-devices.json");

export type IptvDeviceStatus = "pending" | "active" | "disabled";

export type IptvDeviceRecord = {
  id: string;
  mac: string;
  devicePin: string;
  status: IptvDeviceStatus;
  host?: string;
  username?: string;
  password?: string;
  customerNote?: string;
  customerPhone?: string;
  expiresAt?: string;
  activatedAt?: string;
  activatedBy?: string;
  cachedSessionId?: string;
  cachedSessionAt?: string;
  disabledReason?: "expired" | "admin";
  createdAt: string;
  lastSeenAt?: string;
};

export type IptvDevicePublic = Omit<IptvDeviceRecord, "password" | "cachedSessionId"> & {
  expiresLabel: string | null;
  daysLeft: number | null;
};

export type IptvDeviceAdmin = IptvDeviceRecord & {
  expiresLabel: string | null;
  daysLeft: number | null;
};

type DeviceDb = {
  devices: IptvDeviceRecord[];
};

function applyExpiry(devices: IptvDeviceRecord[]): boolean {
  const now = Date.now();
  const minExpiry = Date.parse("2020-01-01T00:00:00Z");
  let changed = false;
  for (const record of devices) {
    if (record.status !== "active" || !record.expiresAt) continue;
    const ms = Date.parse(record.expiresAt);
    if (!Number.isFinite(ms) || ms < minExpiry || ms > now) continue;
    record.status = "disabled";
    record.disabledReason = "expired";
    record.cachedSessionId = undefined;
    record.cachedSessionAt = undefined;
    changed = true;
  }
  return changed;
}

async function loadDb(): Promise<DeviceDb> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as DeviceDb;
    const devices = Array.isArray(parsed.devices) ? parsed.devices : [];
    if (applyExpiry(devices)) {
      const db = { devices };
      await saveDb(db);
      return db;
    }
    return { devices };
  } catch {
    return { devices: [] };
  }
}

async function saveDb(db: DeviceDb): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

export function normalizeMac(raw: string): string {
  const hex = westernizeDigits(raw).replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (hex.length !== 12) {
    throw new Error("MAC Address يجب أن يكون 12 رقم/حرف hex");
  }
  return hex.match(/.{1,2}/g)!.join(":");
}

export function normalizeDevicePin(raw: string): string {
  const pin = westernizeDigits(raw).replace(/\D/g, "");
  if (pin.length !== 4) {
    throw new Error("رقم الجهاز يجب أن يكون 4 أرقام");
  }
  return pin;
}

function westernizeDigits(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

function deviceKey(mac: string, devicePin: string): string {
  return `${normalizeMac(mac)}:${normalizeDevicePin(devicePin)}`;
}

export async function registerIptvDevice(mac: string, devicePin: string): Promise<IptvDeviceRecord> {
  const normalizedMac = normalizeMac(mac);
  const normalizedPin = normalizeDevicePin(devicePin);
  const db = await loadDb();
  const key = deviceKey(normalizedMac, normalizedPin);
  const now = new Date().toISOString();

  const existing = db.devices.find((d) => deviceKey(d.mac, d.devicePin) === key);
  if (existing) {
    existing.lastSeenAt = now;
    await saveDb(db);
    return existing;
  }

  const sameMac = db.devices.filter((d) => {
    try {
      return normalizeMac(d.mac) === normalizedMac && d.status !== "disabled";
    } catch {
      return false;
    }
  });
  const activeSameMac = sameMac.find((d) => d.status === "active");
  if (activeSameMac) {
    activeSameMac.lastSeenAt = now;
    await saveDb(db);
    return activeSameMac;
  }
  const pendingSameMac = sameMac.find((d) => d.status === "pending");
  if (pendingSameMac) {
    pendingSameMac.lastSeenAt = now;
    await saveDb(db);
    return pendingSameMac;
  }

  const record: IptvDeviceRecord = {
    id: randomUUID(),
    mac: normalizedMac,
    devicePin: normalizedPin,
    status: "pending",
    createdAt: now,
    lastSeenAt: now,
  };
  db.devices.unshift(record);
  await saveDb(db);
  return record;
}

export async function findIptvDevice(mac: string, devicePin: string): Promise<IptvDeviceRecord | null> {
  const db = await loadDb();
  const key = deviceKey(mac, devicePin);
  return db.devices.find((d) => deviceKey(d.mac, d.devicePin) === key) ?? null;
}

export async function findActiveIptvDeviceByMac(mac: string): Promise<IptvDeviceRecord | null> {
  const db = await loadDb();
  const normalizedMac = normalizeMac(mac);
  return (
    db.devices.find((d) => {
      try {
        return normalizeMac(d.mac) === normalizedMac && d.status === "active";
      } catch {
        return false;
      }
    }) ?? null
  );
}

export async function resolveIptvDevice(mac: string, devicePin: string): Promise<IptvDeviceRecord | null> {
  const exact = await findIptvDevice(mac, devicePin);
  if (exact?.status === "active") return exact;
  const byMac = await findActiveIptvDeviceByMac(mac).catch(() => null);
  if (byMac) return byMac;
  return exact;
}

export function toPublicIptvDevice(record: IptvDeviceRecord): IptvDevicePublic {
  const { password: _password, cachedSessionId: _session, ...rest } = record;
  void _password;
  void _session;
  return {
    ...rest,
    expiresLabel: formatExpiryAr(record.expiresAt),
    daysLeft: daysLeftFromIso(record.expiresAt),
  };
}

export function toAdminIptvDevice(record: IptvDeviceRecord): IptvDeviceAdmin {
  const { cachedSessionId: _session, ...rest } = record;
  void _session;
  return {
    ...rest,
    password: record.password,
    expiresLabel: formatExpiryAr(record.expiresAt),
    daysLeft: daysLeftFromIso(record.expiresAt),
  };
}

function deviceSearchHaystack(device: IptvDeviceRecord): string {
  return [device.mac, device.devicePin, device.customerNote, device.customerPhone, device.username, device.host]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function deviceMatchesQuery(device: IptvDeviceRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (deviceSearchHaystack(device).includes(q)) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3 && (device.customerPhone ?? "").replace(/\D/g, "").includes(digits)) return true;
  return false;
}

export async function activateIptvDevice(input: {
  mac: string;
  devicePin: string;
  host: string;
  username: string;
  password: string;
  customerNote?: string;
  customerPhone: string;
  expiresAt?: string;
  activatedBy: string;
}): Promise<IptvDeviceRecord> {
  const host = input.host?.trim() ?? "";
  const username = input.username?.trim() ?? "";
  const password = input.password ?? "";
  const customerPhone = normalizeCustomerPhone(input.customerPhone);
  if (!host || !username || !password) {
    throw new Error("Host و Username و Password مطلوبة");
  }

  const normalizedMac = normalizeMac(input.mac);
  const normalizedPin = normalizeDevicePin(input.devicePin);
  const db = await loadDb();
  const key = deviceKey(normalizedMac, normalizedPin);
  const now = new Date().toISOString();

  let record = db.devices.find((d) => deviceKey(d.mac, d.devicePin) === key);
  if (!record) {
    record = {
      id: randomUUID(),
      mac: normalizedMac,
      devicePin: normalizedPin,
      status: "pending",
      createdAt: now,
    };
    db.devices.unshift(record);
  }

  record.status = "active";
  record.host = normalizeHost(input.host.trim());
  record.username = input.username.trim();
  record.password = input.password;
  record.customerNote = input.customerNote?.trim() || undefined;
  record.customerPhone = customerPhone;
  record.expiresAt = input.expiresAt;
  record.activatedAt = now;
  record.activatedBy = input.activatedBy;
  record.disabledReason = undefined;
  record.lastSeenAt = now;

  await saveDb(db);
  return record;
}

export async function disableIptvDevice(
  mac: string,
  devicePin: string,
  disabledBy: string,
  reason: "expired" | "admin" = "admin",
): Promise<IptvDeviceRecord> {
  const db = await loadDb();
  const key = deviceKey(mac, devicePin);
  const record = db.devices.find((d) => deviceKey(d.mac, d.devicePin) === key);
  if (!record) {
    throw new Error("الجهاز غير موجود");
  }

  record.status = "disabled";
  record.disabledReason = reason;
  record.cachedSessionId = undefined;
  record.cachedSessionAt = undefined;
  record.lastSeenAt = new Date().toISOString();
  record.activatedBy = disabledBy;
  await saveDb(db);
  return record;
}

export async function listIptvDevices(limit = 100, query = ""): Promise<IptvDeviceRecord[]> {
  const db = await loadDb();
  const filtered = query.trim() ? db.devices.filter((row) => deviceMatchesQuery(row, query)) : db.devices;
  return filtered.slice(0, limit);
}

export async function touchIptvDevice(mac: string, devicePin: string): Promise<void> {
  const db = await loadDb();
  const key = deviceKey(mac, devicePin);
  const record = db.devices.find((d) => deviceKey(d.mac, d.devicePin) === key);
  if (!record) return;
  record.lastSeenAt = new Date().toISOString();
  await saveDb(db);
}

export async function saveDeviceSession(mac: string, devicePin: string, sessionId: string): Promise<void> {
  const db = await loadDb();
  const key = deviceKey(mac, devicePin);
  const record = db.devices.find((d) => deviceKey(d.mac, d.devicePin) === key);
  if (!record) return;
  record.cachedSessionId = sessionId;
  record.cachedSessionAt = new Date().toISOString();
  await saveDb(db);
}

export async function getIptvDeviceRecord(mac: string, devicePin: string): Promise<IptvDeviceRecord | null> {
  return findIptvDevice(mac, devicePin);
}
