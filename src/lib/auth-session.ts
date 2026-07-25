import { cookies } from "next/headers";
import { CompactEncrypt, compactDecrypt } from "jose";

export type OpenArtOAuthTokens = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
  obtained_at?: number;
};

export type OpenArtClientInformation = {
  client_id: string;
  client_secret?: string;
  redirect_uris?: string[];
  [key: string]: unknown;
};

export type OpenArtAuthSession = {
  clientInformation?: OpenArtClientInformation;
  tokens?: OpenArtOAuthTokens;
  codeVerifier?: string;
  oauthState?: string;
};

const COOKIE_NAME = "vyronix_openart_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function getEncryptionKey(): Promise<Uint8Array> {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.OPENART_SESSION_SECRET?.trim() ||
    "vyronix-dev-auth-secret-change-me";
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
}

export function getAppBaseUrl(request?: Request): string {
  const configured = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`;
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}

export function getOAuthCallbackUrl(request?: Request): string {
  return `${getAppBaseUrl(request)}/api/auth/callback`;
}

export async function loadAuthSession(): Promise<OpenArtAuthSession> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return {};

  try {
    const key = await getEncryptionKey();
    const { plaintext } = await compactDecrypt(raw, key);
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as OpenArtAuthSession;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveAuthSession(session: OpenArtAuthSession): Promise<void> {
  const jar = await cookies();
  const key = await getEncryptionKey();
  const payload = new TextEncoder().encode(JSON.stringify(session));
  const token = await new CompactEncrypt(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);

  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearAuthSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function hasUsableAccessToken(session: OpenArtAuthSession): boolean {
  return Boolean(session.tokens?.access_token);
}
