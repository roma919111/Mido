/**
 * Shared OpenArt auth types + app URL helpers.
 * Customer browsers do NOT hold OpenArt tokens.
 * Owner credentials live server-side (see owner-credentials.ts).
 */

import { CANONICAL_APP_ORIGIN, getAppBaseUrl as getLockedAppBaseUrl } from "@/lib/app-url";

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

export function getAppBaseUrl(_request?: Request): string {
  // Always prefer locked/canonical public origin — never request.host / localhost
  // so OpenArt/Google/Stripe callbacks stay on vyronix.app.
  void _request;
  return getLockedAppBaseUrl() || CANONICAL_APP_ORIGIN;
}

export function getOAuthCallbackUrl(request?: Request): string {
  return `${getAppBaseUrl(request)}/api/auth/callback`;
}

export function hasUsableAccessToken(session: OpenArtAuthSession): boolean {
  return Boolean(session.tokens?.access_token);
}
