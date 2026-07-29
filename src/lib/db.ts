import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
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
  /** Owner admin can lock accounts from generating / logging in */
  locked?: boolean;
  lockedReason?: string;
  lockedAt?: string;
  /** Internal note visible only in admin panel */
  adminNote?: string;
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
  /**
   * Customer deleted this asset from Assets.
   * Must NEVER be cleared by orphan/recovery helpers (unlike `hidden`).
   */
  deletedAt?: string;
  /** Chosen output length (seconds) — drives generate ETA countdown in UI */
  targetSeconds?: number;
  /** Aspect ratio used for this generation (e.g. 16:9, 9:16). */
  aspectRatio?: string;
  /** Resolution tier (480p / 720p for video). */
  resolution?: string;
  /** Server-side multi-shot job plan / progress */
  jobMeta?: import("@/lib/multi-shot-job").MultiShotJobMeta;
  /**
   * Character / reference stills used for this generation.
   * Restored by Assets → Edit so the customer can tweak without re-uploading.
   */
  referenceImages?: import("@/lib/types").VisualReference[];
  /**
   * Original image→video Start Frame (first frame). Prefer this on Edit —
   * never re-capture a still from the finished video when this exists.
   */
  startFrame?: import("@/lib/types").VisualReference | null;
  /** Customer opted into OmarFX clarity grade for this video. */
  preferClarity?: boolean;
  /** Whether the generation requested native audio. */
  generateAudio?: boolean;
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
    // Corrupt / missing — try richest backup before writing empty.
    try {
      const { listDbBackups, mergeDbFromBackup } = await import("@/lib/db-backup");
      const backups = await listDbBackups();
      const best = backups.find((b) => b.users > 0 || b.assets > 0);
      if (best) {
        await mergeDbFromBackup({ backupName: best.name, fullReplace: true });
        const raw = await readFile(DB_FILE, "utf8");
        const parsed = JSON.parse(raw) as DbShape;
        return {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          assets: Array.isArray(parsed.assets) ? parsed.assets : [],
          processedCheckoutSessions: Array.isArray(parsed.processedCheckoutSessions)
            ? parsed.processedCheckoutSessions
            : [],
        };
      }
    } catch {
      // fall through to empty
    }
    const empty: DbShape = { users: [], assets: [], processedCheckoutSessions: [] };
    await atomicWriteDb(empty);
    return empty;
  }
}

async function atomicWriteDb(db: DbShape): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = path.join(DATA_DIR, `veronix-db.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await rename(tmp, DB_FILE);
}

async function saveDb(db: DbShape): Promise<void> {
  await atomicWriteDb(db);
  // Best-effort rotating snapshots — never block the write path on backup errors.
  void import("@/lib/db-backup")
    .then(({ backupCustomerDb }) => backupCustomerDb("save"))
    .catch(() => undefined);
}

/** Serialize read-modify-write so concurrent generates cannot wipe assets/credits. */
let dbWriteChain: Promise<unknown> = Promise.resolve();

function withDbLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = dbWriteChain.then(fn, fn);
  dbWriteChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
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
  return withDbLock(async () => {
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
  });
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
  return withDbLock(async () => {
    const db = await ensureDb();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx < 0) throw new Error("User not found");
    db.users[idx] = {
      ...db.users[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await saveDb(db);
    return db.users[idx]!;
  });
}

export async function adjustCredits(userId: string, delta: number): Promise<UserRecord> {
  return withDbLock(async () => {
    const db = await ensureDb();
    const idx = db.users.findIndex((u) => u.id === userId);
    if (idx < 0) throw new Error("User not found");
    const user = db.users[idx]!;
    const next = Math.max(0, Math.floor(user.credits + delta));
    db.users[idx] = {
      ...user,
      credits: next,
      updatedAt: new Date().toISOString(),
    };
    await saveDb(db);
    return db.users[idx]!;
  });
}

/** Ops-only: safe user rows for the owner admin panel. */
export async function listUsersForAdmin(): Promise<
  Array<{
    id: string;
    email: string;
    name: string;
    credits: number;
    planId: PlanId;
    freeVeronixUsed: boolean;
    locked: boolean;
    lockedReason?: string;
    lockedAt?: string;
    adminNote?: string;
    createdAt: string;
    updatedAt: string;
    hasStripe: boolean;
    assetCount: number;
    videoCount: number;
    imageCount: number;
    runningCount: number;
  }>
> {
  const db = await ensureDb();
  return db.users
    .map((u) => {
      const assets = db.assets.filter((a) => a.userId === u.id && !a.deletedAt);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        credits: u.credits,
        planId: u.planId,
        freeVeronixUsed: Boolean(u.freeVeronixUsed),
        locked: Boolean(u.locked),
        lockedReason: u.lockedReason,
        lockedAt: u.lockedAt,
        adminNote: u.adminNote,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        hasStripe: Boolean(u.stripeCustomerId || u.stripeSubscriptionId),
        assetCount: assets.length,
        videoCount: assets.filter((a) => a.mediaType === "video").length,
        imageCount: assets.filter((a) => a.mediaType === "image").length,
        runningCount: assets.filter((a) => a.status === "running").length,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getAdminStats(): Promise<{
  users: number;
  paidUsers: number;
  lockedUsers: number;
  totalCredits: number;
  assets: number;
  videos: number;
  images: number;
  running: number;
}> {
  const db = await ensureDb();
  const assets = db.assets.filter((a) => !a.deletedAt);
  return {
    users: db.users.length,
    paidUsers: db.users.filter((u) => u.planId === "mini" || u.planId === "pro").length,
    lockedUsers: db.users.filter((u) => u.locked).length,
    totalCredits: db.users.reduce((s, u) => s + (u.credits || 0), 0),
    assets: assets.length,
    videos: assets.filter((a) => a.mediaType === "video").length,
    images: assets.filter((a) => a.mediaType === "image").length,
    running: assets.filter((a) => a.status === "running").length,
  };
}

export async function listAssetsForUserAdmin(
  userId: string,
  limit = 20,
): Promise<
  Array<{
    id: string;
    mediaType: string;
    status: string;
    prompt: string;
    creditsUsed: number;
    createdAt: string;
    error?: string;
    model: string;
  }>
> {
  const db = await ensureDb();
  return db.assets
    .filter((a) => a.userId === userId && !a.deletedAt)
    .slice(0, Math.max(1, Math.min(50, limit)))
    .map((a) => ({
      id: a.id,
      mediaType: a.mediaType,
      status: a.status,
      prompt: (a.prompt || "").slice(0, 160),
      creditsUsed: a.creditsUsed,
      createdAt: a.createdAt,
      error: a.error,
      model: a.model,
    }));
}

export async function createAsset(
  input: Omit<AssetRecord, "id" | "createdAt"> & { id?: string },
): Promise<AssetRecord> {
  return withDbLock(async () => {
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
      targetSeconds:
        typeof input.targetSeconds === "number" && input.targetSeconds > 0
          ? Math.round(input.targetSeconds)
          : undefined,
      aspectRatio: input.aspectRatio?.trim() || undefined,
      resolution: input.resolution?.trim() || undefined,
      jobMeta: input.jobMeta,
      referenceImages: Array.isArray(input.referenceImages)
        ? input.referenceImages.slice(0, 4)
        : undefined,
      startFrame: input.startFrame?.url
        ? {
            type: "image" as const,
            id: input.startFrame.id || `start-${randomUUID().slice(0, 8)}`,
            url: input.startFrame.url,
            label: input.startFrame.label || "start-frame",
          }
        : undefined,
      preferClarity: Boolean(input.preferClarity),
      generateAudio:
        typeof input.generateAudio === "boolean"
          ? input.generateAudio
          : undefined,
      createdAt: new Date().toISOString(),
    };
    db.assets.unshift(asset);
    await saveDb(db);
    return asset;
  });
}

export async function updateAsset(
  id: string,
  userId: string,
  patch: Partial<Omit<AssetRecord, "id" | "userId" | "createdAt">>,
): Promise<AssetRecord | null> {
  return withDbLock(async () => {
    const db = await ensureDb();
    const idx = db.assets.findIndex((a) => a.id === id && a.userId === userId);
    if (idx < 0) return null;
    const prev = db.assets[idx]!;
    const next = { ...prev, ...patch };
    // Customer delete is sticky — never un-delete via sync/repair patches.
    if (prev.deletedAt) {
      next.deletedAt = prev.deletedAt;
      next.hidden = true;
    }
    // Promote finished multi-shot finals to the top so Assets shows them immediately.
    const becameVisibleFinal =
      next.status === "completed" &&
      next.hidden !== true &&
      !next.deletedAt &&
      (next.mode === "sequence-concat" || Boolean(next.url));
    if (becameVisibleFinal && idx > 0) {
      db.assets.splice(idx, 1);
      db.assets.unshift(next);
    } else {
      db.assets[idx] = next;
    }
    await saveDb(db);
    return next;
  });
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

/** Full lookup — never miss a multi-shot pending buried under newer parts. */
export async function findAssetById(
  userId: string,
  assetId: string,
): Promise<AssetRecord | null> {
  const db = await ensureDb();
  return (
    db.assets.find((a) => a.userId === userId && a.id === assetId) || null
  );
}

/** All running multi-shot job cards for a user (no limit). */
export async function listRunningMultiShotJobs(
  userId: string,
): Promise<AssetRecord[]> {
  const db = await ensureDb();
  return db.assets.filter(
    (a) =>
      a.userId === userId &&
      a.mode === "sequence-pending" &&
      a.status === "running",
  );
}

export async function listAssetsForUser(
  userId: string,
  opts?: { includeHidden?: boolean; includeDeleted?: boolean },
): Promise<AssetRecord[]> {
  const db = await ensureDb();
  return db.assets.filter((a) => {
    if (a.userId !== userId) return false;
    // Customer-deleted assets stay gone unless an admin explicitly asks.
    if (!opts?.includeDeleted && a.deletedAt) return false;
    // Intermediate multi-shot beats never appear in the Assets UI.
    if (!opts?.includeHidden && a.mode === "sequence-part") return false;
    if (opts?.includeHidden) return true;
    return a.hidden !== true;
  });
}

/** Soft-delete an asset permanently for the owning user (survives login/recovery). */
export async function deleteAssetForUser(
  userId: string,
  assetId: string,
): Promise<boolean> {
  return withDbLock(async () => {
    const db = await ensureDb();
    const i = db.assets.findIndex((a) => a.id === assetId && a.userId === userId);
    if (i < 0) return false;
    db.assets[i] = {
      ...db.assets[i]!,
      hidden: true,
      deletedAt: new Date().toISOString(),
    };
    await saveDb(db);
    return true;
  });
}

/** Show or hide many assets at once (multi-shot parts). */
export async function setAssetsHidden(
  userId: string,
  assetIds: string[],
  hidden: boolean,
): Promise<number> {
  if (!assetIds.length) return 0;
  return withDbLock(async () => {
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
  });
}

/** Wait before unhiding parts — long enough for full 32s multi-shot + stitch. */
const ORPHAN_RECOVERY_GRACE_MS = 20 * 60 * 1000;

/**
 * Promote or fail stuck multi-shot job cards (sequence-pending) that never
 * received a final stitch — e.g. browser closed mid-generate / proxy timeout.
 * Never promote a single 4s part as a "32s" success — only mark partial with
 * honest targetSeconds after the full ETA window, or leave running while
 * parts / server jobMeta are still in flight.
 */
export async function recoverStuckSequencePending(
  userId: string,
): Promise<number> {
  return withDbLock(async () => {
  const db = await ensureDb();
  const now = Date.now();
  let n = 0;

  for (let i = 0; i < db.assets.length; i += 1) {
    const pending = db.assets[i]!;
    if (pending.userId !== userId) continue;
    if (pending.mode !== "sequence-pending") continue;
    if (pending.status !== "running") continue;
    if (pending.url) continue;

    const age = now - new Date(pending.createdAt).getTime();
    if (!Number.isFinite(age)) continue;

    const { estimateGenerateSeconds } = await import("@/lib/generate-eta");
    const etaMs = estimateGenerateSeconds(pending.targetSeconds || 4) * 1000;
    // Stay hands-off until well past the countdown (ETA + 3m).
    const STALE_PROMOTE_MS = etaMs + 3 * 60_000;
    const STALE_FAIL_MS = Math.max(STALE_PROMOTE_MS + 5 * 60_000, 30 * 60_000);
    if (age < STALE_PROMOTE_MS) continue;

    const pendingAt = new Date(pending.createdAt).getTime();
    const parts = db.assets.filter((a) => {
      if (a.userId !== userId || a.mode !== "sequence-part") return false;
      const t = new Date(a.createdAt).getTime();
      return t >= pendingAt - 5_000 && t < pendingAt + 3 * 60 * 60 * 1000;
    });
    const completedParts = parts
      .filter((a) => a.status === "completed" && a.url)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    const runningParts = parts.filter((a) => a.status === "running");
    const expected = Math.max(
      1,
      Math.round((pending.targetSeconds || 4) / 4),
    );

    // Multiple completed beats — Assets route will stitch; here only flag for stitch.
    if (completedParts.length >= 2 && runningParts.length === 0) {
      db.assets[i] = {
        ...pending,
        error: `[stitch-ready] ${completedParts.length} parts ready`,
      };
      n += 1;
      continue;
    }

    if (
      completedParts.length === 1 &&
      runningParts.length === 0 &&
      age >= STALE_FAIL_MS
    ) {
      // Honest partial: one beat only, not the full requested length.
      const best = completedParts[0]!;
      db.assets[i] = {
        ...pending,
        url: best.url,
        historyId: best.historyId || pending.historyId,
        status: "completed",
        mode: "sequence-concat",
        targetSeconds: 4,
        error:
          expected > 1
            ? `اكتملت لقطة واحدة فقط من ${expected} — أعد التوليد للمدة الكاملة`
            : undefined,
        hidden: false,
      };
      for (let j = 0; j < db.assets.length; j += 1) {
        const p = db.assets[j]!;
        if (
          p.userId === userId &&
          p.mode === "sequence-part" &&
          parts.some((x) => x.id === p.id)
        ) {
          db.assets[j] = { ...p, hidden: true };
        }
      }
      n += 1;
      continue;
    }

    if (age >= STALE_FAIL_MS && runningParts.length === 0 && completedParts.length === 0) {
      const partErr = parts.find((a) => a.status === "failed" && a.error)?.error;
      db.assets[i] = {
        ...pending,
        status: "failed",
        error:
          partErr ||
          "انتهت مهلة التوليد قبل اكتمال الدمج — أعد المحاولة من الاستوديو",
        hidden: false,
      };
      n += 1;
    }
  }

  if (n) await saveDb(db);
  return n;
  });
}

/**
 * Unhide multi-shot parts that never got a stitched final video.
 * Keeps parts hidden when a sequence-concat exists shortly after, and while
 * generation/stitch may still be in flight (grace window).
 * Never resurrects assets the customer deleted from Assets.
 */
export async function recoverOrphanedHiddenAssets(
  userId: string,
): Promise<number> {
  return withDbLock(async () => {
  const db = await ensureDb();
  const now = Date.now();
  const mine = db.assets.filter((a) => a.userId === userId && !a.deletedAt);
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
    // Customer delete is permanent — do not unhide on login / Assets refresh.
    if (a.deletedAt) continue;
    if (a.mediaType !== "video" || a.status !== "completed" || !a.url) continue;
    // Never surface intermediate beats in Assets — only the stitched final.
    if (a.mode === "sequence-part") continue;
    const partAt = new Date(a.createdAt).getTime();
    // Do not surface in-progress jobs while stitch may still be running.
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
  });
}

export function publicUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    credits: user.credits,
    planId: user.planId,
    freeVeronixUsed: Boolean(user.freeVeronixUsed),
    locked: Boolean(user.locked),
    createdAt: user.createdAt,
  };
}

export async function hasProcessedCheckoutSession(sessionId: string): Promise<boolean> {
  const db = await ensureDb();
  return (db.processedCheckoutSessions || []).includes(sessionId);
}

/** Returns true if this process claimed the session (first writer wins). */
export async function claimCheckoutSession(sessionId: string): Promise<boolean> {
  return withDbLock(async () => {
    const db = await ensureDb();
    const list = db.processedCheckoutSessions || [];
    if (list.includes(sessionId)) return false;
    list.push(sessionId);
    // Keep the list bounded
    db.processedCheckoutSessions = list.slice(-500);
    await saveDb(db);
    return true;
  });
}
