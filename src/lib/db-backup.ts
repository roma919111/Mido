import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "veronix-db.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MAX_BACKUPS = 48;
/** Minimum gap between automatic save-triggered backups. */
const MIN_INTERVAL_MS = 5 * 60 * 1000;

let lastBackupAt = 0;

export type DbSnapshot = {
  users: unknown[];
  assets: unknown[];
  processedCheckoutSessions?: unknown[];
};

/**
 * Rotate JSON DB snapshots under `.data/backups/`.
 * Keeps the newest MAX_BACKUPS files so customer wallets survive bad writes / deploys.
 */
export async function backupCustomerDb(
  reason = "manual",
  opts?: { force?: boolean },
): Promise<{
  ok: boolean;
  file?: string;
  skipped?: string;
}> {
  const force = Boolean(opts?.force) || reason === "startup" || reason === "manual";
  const now = Date.now();
  if (!force && now - lastBackupAt < MIN_INTERVAL_MS) {
    return { ok: false, skipped: "throttled" };
  }

  try {
    await stat(DB_FILE);
  } catch {
    return { ok: false, skipped: "db_missing" };
  }

  // Never snapshot an empty DB over a volume that already has richer backups —
  // a wipe+startup used to rotate good history out.
  try {
    const raw = await readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as DbSnapshot;
    const users = Array.isArray(parsed.users) ? parsed.users.length : 0;
    const assets = Array.isArray(parsed.assets) ? parsed.assets.length : 0;
    if (users === 0 && assets === 0 && reason === "startup") {
      return { ok: false, skipped: "empty_startup" };
    }
  } catch {
    // continue — still try to copy whatever is there if force/manual
  }

  await mkdir(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeReason = reason.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 32) || "manual";
  const dest = path.join(BACKUP_DIR, `veronix-db-${stamp}-${safeReason}.json`);
  await copyFile(DB_FILE, dest);
  lastBackupAt = now;

  const files = (await readdir(BACKUP_DIR))
    .filter((name) => name.startsWith("veronix-db-") && name.endsWith(".json"))
    .sort();
  const excess = files.slice(0, Math.max(0, files.length - MAX_BACKUPS));
  await Promise.all(excess.map((name) => rm(path.join(BACKUP_DIR, name), { force: true })));

  return { ok: true, file: dest };
}

export type BackupInfo = {
  name: string;
  path: string;
  bytes: number;
  mtimeMs: number;
  users: number;
  assets: number;
  sessions: number;
  sampleEmails: string[];
};

async function summarizeBackup(filePath: string, name: string): Promise<BackupInfo | null> {
  try {
    const st = await stat(filePath);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as DbSnapshot;
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    const assets = Array.isArray(parsed.assets) ? parsed.assets : [];
    const sessions = Array.isArray(parsed.processedCheckoutSessions)
      ? parsed.processedCheckoutSessions
      : [];
    const sampleEmails = users
      .map((u) =>
        u && typeof u === "object" && "email" in u
          ? String((u as { email?: string }).email || "")
          : "",
      )
      .filter(Boolean)
      .slice(0, 8);
    return {
      name,
      path: filePath,
      bytes: st.size,
      mtimeMs: st.mtimeMs,
      users: users.length,
      assets: assets.length,
      sessions: sessions.length,
      sampleEmails,
    };
  } catch {
    return null;
  }
}

export async function listDbBackups(): Promise<BackupInfo[]> {
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    const names = (await readdir(BACKUP_DIR))
      .filter((name) => name.startsWith("veronix-db-") && name.endsWith(".json"))
      .sort()
      .reverse();
    const out: BackupInfo[] = [];
    for (const name of names.slice(0, 40)) {
      const info = await summarizeBackup(path.join(BACKUP_DIR, name), name);
      if (info) out.push(info);
    }
    return out;
  } catch {
    return [];
  }
}

export async function currentDbStats(): Promise<{
  users: number;
  assets: number;
  sessions: number;
  bytes: number;
  sampleEmails: string[];
}> {
  try {
    const st = await stat(DB_FILE);
    const raw = await readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as DbSnapshot;
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    const assets = Array.isArray(parsed.assets) ? parsed.assets : [];
    const sessions = Array.isArray(parsed.processedCheckoutSessions)
      ? parsed.processedCheckoutSessions
      : [];
    return {
      users: users.length,
      assets: assets.length,
      sessions: sessions.length,
      bytes: st.size,
      sampleEmails: users
        .map((u) =>
          u && typeof u === "object" && "email" in u
            ? String((u as { email?: string }).email || "")
            : "",
        )
        .filter(Boolean)
        .slice(0, 8),
    };
  } catch {
    return { users: 0, assets: 0, sessions: 0, bytes: 0, sampleEmails: [] };
  }
}

type AssetLike = {
  id: string;
  userId: string;
  email?: string;
  [k: string]: unknown;
};
type UserLike = {
  id: string;
  email: string;
  credits?: number;
  [k: string]: unknown;
};

/**
 * Merge assets (and missing users) from a backup into the live DB.
 * Prefer backup user wallet when live has 0 assets but backup has the customer's media —
 * Stripe reconcile may have refilled credits without restoring spending history.
 */
export async function mergeDbFromBackup(opts: {
  backupName?: string;
  email?: string;
  /** Replace live DB entirely with the backup (after safety snapshot). */
  fullReplace?: boolean;
}): Promise<{
  ok: boolean;
  backup?: string;
  mergedUsers: number;
  mergedAssets: number;
  mergedSessions: number;
  message?: string;
}> {
  const backups = await listDbBackups();
  if (!backups.length) {
    return {
      ok: false,
      mergedUsers: 0,
      mergedAssets: 0,
      mergedSessions: 0,
      message: "no_backups",
    };
  }

  let chosen = backups[0]!;
  if (opts.backupName) {
    const hit = backups.find((b) => b.name === opts.backupName);
    if (!hit) {
      return {
        ok: false,
        mergedUsers: 0,
        mergedAssets: 0,
        mergedSessions: 0,
        message: "backup_not_found",
      };
    }
    chosen = hit;
  } else if (opts.email) {
    const email = opts.email.trim().toLowerCase();
    const rich = backups.find((b) => b.assets > 0 && b.sampleEmails.some((e) => e.toLowerCase() === email));
    const anyRich = backups.find((b) => b.assets > 0);
    chosen = rich || anyRich || chosen;
  } else {
    chosen = backups.find((b) => b.assets > 0) || chosen;
  }

  const rawBackup = await readFile(chosen.path, "utf8");
  const backup = JSON.parse(rawBackup) as {
    users: UserLike[];
    assets: AssetLike[];
    processedCheckoutSessions?: string[];
  };

  // Safety snapshot of current live DB before mutating.
  await backupCustomerDb("pre-restore", { force: true });

  if (opts.fullReplace) {
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.restoring`;
    await writeFile(tmp, JSON.stringify(backup, null, 2), "utf8");
    await rename(tmp, DB_FILE);
    return {
      ok: true,
      backup: chosen.name,
      mergedUsers: backup.users?.length || 0,
      mergedAssets: backup.assets?.length || 0,
      mergedSessions: backup.processedCheckoutSessions?.length || 0,
      message: "full_replace",
    };
  }

  const liveRaw = await readFile(DB_FILE, "utf8").catch(() =>
    JSON.stringify({ users: [], assets: [], processedCheckoutSessions: [] }),
  );
  const live = JSON.parse(liveRaw) as {
    users: UserLike[];
    assets: AssetLike[];
    processedCheckoutSessions?: string[];
  };
  live.users = Array.isArray(live.users) ? live.users : [];
  live.assets = Array.isArray(live.assets) ? live.assets : [];
  live.processedCheckoutSessions = Array.isArray(live.processedCheckoutSessions)
    ? live.processedCheckoutSessions
    : [];

  const emailFilter = opts.email?.trim().toLowerCase() || "";
  const backupUsers = (backup.users || []).filter((u) =>
    emailFilter ? String(u.email || "").toLowerCase() === emailFilter : true,
  );
  const backupUserIds = new Set(backupUsers.map((u) => u.id));

  let mergedUsers = 0;
  let mergedAssets = 0;
  let mergedSessions = 0;

  for (const bu of backupUsers) {
    const idx = live.users.findIndex(
      (u) =>
        u.id === bu.id ||
        String(u.email || "").toLowerCase() === String(bu.email || "").toLowerCase(),
    );
    if (idx < 0) {
      live.users.push(bu);
      mergedUsers += 1;
      continue;
    }
    const cur = live.users[idx]!;
    // Remap: keep live id (session cookies), pull richer fields from backup.
    const liveAssetsFor = live.assets.filter((a) => a.userId === cur.id).length;
    const backupAssetsFor = (backup.assets || []).filter(
      (a) => a.userId === bu.id || backupUserIds.has(a.userId),
    ).length;
    const patch: UserLike = { ...cur };
    // If live lost media but backup has it, restore wallet from backup (spent state).
    if (liveAssetsFor === 0 && backupAssetsFor > 0 && typeof bu.credits === "number") {
      patch.credits = bu.credits;
    }
    for (const key of [
      "planId",
      "freeVeronixUsed",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "googleId",
      "avatarUrl",
      "name",
    ] as const) {
      if (bu[key] != null && (cur[key] == null || cur[key] === "")) {
        patch[key] = bu[key];
      }
    }
    // Prefer backup plan if live is free but backup was paid.
    if (bu.planId && bu.planId !== "free" && (!cur.planId || cur.planId === "free")) {
      patch.planId = bu.planId;
    }
    live.users[idx] = patch;
    mergedUsers += 1;

    // Map backup assets onto live user id.
    const idMap = new Map<string, string>();
    idMap.set(bu.id, cur.id);
    for (const asset of backup.assets || []) {
      if (asset.userId !== bu.id) continue;
      if (live.assets.some((a) => a.id === asset.id)) continue;
      // Also skip near-duplicates by historyId+url.
      const hist = String(asset.historyId || "");
      const url = String(asset.url || "");
      if (
        hist &&
        live.assets.some(
          (a) => a.userId === cur.id && String(a.historyId || "") === hist,
        )
      ) {
        continue;
      }
      if (
        url &&
        live.assets.some((a) => a.userId === cur.id && String(a.url || "") === url)
      ) {
        continue;
      }
      live.assets.unshift({ ...asset, userId: cur.id });
      mergedAssets += 1;
    }
  }

  for (const sid of backup.processedCheckoutSessions || []) {
    if (!sid || live.processedCheckoutSessions.includes(sid)) continue;
    live.processedCheckoutSessions.push(sid);
    mergedSessions += 1;
  }

  const tmp = `${DB_FILE}.merging`;
  await writeFile(tmp, JSON.stringify(live, null, 2), "utf8");
  await rename(tmp, DB_FILE);

  return {
    ok: true,
    backup: chosen.name,
    mergedUsers,
    mergedAssets,
    mergedSessions,
    message: "merged",
  };
}

/**
 * If live DB looks wiped (0 assets) but a richer backup exists, merge it in.
 * Safe to call on every boot.
 */
export async function recoverDbFromBackupsIfNeeded(): Promise<{
  recovered: boolean;
  detail?: string;
}> {
  const current = await currentDbStats();
  const backups = await listDbBackups();
  const best = backups.find((b) => b.assets > current.assets || b.users > current.users);
  if (!best) return { recovered: false, detail: "no_richer_backup" };
  if (current.assets > 0 && current.users > 0) {
    // Only auto-recover on wipe-like states.
    if (!(current.assets === 0 && best.assets > 0)) {
      return { recovered: false, detail: "live_ok" };
    }
  }
  if (current.assets === 0 && best.assets > 0) {
    const result = await mergeDbFromBackup({ backupName: best.name });
    return {
      recovered: result.ok && result.mergedAssets > 0,
      detail: `${result.message}:${result.backup}:assets=${result.mergedAssets}`,
    };
  }
  if (current.users === 0 && best.users > 0) {
    const result = await mergeDbFromBackup({ backupName: best.name, fullReplace: true });
    return {
      recovered: result.ok,
      detail: `${result.message}:${result.backup}`,
    };
  }
  return { recovered: false, detail: "no_action" };
}
