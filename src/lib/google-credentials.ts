import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CompactEncrypt, compactDecrypt } from "jose";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "google-oauth.enc");

export type GoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
  updatedAt?: string;
};

async function getEncryptionKey(): Promise<Uint8Array> {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.OPENART_SESSION_SECRET?.trim() ||
    "veronix-dev-auth-secret-change-me";
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
}

export async function loadGoogleCredentials(): Promise<GoogleOAuthCredentials | null> {
  const envId = process.env.GOOGLE_CLIENT_ID?.trim();
  const envSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (envId && envSecret) {
    return { clientId: envId, clientSecret: envSecret };
  }

  try {
    const raw = await readFile(FILE, "utf8");
    const key = await getEncryptionKey();
    const { plaintext } = await compactDecrypt(raw.trim(), key);
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as GoogleOAuthCredentials;
    if (parsed?.clientId && parsed?.clientSecret) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function saveGoogleCredentials(input: {
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const payload: GoogleOAuthCredentials = {
    clientId: input.clientId.trim(),
    clientSecret: input.clientSecret.trim(),
    updatedAt: new Date().toISOString(),
  };
  const key = await getEncryptionKey();
  const token = await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);
  await writeFile(FILE, token, "utf8");
}

export async function hasGoogleCredentials(): Promise<boolean> {
  return Boolean(await loadGoogleCredentials());
}
