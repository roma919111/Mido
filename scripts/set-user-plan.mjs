#!/usr/bin/env node
/**
 * Set a user's plan in production DB (.data/veronix-db.json).
 * Usage: node scripts/set-user-plan.mjs <email> [planId]
 * Example: railway run node scripts/set-user-plan.mjs losmercadooss@gmail.com pro
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "veronix-db.json");

const email = process.argv[2]?.trim().toLowerCase();
const planId = process.argv[3]?.trim() || "pro";

if (!email) {
  console.error("Usage: node scripts/set-user-plan.mjs <email> [free|mini|pro]");
  process.exit(1);
}

if (!["free", "mini", "pro"].includes(planId)) {
  console.error("planId must be free, mini, or pro");
  process.exit(1);
}

await mkdir(DATA_DIR, { recursive: true });

let db;
try {
  db = JSON.parse(await readFile(DB_FILE, "utf8"));
} catch {
  console.error("DB file not found:", DB_FILE);
  process.exit(1);
}

const user = (db.users || []).find(
  (u) => String(u.email || "").toLowerCase() === email,
);
if (!user) {
  console.error("User not found:", email);
  process.exit(1);
}

const before = user.planId || "free";
user.planId = planId;
user.updatedAt = new Date().toISOString();

const tmp = `${DB_FILE}.${Date.now()}.tmp`;
await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
await rename(tmp, DB_FILE);

console.log(
  JSON.stringify(
    {
      ok: true,
      email: user.email,
      planBefore: before,
      planAfter: planId,
    },
    null,
    2,
  ),
);
