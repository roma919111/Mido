import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CompactEncrypt, compactDecrypt } from "jose";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "stripe.enc");

export type StripeCredentials = {
  secretKey: string;
  webhookSecret?: string;
  updatedAt?: string;
};

async function getEncryptionKey(): Promise<Uint8Array> {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.OPENART_SESSION_SECRET?.trim() ||
    "vyronix-local-dev-secret-change-me";
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
}

export async function loadStripeCredentials(): Promise<StripeCredentials | null> {
  const envKey = process.env.STRIPE_SECRET_KEY?.trim();
  const envWebhook = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (envKey) {
    return {
      secretKey: envKey,
      webhookSecret: envWebhook || undefined,
    };
  }

  try {
    const raw = await readFile(FILE, "utf8");
    const key = await getEncryptionKey();
    const { plaintext } = await compactDecrypt(raw.trim(), key);
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as StripeCredentials;
    if (parsed?.secretKey) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function saveStripeCredentials(input: {
  secretKey: string;
  webhookSecret?: string;
}): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const payload: StripeCredentials = {
    secretKey: input.secretKey.trim(),
    webhookSecret: input.webhookSecret?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  const key = await getEncryptionKey();
  const token = await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);
  await writeFile(FILE, token, "utf8");
}

export async function hasStripeCredentials(): Promise<boolean> {
  return Boolean((await loadStripeCredentials())?.secretKey);
}
