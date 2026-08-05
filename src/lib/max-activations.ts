import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type MaxActivationRecord = {
  deviceId: string;
  mac?: string;
  label?: string;
  activated: boolean;
  registeredAt: string;
  activatedAt?: string;
  version?: string;
};

type Store = {
  devices: Record<string, MaxActivationRecord>;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "max-activations.json");

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Store;
    if (parsed?.devices && typeof parsed.devices === "object") return parsed;
  } catch {
    /* first run */
  }
  return { devices: {} };
}

async function writeStore(store: Store): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export function normalizeDeviceId(deviceId: string): string {
  return deviceId.replace(/\D/g, "").slice(0, 14);
}

export async function listActivations(): Promise<MaxActivationRecord[]> {
  const store = await readStore();
  return Object.values(store.devices).sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime(),
  );
}

export async function getActivation(deviceId: string): Promise<MaxActivationRecord | null> {
  const id = normalizeDeviceId(deviceId);
  if (!id) return null;
  const store = await readStore();
  return store.devices[id] ?? null;
}

export async function registerDevice(input: {
  deviceId: string;
  mac?: string;
  version?: string;
}): Promise<MaxActivationRecord> {
  const id = normalizeDeviceId(input.deviceId);
  if (!id) throw new Error("Invalid device ID");

  const store = await readStore();
  const existing = store.devices[id];
  if (existing) {
    existing.mac = input.mac ?? existing.mac;
    existing.version = input.version ?? existing.version;
    await writeStore(store);
    return existing;
  }

  const record: MaxActivationRecord = {
    deviceId: id,
    mac: input.mac,
    version: input.version,
    activated: false,
    registeredAt: new Date().toISOString(),
  };
  store.devices[id] = record;
  await writeStore(store);
  return record;
}

export async function activateDevice(input: {
  deviceId: string;
  label?: string;
}): Promise<MaxActivationRecord> {
  const id = normalizeDeviceId(input.deviceId);
  if (!id) throw new Error("Invalid device ID");

  const store = await readStore();
  const existing = store.devices[id] ?? {
    deviceId: id,
    activated: false,
    registeredAt: new Date().toISOString(),
  };

  existing.activated = true;
  existing.activatedAt = new Date().toISOString();
  if (input.label?.trim()) existing.label = input.label.trim();

  store.devices[id] = existing;
  await writeStore(store);
  return existing;
}

export async function deactivateDevice(deviceId: string): Promise<MaxActivationRecord | null> {
  const id = normalizeDeviceId(deviceId);
  if (!id) return null;

  const store = await readStore();
  const existing = store.devices[id];
  if (!existing) return null;

  existing.activated = false;
  delete existing.activatedAt;
  await writeStore(store);
  return existing;
}

export function isMaxAdminAuthorized(request: Request): boolean {
  const required = process.env.MAX_ADMIN_KEY?.trim();
  if (!required) return true;
  const url = new URL(request.url);
  const key =
    url.searchParams.get("key") ||
    request.headers.get("x-max-admin-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return key === required;
}
