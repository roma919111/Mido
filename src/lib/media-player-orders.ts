import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "media-player-orders.json");

export type MediaPlayerOrder = {
  id: string;
  email: string;
  stripeSessionId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  source?: string;
  paidAt: string;
  expiresAt: string;
  createdAt: string;
};

type OrderDb = { orders: MediaPlayerOrder[] };

async function loadDb(): Promise<OrderDb> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as OrderDb;
    return { orders: Array.isArray(parsed.orders) ? parsed.orders : [] };
  } catch {
    return { orders: [] };
  }
}

async function saveDb(db: OrderDb): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function recordMediaPlayerOrder(input: {
  email: string;
  stripeSessionId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  source?: string;
}): Promise<MediaPlayerOrder> {
  const db = await loadDb();
  const existing = db.orders.find((row) => row.stripeSessionId === input.stripeSessionId);
  if (existing) return existing;

  const paidAt = new Date();
  const expires = new Date(paidAt);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);

  const order: MediaPlayerOrder = {
    id: randomUUID(),
    email: input.email.trim().toLowerCase(),
    stripeSessionId: input.stripeSessionId,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    source: input.source?.trim() || undefined,
    paidAt: paidAt.toISOString(),
    expiresAt: expires.toISOString(),
    createdAt: paidAt.toISOString(),
  };
  db.orders.unshift(order);
  await saveDb(db);
  return order;
}

export async function extendMediaPlayerOrderBySubscription(subscriptionId: string): Promise<MediaPlayerOrder | null> {
  const id = subscriptionId.trim();
  if (!id) return null;
  const db = await loadDb();
  const row = db.orders.find((order) => order.stripeSubscriptionId === id);
  if (!row) return null;
  const currentExpiry = Date.parse(row.expiresAt);
  const base = Number.isFinite(currentExpiry) ? new Date(Math.max(Date.now(), currentExpiry)) : new Date();
  base.setUTCFullYear(base.getUTCFullYear() + 1);
  row.expiresAt = base.toISOString();
  await saveDb(db);
  return row;
}

export async function listMediaPlayerOrders(limit = 100): Promise<MediaPlayerOrder[]> {
  const db = await loadDb();
  return db.orders.slice(0, limit);
}
