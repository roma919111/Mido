import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "veronix-db.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MAX_BACKUPS = 24;
/** Minimum gap between automatic save-triggered backups. */
const MIN_INTERVAL_MS = 5 * 60 * 1000;

let lastBackupAt = 0;

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
