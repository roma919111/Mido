import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { CompactEncrypt, compactDecrypt } from "jose";
import type { OpenArtAuthSession, OpenArtOAuthTokens } from "@/lib/auth-session";

/**
 * Server-side owner OpenArt credentials.
 * All customer generations bill this single platform account.
 * Priority: OPENART_ACCESS_TOKEN env → encrypted local owner store.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const OWNER_FILE = path.join(DATA_DIR, "openart-owner.enc");

async function getEncryptionKey(): Promise<Uint8Array> {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.OPENART_SESSION_SECRET?.trim() ||
    "vyronix-dev-auth-secret-change-me";
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
}

export function getEnvAccessToken(): string | undefined {
  return process.env.OPENART_ACCESS_TOKEN?.trim() || undefined;
}

export async function loadOwnerAuthSession(): Promise<OpenArtAuthSession> {
  try {
    const raw = await readFile(OWNER_FILE, "utf8");
    const key = await getEncryptionKey();
    const { plaintext } = await compactDecrypt(raw.trim(), key);
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as OpenArtAuthSession;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // Optional Railway/env bootstrap when the volume file is missing.
    const fromEnv = process.env.OPENART_OWNER_SESSION_JWE?.trim();
    if (!fromEnv) return {};
    try {
      const key = await getEncryptionKey();
      const { plaintext } = await compactDecrypt(fromEnv, key);
      const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as OpenArtAuthSession;
      if (parsed && typeof parsed === "object") {
        // Persist onto the volume so later refreshes stick.
        await saveOwnerAuthSession(parsed).catch(() => undefined);
        return parsed;
      }
    } catch {
      return {};
    }
    return {};
  }
}

export async function saveOwnerAuthSession(session: OpenArtAuthSession): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const key = await getEncryptionKey();
  const payload = new TextEncoder().encode(JSON.stringify(session));
  const token = await new CompactEncrypt(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);
  await writeFile(OWNER_FILE, token, "utf8");
}

export async function clearOwnerAuthSession(): Promise<void> {
  try {
    await unlink(OWNER_FILE);
  } catch {
    // ignore missing file
  }
}

export async function getOwnerAccessToken(): Promise<string | undefined> {
  const envToken = getEnvAccessToken();
  if (envToken) return envToken;

  const session = await loadOwnerAuthSession();
  return session.tokens?.access_token;
}

export async function hasOwnerCredentials(): Promise<boolean> {
  return Boolean(await getOwnerAccessToken());
}

export async function saveOwnerTokens(tokens: OpenArtOAuthTokens): Promise<void> {
  const session = await loadOwnerAuthSession();
  session.tokens = {
    ...tokens,
    obtained_at: Date.now(),
  };
  delete session.codeVerifier;
  delete session.oauthState;
  await saveOwnerAuthSession(session);
}

export function isOwnerSetupAuthorized(request: Request): boolean {
  const required = process.env.OWNER_SETUP_KEY?.trim();
  if (!required) return true; // open setup when no key configured (local/dev)
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || request.headers.get("x-owner-setup-key");
  return key === required;
}
