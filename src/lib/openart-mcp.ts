import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const OPENART_MCP_URL = process.env.OPENART_MCP_URL ?? "https://mcp.openart.ai/mcp";

export class OpenArtConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenArtConfigError";
  }
}

function getAccessToken(): string {
  const token = process.env.OPENART_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new OpenArtConfigError(
      "OPENART_ACCESS_TOKEN is not set. Authenticate with OpenArt MCP (OAuth) and add the bearer token to your environment.",
    );
  }
  return token;
}

export function isOpenArtConfigured(): boolean {
  return Boolean(process.env.OPENART_ACCESS_TOKEN?.trim());
}

export function getOpenArtMcpEndpoint(): string {
  return process.env.OPENART_MCP_URL?.trim() || "https://mcp.openart.ai/mcp";
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
  const token = getAccessToken();
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
