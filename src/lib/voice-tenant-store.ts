import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { searchCommercialRegistry } from "@/lib/commercial-registry-search";
import { slugFromRegistryName } from "@/lib/tenant-slug";
import type { VoiceTenantRecord, VoiceTenantStatus } from "@/lib/voice-tenant-types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "voice-tenants.json");

type StoreShape = { tenants: VoiceTenantRecord[] };

let writeChain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readStore(): Promise<StoreShape> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    return { tenants: Array.isArray(parsed.tenants) ? parsed.tenants : [] };
  } catch {
    return { tenants: [] };
  }
}

async function writeStore(store: StoreShape): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = path.join(DATA_DIR, `voice-tenants.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await rename(tmp, STORE_FILE);
}

function uniqueSlug(base: string, tenants: VoiceTenantRecord[], excludeId?: string): string {
  let slug = base;
  let n = 2;
  while (
    tenants.some((t) => t.slug === slug && t.id !== excludeId)
  ) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export async function listVoiceTenants(): Promise<VoiceTenantRecord[]> {
  const store = await readStore();
  return store.tenants.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function findVoiceTenantBySlug(slug: string): Promise<VoiceTenantRecord | null> {
  const key = slug.trim().toLowerCase();
  const store = await readStore();
  return store.tenants.find((t) => t.slug === key) ?? null;
}

export async function findVoiceTenantById(id: string): Promise<VoiceTenantRecord | null> {
  const store = await readStore();
  return store.tenants.find((t) => t.id === id) ?? null;
}

export async function findVoiceTenantByCr(crNumber: string): Promise<VoiceTenantRecord | null> {
  const digits = crNumber.replace(/\D/g, "");
  const store = await readStore();
  return (
    store.tenants.find((t) => t.commercialRegistrationNumber === digits) ?? null
  );
}

export async function createVoiceTenantRequest(crNumber: string): Promise<VoiceTenantRecord> {
  return withLock(async () => {
    const hit = searchCommercialRegistry(crNumber);
    if (!hit) throw new Error("رقم السجل غير صالح");

    const store = await readStore();
    const existing = store.tenants.find(
      (t) => t.commercialRegistrationNumber === hit.commercialRegistrationNumber,
    );
    if (existing) return existing;

    const now = new Date().toISOString();
    const slug = uniqueSlug(hit.suggestedSlug, store.tenants);
    const id = randomUUID();
    const record: VoiceTenantRecord = {
      id,
      commercialRegistrationNumber: hit.commercialRegistrationNumber,
      registryNameAr: hit.registryNameAr,
      registryNameEn: hit.registryNameEn,
      activityCode: hit.activityCode,
      activityLabel: hit.activityLabel,
      slug,
      status: "pending_approval",
      s3Prefix: `tenants/${slug}/`,
      uploads: [],
      createdAt: now,
      updatedAt: now,
    };
    store.tenants.push(record);
    await writeStore(store);
    return record;
  });
}

async function patchTenant(
  id: string,
  patch: Partial<VoiceTenantRecord>,
): Promise<VoiceTenantRecord> {
  return withLock(async () => {
    const store = await readStore();
    const idx = store.tenants.findIndex((t) => t.id === id);
    if (idx < 0) throw new Error("Tenant not found");
    const now = new Date().toISOString();
    const next = { ...store.tenants[idx], ...patch, updatedAt: now };
    store.tenants[idx] = next;
    await writeStore(store);
    return next;
  });
}

export async function approveVoiceTenant(id: string): Promise<VoiceTenantRecord> {
  const now = new Date().toISOString();
  return patchTenant(id, {
    status: "awaiting_payment",
    approvedAt: now,
    rejectedReason: undefined,
  });
}

export async function rejectVoiceTenant(id: string, reason: string): Promise<VoiceTenantRecord> {
  return patchTenant(id, {
    status: "rejected",
    rejectedReason: reason.trim() || "مرفوض من الإدارة",
  });
}

export async function activateVoiceTenantAfterPayment(id: string): Promise<VoiceTenantRecord> {
  const now = new Date().toISOString();
  const token = randomBytes(24).toString("base64url");
  return patchTenant(id, {
    status: "active",
    paidAt: now,
    activatedAt: now,
    portalAccessToken: token,
  });
}

export async function updateVoiceTenantSettings(
  id: string,
  input: { phone?: string; assistantId?: string },
): Promise<VoiceTenantRecord> {
  const phone = input.phone?.trim();
  const assistantId = input.assistantId?.trim();
  return patchTenant(id, {
    ...(phone !== undefined ? { phone } : {}),
    ...(assistantId !== undefined ? { assistantId } : {}),
  });
}

export async function appendVoiceTenantUpload(
  id: string,
  upload: VoiceTenantRecord["uploads"][number],
): Promise<VoiceTenantRecord> {
  return withLock(async () => {
    const store = await readStore();
    const idx = store.tenants.findIndex((t) => t.id === id);
    if (idx < 0) throw new Error("Tenant not found");
    const tenant = store.tenants[idx];
    const uploads = [...tenant.uploads, upload];
    const now = new Date().toISOString();
    const next = { ...tenant, uploads, updatedAt: now };
    store.tenants[idx] = next;
    await writeStore(store);
    return next;
  });
}

export function regenerateSlugFromName(tenant: VoiceTenantRecord): string {
  const base = slugFromRegistryName(
    tenant.registryNameEn.trim() || tenant.registryNameAr.trim(),
  );
  return base;
}

export async function setVoiceTenantSlug(id: string, slug: string): Promise<VoiceTenantRecord> {
  const normalized = slugFromRegistryName(slug);
  return withLock(async () => {
    const store = await readStore();
    const unique = uniqueSlug(normalized, store.tenants, id);
    const idx = store.tenants.findIndex((t) => t.id === id);
    if (idx < 0) throw new Error("Tenant not found");
    const tenant = store.tenants[idx];
    const now = new Date().toISOString();
    const next: VoiceTenantRecord = {
      ...tenant,
      slug: unique,
      s3Prefix: `tenants/${unique}/`,
      updatedAt: now,
    };
    store.tenants[idx] = next;
    await writeStore(store);
    return next;
  });
}

export function isVoiceTenantStatus(s: string): s is VoiceTenantStatus {
  return (
    s === "pending_approval" ||
    s === "approved" ||
    s === "awaiting_payment" ||
    s === "active" ||
    s === "rejected"
  );
}
