import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "public-base-url.json");

type Stored = {
  origin: string;
  lockedAt: string;
};

function normalizeOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  const url = new URL(trimmed);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Public URL must be http(s)");
  }
  return `${url.protocol}//${url.host}`;
}

/** Owner-locked public origin used for Google/Stripe redirects. */
export function loadLockedPublicOrigin(): string | null {
  try {
    if (!existsSync(FILE)) return null;
    const raw = readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.origin) return null;
    return normalizeOrigin(parsed.origin);
  } catch {
    return null;
  }
}

export function saveLockedPublicOrigin(origin: string): string {
  const normalized = normalizeOrigin(origin);
  mkdirSync(DATA_DIR, { recursive: true });
  const payload: Stored = {
    origin: normalized,
    lockedAt: new Date().toISOString(),
  };
  writeFileSync(FILE, JSON.stringify(payload, null, 2), "utf8");
  return normalized;
}

export function googleRedirectUriForOrigin(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
}
