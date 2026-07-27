import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "veronix-db.json");

export type PlanId = "free" | "mini" | "standard" | "pro" | null; // standard kept for legacy users only

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  /** Empty for Google-only accounts */
  passwordHash: string;
  googleId?: string;
  avatarUrl?: string;
  credits: number;
  planId: PlanId;
  /** One free Veronix video (stock intro + 4s model) already used */
  freeVeronixUsed?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetRecord {
  id: string;
  userId: string;
  historyId?: string;
  mediaType: "image" | "video";
  url: string;
  prompt: string;
  mode: string;
  model: string;
  creditsUsed: number;
  status: "running" | "completed" | "failed";
  error?: string;
  /** Hidden intermediate multi-shot parts — final stitched clip stays visible */
  hidden?: boolean;
  createdAt: string;
}

export interface DbShape {
  users: UserRecord[];
  assets: AssetRecord[];
  /** Stripe checkout session ids already fulfilled (idempotency). */
  processedCheckoutSessions?: string[];
}

async function ensureDb(): Promise<DbShape> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as DbShape;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      processedCheckoutSessions: Array.isArray(parsed.processedCheckoutSessions)
        ? parsed.processedCheckoutSessions
        : [],
    };
  } catch {
    const empty: DbShape = { users: [], assets: [], processedCheckoutSessions: [] };
    await writeFile(DB_FILE, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
}

async function saveDb(db: DbShape): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  // Best-effort rotating snapshots — never block the write path on backup errors.
  void import("@/lib/db-backup")
    .then(({ backupCustomerDb }) => backupCustomerDb("save"))
    .catch(() => undefined);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const db = await ensureDb();
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const db = await ensureDb();
  return db.users.find((u) => u.id === id) ?? null;
}

export async function findUserByGoogleId(googleId: string): Promise<UserRecord | null> {
  const db = await ensureDb();
  return db.users.find((u) => u.googleId === googleId) ?? null;
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash?: string;
  googleId?: string;
  avatarUrl?: string;
}): Promise<UserRecord> {
  const db = await ensureDb();
  if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error("Email already registered");
  }
  const now = new Date().toISOString();
  const user: UserRecord = {
    id: randomUUID(),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim() || "Creator",
    passwordHash: input.passwordHash || "",
    googleId: input.googleId,
    avatarUrl: input.avatarUrl,
    credits: 0,
    planId: "free",
    freeVeronixUsed: false,
    createdAt: now,
    updatedAt: now,
  };
  db.users.push(user);
  await saveDb(db);
  return user;
}

export async function upsertGoogleUser(input: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}): Promise<UserRecord> {
  const byGoogle = await findUserByGoogleId(input.googleId);
  if (byGoogle) {
    return updateUser(byGoogle.id, {
      name: input.name || byGoogle.name,
      avatarUrl: input.avatarUrl || byGoogle.avatarUrl,
    });
  }

  const byEmail = await findUserByEmail(input.email);
  if (byEmail) {
    return updateUser(byEmail.id, {
      googleId: input.googleId,
      name: input.name || byEmail.name,
      avatarUrl: input.avatarUrl || byEmail.avatarUrl,
    });
  }

  return createUser({
    email: input.email,
    name: input.name,
    googleId: input.googleId,
    avatarUrl: input.avatarUrl,
    passwordHash: "",
  });
}

export async function updateUser(
  id: string,
  patch: Partial<Omit<UserRecord, "id" | "createdAt">>,
): Promise<UserRecord> {
  const db = await ensureDb();
  const idx = db.users.findIndex((u) => u.id === id);
  if (idx < 0) throw new Error("User not found");
  db.users[idx] = {
    ...db.users[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await saveDb(db);
  return db.users[idx];
}

export async function adjustCredits(userId: string, delta: number): Promise<UserRecord> {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  const next = Math.max(0, Math.floor(user.credits + delta));
  return updateUser(userId, { credits: next });
}

/** Ops-only: email/credits/plan for credit grants (no secrets). */
export async function listUsersForAdmin(): Promise<
  Array<{ email: string; credits: number; planId: PlanId; freeVeronixUsed: boolean }>
> {
  const db = await ensureDb();
  return db.users.map((u) => ({
    email: u.email,
    credits: u.credits,
    planId: u.planId,
    freeVeronixUsed: Boolean(u.freeVeronixUsed),
  }));
}

export async function createAsset(
  input: Omit<AssetRecord, "id" | "createdAt"> & { id?: string },
): Promise<AssetRecord> {
  const db = await ensureDb();
  const asset: AssetRecord = {
    id: input.id ?? randomUUID(),
    userId: input.userId,
    historyId: input.historyId,
    mediaType: input.mediaType,
    url: input.url,
    prompt: input.prompt,
    mode: input.mode,
    model: input.model,
    creditsUsed: input.creditsUsed,
    status: input.status,
    error: input.error,
    hidden: Boolean(input.hidden),
    createdAt: new Date().toISOString(),
  };
  db.assets.unshift(asset);
  await saveDb(db);
  return asset;
}

export async function updateAsset(
  id: string,
  userId: string,
  patch: Partial<Omit<AssetRecord, "id" | "userId" | "createdAt">>,
): Promise<AssetRecord | null> {
  const db = await ensureDb();
  const idx = db.assets.findIndex((a) => a.id === id && a.userId === userId);
  if (idx < 0) return null;
  db.assets[idx] = { ...db.assets[idx], ...patch };
  await saveDb(db);
  return db.assets[idx];
}

export async function findAssetByHistoryId(
  userId: string,
  historyId: string,
): Promise<AssetRecord | null> {
  const db = await ensureDb();
  return (
    db.assets.find((a) => a.userId === userId && a.historyId === historyId) ||
    null
  );
}

/** Ops: recent assets for a user (debug / repair). */
export async function listAssetsForAdmin(
  userId: string,
  limit = 40,
): Promise<AssetRecord[]> {
  const db = await ensureDb();
  return db.assets.filter((a) => a.userId === userId).slice(0, limit);
}

export async function listAssetsForUser(
  userId: string,
  opts?: { includeHidden?: boolean },
): Promise<AssetRecord[]> {
  const db = await ensureDb();
  return db.assets.filter(
    (a) =>
      a.userId === userId &&
      (opts?.includeHidden ? true : a.hidden !== true),
  );
}

/** Show or hide many assets at once (multi-shot parts). */
export async function setAssetsHidden(
  userId: string,
  assetIds: string[],
  hidden: boolean,
): Promise<number> {
  if (!assetIds.length) return 0;
  const db = await ensureDb();
  const want = new Set(assetIds);
  let n = 0;
  for (let i = 0; i < db.assets.length; i += 1) {
    const a = db.assets[i]!;
    if (a.userId !== userId || !want.has(a.id)) continue;
    db.assets[i] = { ...a, hidden };
    n += 1;
  }
  if (n) await saveDb(db);
  return n;
}

/** Wait before unhiding parts — long enough for stitch, short enough to recover. */
const ORPHAN_RECOVERY_GRACE_MS = 12 * 60 * 1000;

/**
 * Unhide multi-shot parts that never got a stitched final video.
 * Keeps parts hidden when a sequence-concat exists shortly after, and while
 * generation/stitch may still be in flight (grace window).
 */
export async function recoverOrphanedHiddenAssets(
  userId: string,
): Promise<number> {
  const db = await ensureDb();
  const now = Date.now();
  const mine = db.assets.filter((a) => a.userId === userId);
  const concats = mine.filter(
    (a) =>
      a.hidden !== true &&
      a.mode === "sequence-concat" &&
      a.status === "completed" &&
      Boolean(a.url),
  );
  let n = 0;
  for (let i = 0; i < db.assets.length; i += 1) {
    const a = db.assets[i]!;
    if (a.userId !== userId || a.hidden !== true) continue;
    if (a.mediaType !== "video" || a.status !== "completed" || !a.url) continue;
    const partAt = new Date(a.createdAt).getTime();
    // Do not surface in-progress sequence beats — that left users with 3 clips
    // before the merge finished (or while Assets refreshed mid-job).
    if (now - partAt < ORPHAN_RECOVERY_GRACE_MS) continue;
    const covered = concats.some((c) => {
      const dt = new Date(c.createdAt).getTime() - partAt;
      // Concat is created after parts; allow up to 2h window.
      return dt >= -5_000 && dt < 2 * 60 * 60 * 1000;
    });
    if (!covered) {
      db.assets[i] = { ...a, hidden: false };
      n += 1;
    }
  }
  if (n) await saveDb(db);
  return n;
}

export function publicUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    credits: user.credits,
    planId: user.planId,
    freeVeronixUsed: Boolean(user.freeVeronixUsed),
    createdAt: user.createdAt,
  };
}

export async function hasProcessedCheckoutSession(sessionId: string): Promise<boolean> {
  const db = await ensureDb();
  return (db.processedCheckoutSessions || []).includes(sessionId);
}

/** Returns true if this process claimed the session (first writer wins). */
export async function claimCheckoutSession(sessionId: string): Promise<boolean> {
  const db = await ensureDb();
  const list = db.processedCheckoutSessions || [];
  if (list.includes(sessionId)) return false;
  list.push(sessionId);
  // Keep the list bounded
  db.processedCheckoutSessions = list.slice(-500);
  await saveDb(db);
  return true;
}
