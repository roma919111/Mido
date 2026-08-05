import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type IptvCodeRecord = {
  code: string;
  label?: string;
  m3uUrl: string;
  active: boolean;
  createdAt: string;
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
  m3uUrl: string;
  active?: boolean;
}): Promise<IptvCodeRecord> {
  const id = input.code ? normalizeCode(input.code) : generateCode();
  if (id.length < 4) throw new Error("Code must be at least 4 digits");

  const store = await readStore();
  const existing = store.codes[id];
  const record: IptvCodeRecord = {
    code: id,
    label: input.label?.trim() || existing?.label,
    m3uUrl: input.m3uUrl.trim(),
    active: input.active ?? true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  store.codes[id] = record;
  await writeStore(store);
  return record;
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

export { isMaxAdminAuthorized } from "./max-activations";
