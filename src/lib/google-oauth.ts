import { createHash, randomBytes } from "node:crypto";
import { getAppBaseUrl } from "@/lib/app-url";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export function getGoogleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!id) throw new Error("GOOGLE_CLIENT_ID is not configured");
  return id;
}

export function getGoogleClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET is not configured");
  return secret;
}

export function getGoogleRedirectUri(): string {
  return `${getAppBaseUrl().replace(/\/$/, "")}/api/auth/google/callback`;
}

export function createOAuthState(nextPath: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = Buffer.from(
    JSON.stringify({ n: nonce, next: nextPath || "/", t: Date.now() }),
  ).toString("base64url");
  return payload;
}

export function parseOAuthState(state: string | null): { next: string } {
  if (!state) return { next: "/" };
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { next?: string };
    const next = parsed.next && parsed.next.startsWith("/") ? parsed.next : "/";
    return { next };
  } catch {
    return { next: "/" };
  }
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  id_token?: string;
}> {
  const body = new URLSearchParams({
    code,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    redirect_uri: getGoogleRedirectUri(),
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token exchange failed");
  }
  return { access_token: data.access_token, id_token: data.id_token };
}

export async function fetchGoogleUser(accessToken: string): Promise<{
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}> {
  const res = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    error?: string;
  };
  if (!res.ok || !data.sub || !data.email) {
    throw new Error(data.error || "Failed to load Google profile");
  }
  if (data.email_verified === false) {
    throw new Error("Google email is not verified");
  }
  return {
    googleId: data.sub,
    email: data.email.toLowerCase(),
    name: data.name || data.email.split("@")[0] || "Creator",
    avatarUrl: data.picture,
  };
}

/** Tiny helper kept for future PKCE if needed */
export function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}
