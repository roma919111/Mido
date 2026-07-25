/**
 * Shared OpenArt auth types + app URL helpers.
 * Customer browsers do NOT hold OpenArt tokens.
 * Owner credentials live server-side (see owner-credentials.ts).
 */

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

export function getAppBaseUrl(request?: Request): string {
  const preview = "https://vyronix.loca.lt";
  const configured =
    process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const host = new URL(configured).hostname;
      if (/\.trycloudflare\.com$/i.test(host)) {
        return preview;
      }
    } catch {
      /* keep configured */
    }
    return configured.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") return preview;
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`;
  if (request) {
    const origin = new URL(request.url).origin;
    if (!/\.trycloudflare\.com$/i.test(new URL(origin).hostname)) return origin;
  }
  return "http://localhost:3000";
}

export function getOAuthCallbackUrl(request?: Request): string {
  return `${getAppBaseUrl(request)}/api/auth/callback`;
}

export function hasUsableAccessToken(session: OpenArtAuthSession): boolean {
  return Boolean(session.tokens?.access_token);
}
