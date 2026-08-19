import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DATA_DIR = path.join(process.cwd(), ".data");

export type StorageStatus = {
  usedBytes: number;
  totalBytes: number;
  freeBytes: number;
  usedPct: number;
  /** Show customer storage modal when true */
  pressure: boolean;
  /** Block new generations / uploads when critically full */
  critical: boolean;
};

const PRESSURE_PCT = 85;
const CRITICAL_PCT = 95;

export async function getStorageStatus(): Promise<StorageStatus> {
  try {
    const { stdout } = await execFileAsync("df", ["-k", DATA_DIR]);
    const lines = stdout.trim().split("\n");
    const parts = (lines[1] || "").split(/\s+/);
    const totalKb = Number(parts[1]);
    const usedKb = Number(parts[2]);
    const freeKb = Number(parts[3]);
    if (!Number.isFinite(totalKb) || totalKb <= 0) {
      throw new Error("df parse failed");
    }
    const totalBytes = totalKb * 1024;
    const usedBytes = usedKb * 1024;
    const freeBytes = Math.max(0, freeKb * 1024);
    const usedPct = Math.min(100, Math.round((usedBytes / totalBytes) * 1000) / 10);
    return {
      usedBytes,
      totalBytes,
      freeBytes,
      usedPct,
      pressure: usedPct >= PRESSURE_PCT,
      critical: usedPct >= CRITICAL_PCT,
    };
  } catch {
    return {
      usedBytes: 0,
      totalBytes: 5 * 1024 * 1024 * 1024,
      freeBytes: 5 * 1024 * 1024 * 1024,
      usedPct: 0,
      pressure: false,
      critical: false,
    };
  }
}

export function formatBytes(bytes: number, locale: "ar" | "en" = "ar"): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return locale === "ar" ? `${gb.toFixed(1)} جيجا` : `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return locale === "ar" ? `${Math.round(mb)} ميجا` : `${Math.round(mb)} MB`;
}
