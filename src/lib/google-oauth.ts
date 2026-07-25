import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getAppBaseUrl } from "@/lib/app-url";
import { loadGoogleCredentials } from "@/lib/google-credentials";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const REDIRECT_COOKIE = "veronix_google_redirect";

export async function isGoogleOAuthConfigured(): Promise<boolean> {
  return Boolean(await loadGoogleCredentials());
}

async function requireCreds() {
  const creds = await loadGoogleCredentials();
  if (!creds) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured");
  }
  return creds;
}

/**
 * Public site origin for OAuth redirects.
 * Locked public URL only — never follow request Host headers (prevents Google mismatch).
 */
export function resolvePublicOrigin(_request?: Request): string {
  return getAppBaseUrl().replace(/\/$/, "") || "http://localhost:3000";
}

/** Always the owner-locked callback. Ignore request host so Google Console stays valid. */
export function getGoogleRedirectUri(_request?: Request): string {
  return `${resolvePublicOrigin()}/api/auth/google/callback`;
}

export async function rememberGoogleRedirectUri(redirectUri: string): Promise<void> {
  const jar = await cookies();
  jar.set(REDIRECT_COOKIE, redirectUri, {
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUri.startsWith("https://"),
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function readRememberedGoogleRedirectUri(
  fallbackRequest?: Request,
): Promise<string> {
  const jar = await cookies();
  const saved = jar.get(REDIRECT_COOKIE)?.value?.trim();
  if (saved) return saved;
  return getGoogleRedirectUri(fallbackRequest);
}

export function createOAuthState(nextPath: string): string {
  const nonce = randomBytes(16).toString("hex");
  return Buffer.from(
    JSON.stringify({ n: nonce, next: nextPath || "/", t: Date.now() }),
  ).toString("base64url");
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

export async function buildGoogleAuthUrl(
  state: string,
  request?: Request,
): Promise<string> {
  const { clientId } = await requireCreds();
  const redirectUri = getGoogleRedirectUri(request);
  await rememberGoogleRedirectUri(redirectUri);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string,
  request?: Request,
): Promise<{
  access_token: string;
  id_token?: string;
}> {
  const { clientId, clientSecret } = await requireCreds();
  const redirectUri = await readRememberedGoogleRedirectUri(request);
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
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

export function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}
