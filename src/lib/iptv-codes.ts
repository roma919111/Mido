import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type IptvCodeRecord = {
  code: string;
  label?: string;
  phone?: string;
  notes?: string;
  m3uUrl: string;
  active: boolean;
  createdAt: string;
  /** ISO date — null/undefined = unlimited subscription */
  expiresAt?: string | null;
  planDays?: number;
};

type Store = {
  codes: Record<string, IptvCodeRecord>;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "max-iptv-codes.json");

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Store;
    if (parsed?.codes && typeof parsed.codes === "object") return parsed;
  } catch {
    /* first run */
  }
  return { codes: {} };
}

async function writeStore(store: Store): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export function normalizeCode(code: string): string {
  return code.replace(/\D/g, "").slice(0, 6);
}

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function isCodeExpired(record: IptvCodeRecord, now = new Date()): boolean {
  if (!record.expiresAt) return false;
  return new Date(record.expiresAt).getTime() < now.getTime();
}

export function isCodeValid(record: IptvCodeRecord, now = new Date()): boolean {
  return record.active && !isCodeExpired(record, now);
}

export function daysUntilExpiry(record: IptvCodeRecord, now = new Date()): number | null {
  if (!record.expiresAt) return null;
  const ms = new Date(record.expiresAt).getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function expiryFromPlanDays(planDays?: number | null): string | null | undefined {
  if (planDays === undefined) return undefined;
  if (planDays === null || planDays <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + planDays);
  return d.toISOString();
}

export async function listIptvCodes(): Promise<IptvCodeRecord[]> {
  const store = await readStore();
  return Object.values(store.codes).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getIptvCode(code: string): Promise<IptvCodeRecord | null> {
  const id = normalizeCode(code);
  if (id.length < 4) return null;
  const store = await readStore();
  return store.codes[id] ?? null;
}

export async function upsertIptvCode(input: {
  code?: string;
  label?: string;
  phone?: string;
  notes?: string;
  m3uUrl: string;
  active?: boolean;
  planDays?: number | null;
  expiresAt?: string | null;
}): Promise<IptvCodeRecord> {
  const id = input.code ? normalizeCode(input.code) : generateCode();
  if (id.length < 4) throw new Error("Code must be at least 4 digits");

  const store = await readStore();
  const existing = store.codes[id];

  let expiresAt = input.expiresAt;
  if (input.planDays !== undefined) {
    expiresAt = expiryFromPlanDays(input.planDays);
  } else if (expiresAt === undefined) {
    expiresAt = existing?.expiresAt ?? null;
  }

  const record: IptvCodeRecord = {
    code: id,
    label: input.label?.trim() || existing?.label,
    phone: input.phone?.trim() || existing?.phone,
    notes: input.notes?.trim() || existing?.notes,
    m3uUrl: input.m3uUrl.trim(),
    active: input.active ?? true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    expiresAt: expiresAt ?? null,
    planDays:
      input.planDays !== undefined
        ? input.planDays ?? undefined
        : existing?.planDays,
  };
  store.codes[id] = record;
  await writeStore(store);
  return record;
}

export async function renewIptvCode(code: string, days: number): Promise<IptvCodeRecord | null> {
  const id = normalizeCode(code);
  const store = await readStore();
  const existing = store.codes[id];
  if (!existing || days <= 0) return null;

  const base = existing.expiresAt && !isCodeExpired(existing)
    ? new Date(existing.expiresAt)
    : new Date();
  base.setDate(base.getDate() + days);

  existing.expiresAt = base.toISOString();
  existing.active = true;
  existing.planDays = days;
  await writeStore(store);
  return existing;
}

export async function updateIptvCodeMeta(
  code: string,
  patch: { label?: string; phone?: string; notes?: string },
): Promise<IptvCodeRecord | null> {
  const id = normalizeCode(code);
  const store = await readStore();
  const existing = store.codes[id];
  if (!existing) return null;
  if (patch.label !== undefined) existing.label = patch.label.trim() || undefined;
  if (patch.phone !== undefined) existing.phone = patch.phone.trim() || undefined;
  if (patch.notes !== undefined) existing.notes = patch.notes.trim() || undefined;
  await writeStore(store);
  return existing;
}

export async function setIptvCodeActive(code: string, active: boolean): Promise<IptvCodeRecord | null> {
  const id = normalizeCode(code);
  const store = await readStore();
  const existing = store.codes[id];
  if (!existing) return null;
  existing.active = active;
  await writeStore(store);
  return existing;
}

/** Dev/demo: auto-create code 123456 so browser testing works out of the box. */
export async function ensureDemoCode(origin: string): Promise<void> {
  if (process.env.MAX_IPTV_DEMO === "0") return;

  const store = await readStore();
  if (store.codes["123456"]) return;

  const base = origin.replace(/\/$/, "");
  await upsertIptvCode({
    code: "123456",
    label: "تجربة — Demo",
    m3uUrl: `${base}/api/max/iptv/demo.m3u`,
    active: true,
    planDays: null,
  });
}

export { isMaxAdminAuthorized } from "./max-activations";
