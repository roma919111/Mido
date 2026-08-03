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

  // Prefer owner OAuth store (supports refresh). Env token is a simple bearer fallback.
  if (hasOwnerOAuth && !envToken) {
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

    try {
      await client.connect(transport);
      return await fn(client);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw new OpenArtConfigError(
          "Owner OpenArt MCP unauthorized. Reconnect the platform OpenArt account.",
          { needsAuth: true },
        );
      }
      throw error;
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

const THUMBNAIL_HINT = /thumb|cover|poster|preview|avatar/i;
const IMAGE_EXTENSION = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|#|$)/i;
const VIDEO_EXTENSION = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

function isThumbnailUrl(url: string): boolean {
  return THUMBNAIL_HINT.test(url);
}

function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSION.test(url) || /\/image\//i.test(url);
}

function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSION.test(url) || /\/video\//i.test(url);
}

function scoreMediaUrl(url: string, mediaType: "image" | "video"): number {
  let score = 0;

  if (mediaType === "video") {
    if (isVideoUrl(url)) score += 100;
    if (isImageUrl(url)) score -= 80;
    if (isThumbnailUrl(url)) score -= 60;
    if (!isVideoUrl(url) && !isImageUrl(url) && !isThumbnailUrl(url)) score += 20;
    return score;
  }

  if (isImageUrl(url) && !isThumbnailUrl(url)) score += 100;
  if (isVideoUrl(url)) score -= 80;
  if (isThumbnailUrl(url)) score -= 40;
  return score;
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

export function pickPrimaryMediaUrl(
  urls: string[],
  mediaType: "image" | "video",
): string {
  if (!urls.length) return "";

  const ranked = [...urls].sort(
    (a, b) => scoreMediaUrl(b, mediaType) - scoreMediaUrl(a, mediaType),
  );

  const best = ranked[0];
  if (!best) return "";

  if (mediaType === "video" && scoreMediaUrl(best, mediaType) < 0) {
    return "";
  }

  return best;
}

export function pickThumbnailUrl(urls: string[]): string | undefined {
  return urls.find((url) => isThumbnailUrl(url) || isImageUrl(url));
}

export type ResolvedMedia = {
  url: string;
  thumbnailUrl?: string;
  status: string;
  resourceId?: string;
  error?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalResourceStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return ["completed", "failed", "error", "cancelled", "canceled"].includes(normalized);
}

export function getResourceIds(payload: Record<string, unknown>): string[] {
  const ids = new Set<string>();

  const push = (value: unknown) => {
    if (typeof value === "string" && value.length > 0) ids.add(value);
  };

  const candidates = [
    payload.resourceIds,
    payload.resource_ids,
    (payload.data as Record<string, unknown> | undefined)?.resourceIds,
    (payload.data as Record<string, unknown> | undefined)?.resource_ids,
    (payload.result as Record<string, unknown> | undefined)?.resourceIds,
    (payload.result as Record<string, unknown> | undefined)?.resource_ids,
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) value.forEach(push);
  }

  for (const key of ["resources", "outputs", "items", "completions"] as const) {
    const list = payload[key];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const row = (entry ?? {}) as Record<string, unknown>;
      push(row.id);
      push(row.resourceId);
      push(row.resource_id);
    }
  }

  return [...ids];
}

function collectResourceCandidates(payload: Record<string, unknown>): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  const push = (node: unknown) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    rows.push(node as Record<string, unknown>);
  };

  push(payload);
  push(payload.data);
  push(payload.resource);
  push(payload.result);

  for (const key of ["resources", "outputs", "items", "completions"] as const) {
    const list = payload[key];
    if (Array.isArray(list)) list.forEach(push);
  }

  return rows;
}

export function extractResourceMedia(
  payload: Record<string, unknown>,
  mediaType: "image" | "video",
): ResolvedMedia | null {
  for (const row of collectResourceCandidates(payload)) {
    const status = String(row.status ?? "").toLowerCase();
    const url = typeof row.url === "string" ? row.url : "";
    const thumbnailUrl =
      typeof row.thumbnailUrl === "string"
        ? row.thumbnailUrl
        : typeof row.thumbnail_url === "string"
          ? row.thumbnail_url
          : undefined;

    if (status === "completed" && url) {
      const primary = pickPrimaryMediaUrl(
        [url, ...(thumbnailUrl ? [thumbnailUrl] : [])],
        mediaType,
      );
      if (primary) {
        return {
          url: primary,
          thumbnailUrl,
          status: "completed",
          resourceId:
            typeof row.id === "string"
              ? row.id
              : typeof row.resourceId === "string"
                ? row.resourceId
                : undefined,
        };
      }
    }

    if (isTerminalResourceStatus(status) && status !== "completed") {
      return {
        url: "",
        thumbnailUrl,
        status,
        resourceId: typeof row.id === "string" ? row.id : undefined,
        error:
          typeof row.error === "string"
            ? row.error
            : typeof row.message === "string"
              ? row.message
              : undefined,
      };
    }
  }

  return null;
}

export async function isRemoteMediaReady(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (head.ok) {
      const contentType = head.headers.get("content-type") ?? "";
      if (contentType.startsWith("video/") || contentType.startsWith("image/")) {
        return true;
      }
    }

    const probe = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-1023" },
      redirect: "follow",
    });
    return probe.ok;
  } catch {
    return false;
  }
}

async function fetchResourcePayload(resourceId: string): Promise<Record<string, unknown> | null> {
  const toolNames = ["openart_media_get", "openart_resource_get", "media_get"];

  for (const toolName of toolNames) {
    try {
      const result = await callOpenArtTool(toolName, { resourceId });
      if (!result.isError) {
        return parseToolPayload(result);
      }
    } catch {
      // try the next tool name
    }
  }

  return null;
}

export async function pollOpenArtResource(
  resourceId: string,
  mediaType: "image" | "video",
  options?: { attempts?: number; intervalMs?: number },
): Promise<ResolvedMedia | null> {
  const attempts = options?.attempts ?? 48;
  const intervalMs = options?.intervalMs ?? 5000;

  for (let i = 0; i < attempts; i += 1) {
    const payload = await fetchResourcePayload(resourceId);
    if (payload) {
      const resolved = extractResourceMedia(payload, mediaType);
      if (resolved) {
        if (resolved.status !== "completed" || !resolved.url) {
          return resolved;
        }

        if (mediaType === "video") {
          const ready = await isRemoteMediaReady(resolved.url);
          if (ready) return resolved;
        } else {
          return resolved;
        }
      }
    }

    await sleep(intervalMs);
  }

  return null;
}

export async function resolveGenerationMedia(
  payloads: Record<string, unknown>[],
  mediaType: "image" | "video",
  options?: { attempts?: number; intervalMs?: number },
): Promise<ResolvedMedia | null> {
  for (const payload of payloads) {
    const direct = extractResourceMedia(payload, mediaType);
    if (direct?.url) {
      if (mediaType === "image" || (await isRemoteMediaReady(direct.url))) {
        return direct;
      }
    }
  }

  const resourceIds = new Set<string>();
  for (const payload of payloads) {
    getResourceIds(payload).forEach((id) => resourceIds.add(id));
  }

  for (const resourceId of resourceIds) {
    const resolved = await pollOpenArtResource(resourceId, mediaType, options);
    if (resolved?.url) return resolved;
    if (resolved && isTerminalResourceStatus(resolved.status) && resolved.status !== "completed") {
      return resolved;
    }
  }

  const fallbackUrls = payloads.flatMap((payload) => collectMediaUrls(payload));
  const fallbackUrl = pickPrimaryMediaUrl(fallbackUrls, mediaType);
  if (fallbackUrl) {
    if (mediaType === "image" || (await isRemoteMediaReady(fallbackUrl))) {
      return {
        url: fallbackUrl,
        thumbnailUrl: pickThumbnailUrl(fallbackUrls),
        status: "completed",
      };
    }
  }

  return null;
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
