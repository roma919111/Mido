import {
  auth,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  getAppBaseUrl,
  getOAuthCallbackUrl,
  loadAuthSession,
  saveAuthSession,
  type OpenArtAuthSession,
} from "@/lib/auth-session";

function getMcpEndpoint(): string {
  return process.env.OPENART_MCP_URL?.trim() || "https://mcp.openart.ai/mcp";
}

const CLIENT_NAME = "VYRONIX.AI";
const OAUTH_SCOPE = "full_access";

export class SessionOAuthClientProvider implements OAuthClientProvider {
  private session: OpenArtAuthSession;
  private readonly redirectUri: string;
  private readonly onRedirect: (url: URL) => void;
  private dirty = false;
  private pendingAuthorizationUrl: URL | null = null;

  constructor(options: {
    session: OpenArtAuthSession;
    redirectUri: string;
    onRedirect?: (url: URL) => void;
  }) {
    this.session = options.session;
    this.redirectUri = options.redirectUri;
    this.onRedirect =
      options.onRedirect ??
      ((url) => {
        this.pendingAuthorizationUrl = url;
      });
  }

  get redirectUrl(): string {
    return this.redirectUri;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: CLIENT_NAME,
      redirect_uris: [this.redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: OAUTH_SCOPE,
    };
  }

  async state(): Promise<string> {
    if (!this.session.oauthState) {
      this.session.oauthState = crypto.randomUUID();
      await this.persist();
    }
    return this.session.oauthState;
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    return this.session.clientInformation as OAuthClientInformationMixed | undefined;
  }

  async saveClientInformation(clientInformation: OAuthClientInformationMixed): Promise<void> {
    this.session.clientInformation = clientInformation as OpenArtAuthSession["clientInformation"];
    await this.persist();
  }

  tokens(): OAuthTokens | undefined {
    const tokens = this.session.tokens;
    if (!tokens?.access_token) return undefined;
    return {
      access_token: tokens.access_token,
      token_type: tokens.token_type ?? "Bearer",
      expires_in: tokens.expires_in,
      scope: tokens.scope,
      refresh_token: tokens.refresh_token,
    };
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this.session.tokens = {
      ...tokens,
      obtained_at: Date.now(),
    };
    // PKCE verifier / state no longer needed after successful token exchange.
    delete this.session.codeVerifier;
    delete this.session.oauthState;
    await this.persist();
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    this.pendingAuthorizationUrl = authorizationUrl;
    this.onRedirect(authorizationUrl);
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this.session.codeVerifier = codeVerifier;
    await this.persist();
  }

  async codeVerifier(): Promise<string> {
    if (!this.session.codeVerifier) {
      throw new Error("No PKCE code verifier saved for this OpenArt OAuth session");
    }
    return this.session.codeVerifier;
  }

  async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier" | "discovery",
  ): Promise<void> {
    if (scope === "all") {
      this.session = {};
    } else if (scope === "client") {
      delete this.session.clientInformation;
    } else if (scope === "tokens") {
      delete this.session.tokens;
    } else if (scope === "verifier") {
      delete this.session.codeVerifier;
      delete this.session.oauthState;
    }
    await this.persist();
  }

  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    return undefined;
  }

  async saveDiscoveryState(): Promise<void> {
    // Intentionally not persisted to keep the session cookie small.
  }

  getAuthorizationUrl(): URL | null {
    return this.pendingAuthorizationUrl;
  }

  getSession(): OpenArtAuthSession {
    return this.session;
  }

  private async persist(): Promise<void> {
    this.dirty = true;
    await saveAuthSession(this.session);
  }

  async flush(): Promise<void> {
    if (this.dirty) {
      await saveAuthSession(this.session);
      this.dirty = false;
    }
  }
}

function ensureClientMatchesRedirect(session: OpenArtAuthSession, redirectUri: string) {
  const registered = session.clientInformation?.redirect_uris;
  if (Array.isArray(registered) && registered.length > 0 && !registered.includes(redirectUri)) {
    delete session.clientInformation;
  }
}

export async function createSessionOAuthProvider(options?: {
  request?: Request;
  onRedirect?: (url: URL) => void;
}): Promise<SessionOAuthClientProvider> {
  const redirectUri = getOAuthCallbackUrl(options?.request);
  const session = await loadAuthSession();
  ensureClientMatchesRedirect(session, redirectUri);

  return new SessionOAuthClientProvider({
    session,
    redirectUri,
    onRedirect: options?.onRedirect,
  });
}

export async function beginOpenArtOAuthLogin(request: Request): Promise<URL> {
  let authorizationUrl: URL | undefined;

  const provider = await createSessionOAuthProvider({
    request,
    onRedirect: (url) => {
      authorizationUrl = url;
    },
  });

  const result = await auth(provider, {
    serverUrl: getMcpEndpoint(),
    scope: OAUTH_SCOPE,
  });

  await provider.flush();

  if (result === "AUTHORIZED") {
    return new URL("/", getAppBaseUrl(request));
  }

  const url = authorizationUrl ?? provider.getAuthorizationUrl();
  if (!url) {
    throw new Error("OpenArt OAuth did not return an authorization URL");
  }
  return url;
}

export async function completeOpenArtOAuthLogin(
  request: Request,
  authorizationCode: string,
  state?: string | null,
): Promise<void> {
  const session = await loadAuthSession();
  if (state && session.oauthState && state !== session.oauthState) {
    throw new Error("Invalid OAuth state — restart Sign in with OpenArt");
  }

  const provider = await createSessionOAuthProvider({ request });
  const result = await auth(provider, {
    serverUrl: getMcpEndpoint(),
    authorizationCode,
    scope: OAUTH_SCOPE,
  });

  await provider.flush();

  if (result !== "AUTHORIZED") {
    throw new Error("OpenArt OAuth completed without issuing tokens");
  }
}

export { OAUTH_SCOPE };
