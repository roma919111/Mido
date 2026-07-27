/**
 * OpenArt MCP is retired. Keep parsers / types for legacy data cleanup only.
 * All live generation, upload, pricing, and status go through BytePlus / local.
 */

export class OpenArtConfigError extends Error {
  needsAuth: boolean;

  constructor(message: string, options?: { needsAuth?: boolean }) {
    super(message);
    this.name = "OpenArtConfigError";
    this.needsAuth = Boolean(options?.needsAuth);
  }
}

export function getOpenArtMcpEndpoint(): string {
  return "disabled";
}

export async function isOpenArtConfigured(): Promise<boolean> {
  return false;
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
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function parseToolPayload(result: ToolCallResult): Record<string, unknown> {
  if (result.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent as Record<string, unknown>;
  }

  const texts = (result.content || [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string);

  for (const text of texts) {
    const parsed = extractJson(text);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  }

  return {
    rawText: texts.join("\n"),
  };
}

/** Hard-disabled — never dials mcp.openart.ai. */
export async function withOpenArtClient<T>(_fn?: unknown): Promise<T> {
  void _fn;
  throw new OpenArtConfigError(
    "OpenArt MCP is disabled. VYRONIX uses BytePlus ModelArk only.",
    { needsAuth: false },
  );
}

/** Hard-disabled — never dials mcp.openart.ai. */
export async function callOpenArtTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolCallResult> {
  void name;
  void args;
  throw new OpenArtConfigError(
    "OpenArt MCP is disabled. VYRONIX uses BytePlus ModelArk only.",
    { needsAuth: false },
  );
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

export function getHistoryId(payload: Record<string, unknown>): string | null {
  const id =
    payload.historyId ??
    payload.history_id ??
    payload.id ??
    (payload.data as Record<string, unknown> | undefined)?.historyId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
