import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { hasUsableAccessToken, loadAuthSession } from "@/lib/auth-session";
import { createSessionOAuthProvider } from "@/lib/openart-oauth";

const OPENART_MCP_URL = process.env.OPENART_MCP_URL ?? "https://mcp.openart.ai/mcp";

export class OpenArtConfigError extends Error {
  needsAuth: boolean;

  constructor(message: string, options?: { needsAuth?: boolean }) {
    super(message);
    this.name = "OpenArtConfigError";
    this.needsAuth = Boolean(options?.needsAuth);
  }
}

export function getOpenArtMcpEndpoint(): string {
  return process.env.OPENART_MCP_URL?.trim() || "https://mcp.openart.ai/mcp";
}

export function getEnvAccessToken(): string | undefined {
  return process.env.OPENART_ACCESS_TOKEN?.trim() || undefined;
}

export async function isOpenArtConfigured(): Promise<boolean> {
  if (getEnvAccessToken()) return true;
  const session = await loadAuthSession();
  return hasUsableAccessToken(session);
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

export async function withOpenArtClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const session = await loadAuthSession();
  const envToken = getEnvAccessToken();
  const hasSessionToken = hasUsableAccessToken(session);

  if (!hasSessionToken && !envToken) {
    throw new OpenArtConfigError(
      "Not signed in with OpenArt. Use Sign in with OpenArt to authenticate for MCP.",
      { needsAuth: true },
    );
  }

  // Prefer dynamic OAuth session tokens; fall back to optional static env token.
  if (hasSessionToken) {
    const provider = await createSessionOAuthProvider({
      onRedirect: () => {
        throw new OpenArtConfigError(
          "OpenArt session expired or requires re-authorization. Sign in with OpenArt again.",
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

    try {
      await client.connect(transport);
      return await fn(client);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw new OpenArtConfigError(
          "OpenArt MCP unauthorized. Sign in with OpenArt to continue.",
          { needsAuth: true },
        );
      }
      throw error;
    } finally {
      try {
        await provider.flush();
      } catch {
        // ignore persistence errors
      }
      try {
        await client.close();
      } catch {
        // ignore close errors
      }
    }
  }

  const transport = new StreamableHTTPClientTransport(new URL(OPENART_MCP_URL), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${envToken}`,
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
      // ignore close errors
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
