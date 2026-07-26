import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  getEnvAccessToken,
  getOwnerAccessToken,
  hasOwnerCredentials,
  loadOwnerAuthSession,
} from "@/lib/owner-credentials";
import { createOwnerOAuthProvider } from "@/lib/openart-oauth";

const OPENART_MCP_URL = process.env.OPENART_MCP_URL ?? "https://mcp.openart.ai/mcp";

export class OpenArtConfigError extends Error {
  needsAuth: boolean;

  constructor(message: string, options?: { needsAuth?: boolean }) {
    super(message);
    this.name = "OpenArtConfigError";
    // needsAuth here means the PLATFORM OWNER must connect OpenArt server-side.
    this.needsAuth = Boolean(options?.needsAuth);
  }
}

export function getOpenArtMcpEndpoint(): string {
  return process.env.OPENART_MCP_URL?.trim() || "https://mcp.openart.ai/mcp";
}

export { getEnvAccessToken };

export async function isOpenArtConfigured(): Promise<boolean> {
  return hasOwnerCredentials();
}

type ToolContent = {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  [key: string]: unknown;
};

export type ToolCallResult = {
  content: ToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        // continue
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // continue
      }
    }
    return null;
  }
}

export function parseToolPayload(result: ToolCallResult): Record<string, unknown> {
  if (result.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent;
  }

  for (const part of result.content ?? []) {
    if (part.type === "text" && typeof part.text === "string") {
      const parsed = extractJson(part.text);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    }
  }

  const texts = (result.content ?? [])
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text as string);

  return {
    rawText: texts.join("\n"),
  };
}

/**
 * All MCP calls use the platform OWNER OpenArt account.
 * Customers never authenticate — generations bill the owner.
 */
export async function withOpenArtClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const envToken = getEnvAccessToken();
  const ownerSession = await loadOwnerAuthSession();
  const hasOwnerOAuth = Boolean(ownerSession.tokens?.access_token);

  if (!envToken && !hasOwnerOAuth) {
    throw new OpenArtConfigError(
      "Platform OpenArt account is not connected. Set OPENART_ACCESS_TOKEN on the server (owner account).",
      { needsAuth: true },
    );
  }

  const hasRefreshableOAuth = Boolean(
    ownerSession.tokens?.refresh_token || ownerSession.tokens?.access_token,
  );

  // Prefer owner OAuth store whenever present — MCP SDK can refresh expired tokens.
  // A stale OPENART_ACCESS_TOKEN env must not block refreshable OAuth.
  if (hasRefreshableOAuth) {
    const provider = await createOwnerOAuthProvider({
      onRedirect: () => {
        throw new OpenArtConfigError(
          "Owner OpenArt session expired. Reconnect the platform account via OPENART_ACCESS_TOKEN or owner setup.",
          { needsAuth: true },
        );
      },
    });

    const transport = new StreamableHTTPClientTransport(new URL(OPENART_MCP_URL), {
      authProvider: provider,
      requestInit: {
        headers: {
          Accept: "application/json, text/event-stream",
        },
      },
    });

    const client = new Client({ name: "vyronix-ai", version: "1.0.0" });

    let oauthOk = false;
    try {
      await client.connect(transport);
      const value = await fn(client);
      oauthOk = true;
      return value;
    } catch (error) {
      if (error instanceof UnauthorizedError && envToken) {
        // Fall through to static env bearer if OAuth refresh failed.
      } else if (error instanceof UnauthorizedError) {
        throw new OpenArtConfigError(
          "Owner OpenArt MCP unauthorized. Reconnect the platform OpenArt account.",
          { needsAuth: true },
        );
      } else {
        throw error;
      }
    } finally {
      try {
        await provider.flush();
      } catch {
        // ignore
      }
      try {
        await client.close();
      } catch {
        // ignore
      }
    }
    if (oauthOk) {
      // unreachable — kept for clarity
    }
  }

  const token = envToken ?? (await getOwnerAccessToken());
  if (!token) {
    throw new OpenArtConfigError(
      "Platform OpenArt account is not connected. Set OPENART_ACCESS_TOKEN on the server.",
      { needsAuth: true },
    );
  }

  const transport = new StreamableHTTPClientTransport(new URL(OPENART_MCP_URL), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json, text/event-stream",
      },
    },
  });

  const client = new Client({ name: "vyronix-ai", version: "1.0.0" });
  await client.connect(transport);

  try {
    return await fn(client);
  } finally {
    try {
      await client.close();
    } catch {
      // ignore
    }
  }
}

export async function callOpenArtTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolCallResult> {
  return withOpenArtClient(async (client) => {
    const result = await client.callTool({ name, arguments: args });
    return result as ToolCallResult;
  });
}

export function collectMediaUrls(payload: Record<string, unknown>): string[] {
  const urls = new Set<string>();

  const push = (value: unknown) => {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) {
      urls.add(value);
    }
  };

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    const obj = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      if (
        /url|uri|src|image|video|thumbnail|cover/i.test(key) &&
        typeof value === "string"
      ) {
        push(value);
      }
      walk(value);
    }
  };

  walk(payload);
  return [...urls];
}

export function getHistoryId(payload: Record<string, unknown>): string | undefined {
  const candidates = [
    payload.historyId,
    payload.history_id,
    payload.id,
    (payload.data as Record<string, unknown> | undefined)?.historyId,
    (payload.result as Record<string, unknown> | undefined)?.historyId,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}
