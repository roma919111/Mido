import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  callOpenArtTool,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";
import type { CatalogModel, ModelKind } from "@/lib/model-catalog";
import { VIDEO_DURATION_FALLBACKS } from "@/lib/model-catalog";
import { saveCostCache } from "@/lib/openart-cost-cache";
import type { CostCacheItem } from "@/lib/openart-cost-defaults";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";

const DATA_DIR = path.join(process.cwd(), ".data");
const CATALOG_FILE = path.join(DATA_DIR, "openart-catalog.json");

type OpenArtMode = { mode: string; description?: string };
type OpenArtModelRow = {
  id: string;
  displayName?: string;
  description?: string;
  modes?: {
    image?: OpenArtMode[];
    video?: OpenArtMode[];
  };
};

export type SyncedCatalogFile = {
  updatedAt: string;
  source: "openart_model_list";
  image: CatalogModel[];
  video: CatalogModel[];
};

/** Stable Veronix catalog ids for known OpenArt MCP model ids. */
const MCP_TO_CATALOG_ID: Record<string, string> = {
  "byte-plus-seedance-2-mini": VERONIX_MODEL_ID,
  "byte-plus-seedance-2": "seedance-2",
  "byte-plus-seedance-2-fast": "seedance-2-fast",
  "byte-plus-seedream-4-5": "seedream-4-5",
  "byte-plus-seedream-5-lite": "seedream-5-lite",
  "grok-imagine-1-5": "grok-imagine",
  "wan2-7": "wan-2-7",
  pixverseV6: "pixverse-v6",
  "gemini-omni-flash": "gemini-omni-flash",
  "kling-3-omni": "kling-3-omni",
  "nano-banana-2-lite": "nano-banana-2-lite",
  "nano-banana-2": "nano-banana-2",
  "nano-banana-pro": "nano-banana-pro",
  "gpt-image-2": "gpt-image-2",
};

function catalogIdFor(mcpId: string, kind: ModelKind): string {
  if (mcpId === "kling-3-omni" && kind === "image") return "kling-3-omni-image";
  return MCP_TO_CATALOG_ID[mcpId] || mcpId;
}

function displayNameFor(mcpId: string, fallback: string, kind: ModelKind): string {
  if (mcpId === "byte-plus-seedance-2-mini") return "Veronix";
  if (mcpId === "kling-3-omni" && kind === "image") return "Kling 3.0 Omni";
  if (mcpId === "kling-3-omni") return "Kling 3.0 Omni";
  return fallback;
}

function buildCatalogFromOpenArt(models: OpenArtModelRow[]): SyncedCatalogFile {
  const image: CatalogModel[] = [];
  const video: CatalogModel[] = [];

  // Convenience Auto image entry first.
  image.push({
    id: "auto",
    name: "Auto",
    kind: "image",
    mcpId: "nano-banana-2-lite",
    modes: ["text2image", "image2image"],
    badge: "Auto",
    available: true,
  });

  for (const row of models) {
    const mcpId = row.id;
    const imageModes = (row.modes?.image ?? []).map((m) => m.mode).filter(Boolean);
    const videoModes = (row.modes?.video ?? []).map((m) => m.mode).filter(Boolean);
    const name = row.displayName || mcpId;

    if (imageModes.length) {
      image.push({
        id: catalogIdFor(mcpId, "image"),
        name: displayNameFor(mcpId, name, "image"),
        kind: "image",
        mcpId,
        modes: imageModes,
        available: true,
        tagline: row.description?.slice(0, 120),
      });
    }

    if (videoModes.length) {
      const isVeronix = mcpId === "byte-plus-seedance-2-mini";
      const fallback = VIDEO_DURATION_FALLBACKS[mcpId];
      video.push({
        id: catalogIdFor(mcpId, "video"),
        name: displayNameFor(mcpId, name, "video"),
        kind: "video",
        mcpId,
        modes: videoModes,
        available: true,
        badge: isVeronix ? "حصري" : undefined,
        tagline: isVeronix
          ? "موديل فيديو حصري — أول فيديو 6 ثوانٍ مجاني (480p)"
          : row.description?.slice(0, 120),
        durationMin: fallback?.min,
        durationMax: fallback?.max,
        durationDefault: fallback?.default,
      });
    }
  }

  // Veronix / Seedance Mini first in video list.
  video.sort((a, b) => {
    if (a.id === VERONIX_MODEL_ID) return -1;
    if (b.id === VERONIX_MODEL_ID) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    updatedAt: new Date().toISOString(),
    source: "openart_model_list",
    image,
    video,
  };
}

type DurationBounds = { min: number; max: number; default: number };

function resolveSchemaNode(
  node: unknown,
  defs: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> | null {
  if (!node || typeof node !== "object" || depth > 8) return null;
  const obj = node as Record<string, unknown>;
  if (typeof obj.$ref === "string") {
    const key = obj.$ref.replace(/^#\/\$defs\//, "");
    return resolveSchemaNode(defs[key], defs, depth + 1);
  }
  return obj;
}

/** Pull duration min/max/default from openart_model_form_get jsonSchema. */
export function extractDurationBounds(
  payload: Record<string, unknown>,
): DurationBounds | null {
  const schema = payload.jsonSchema as Record<string, unknown> | undefined;
  if (!schema) return null;
  const defs = (schema.$defs as Record<string, unknown>) || {};
  const topDefaults = (payload.defaults as Record<string, unknown>) || {};

  const visit = (node: unknown, depth = 0): DurationBounds | null => {
    if (!node || typeof node !== "object" || depth > 12) return null;
    const obj = resolveSchemaNode(node, defs) || (node as Record<string, unknown>);
    const props = obj.properties as Record<string, unknown> | undefined;
    if (props?.duration) {
      const durationSchema = resolveSchemaNode(props.duration, defs);
      if (
        durationSchema &&
        typeof durationSchema.minimum === "number" &&
        typeof durationSchema.maximum === "number"
      ) {
        const def =
          typeof durationSchema.default === "number"
            ? durationSchema.default
            : typeof topDefaults.duration === "number"
              ? topDefaults.duration
              : 5;
        return {
          min: durationSchema.minimum,
          max: durationSchema.maximum,
          default: def,
        };
      }
    }
    for (const key of ["allOf", "oneOf", "anyOf"] as const) {
      const arr = obj[key];
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        const found = visit(item, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };

  return visit(schema);
}

async function enrichVideoDurations(catalog: SyncedCatalogFile): Promise<void> {
  for (const model of catalog.video) {
    if (!model.mcpId || !model.modes?.length) continue;
    const mode = model.modes.includes("text2video")
      ? "text2video"
      : model.modes[0];
    try {
      const result = await callOpenArtTool("openart_model_form_get", {
        model: model.mcpId,
        mode,
      });
      const payload = parseToolPayload(result);
      if (result.isError) continue;
      const bounds = extractDurationBounds(payload);
      if (!bounds) continue;
      model.durationMin = bounds.min;
      model.durationMax = bounds.max;
      model.durationDefault = bounds.default;
    } catch {
      // keep fallback bounds
    }
  }
}

function parseCostItems(payload: Record<string, unknown>): CostCacheItem[] {
  const raw = (payload.items as Array<Record<string, unknown>> | undefined) ?? [];
  const items: CostCacheItem[] = [];
  for (const row of raw) {
    const model = String(row.model || "");
    const mode = String(row.mode || "");
    const totalCredits = Number(row.totalCredits ?? row.unitCredits ?? 0);
    if (!model || !mode || !Number.isFinite(totalCredits) || totalCredits <= 0) continue;
    items.push({
      model,
      mode,
      totalCredits,
      unitCredits: Number(row.unitCredits ?? totalCredits),
      config: (row.config as Record<string, unknown>) || {},
      mediaType: typeof row.mediaType === "string" ? row.mediaType : undefined,
    });
  }
  return items;
}

/** Pull every OpenArt MCP model + default costs; persist for Create UI. */
export async function syncOpenArtCatalogAndCosts(): Promise<{
  catalog: SyncedCatalogFile;
  costItems: number;
  live: boolean;
}> {
  const listResult = await callOpenArtTool("openart_model_list", {});
  const listPayload = parseToolPayload(listResult);
  if (listResult.isError) {
    throw new OpenArtConfigError(
      String(listPayload.error || listPayload.rawText || "model list failed"),
      { needsAuth: true },
    );
  }

  const models = (listPayload.models as OpenArtModelRow[] | undefined) ?? [];
  if (!models.length) {
    throw new Error("OpenArt returned an empty model list");
  }

  const catalog = buildCatalogFromOpenArt(models);
  await enrichVideoDurations(catalog);
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CATALOG_FILE, JSON.stringify(catalog, null, 2), "utf8");

  const costResult = await callOpenArtTool("openart_model_cost", {});
  const costPayload = parseToolPayload(costResult);
  let costItems = parseCostItems(costPayload);

  // Targeted enrich for Create UI defaults (keeps Generate button ×1.8 accurate).
  const enrichTargets: Array<{ model: string; mode: string; params: Record<string, unknown> }> = [
    // Veronix free default
    {
      model: "byte-plus-seedance-2-mini",
      mode: "text2video",
      params: {
        videoCount: 1,
        duration: 4,
        resolution: "480p",
        aspectRatio: "16:9",
        generateAudio: false,
      },
    },
    {
      model: "byte-plus-seedance-2-mini",
      mode: "text2video",
      params: {
        videoCount: 1,
        duration: 6,
        resolution: "480p",
        aspectRatio: "16:9",
        generateAudio: false,
      },
    },
    {
      model: "byte-plus-seedance-2",
      mode: "text2video",
      params: {
        videoCount: 1,
        duration: 5,
        resolution: "720p",
        aspectRatio: "16:9",
        generateAudio: false,
      },
    },
    {
      model: "pixverseV6",
      mode: "text2video",
      params: {
        videoCount: 1,
        duration: 5,
        resolution: "720p",
        aspectRatio: "16:9",
        generateAudio: false,
      },
    },
    {
      model: "gpt-image-2",
      mode: "text2image",
      params: {
        imageCount: 1,
        aspectRatio: "1:1",
        resolutionTier: "2k",
        quality: "medium",
      },
    },
  ];

  for (const target of enrichTargets) {
    try {
      const one = await callOpenArtTool("openart_model_cost", target);
      const payload = parseToolPayload(one);
      if (one.isError) continue;
      costItems = [...costItems, ...parseCostItems(payload)];
    } catch {
      // keep going
    }
  }

  // Dedupe by model|mode|config signature.
  const map = new Map<string, CostCacheItem>();
  for (const item of costItems) {
    const key = [
      item.model,
      item.mode,
      String(item.config.resolution ?? item.config.resolutionTier ?? ""),
      String(item.config.duration ?? ""),
      String(item.config.generateAudio ?? item.config.generateSound ?? ""),
      String(item.config.aspectRatio ?? ""),
      String(item.config.quality ?? ""),
    ].join("|");
    map.set(key, item);
  }
  const unique = [...map.values()];
  await saveCostCache(unique);

  return { catalog, costItems: unique.length, live: true };
}

export async function loadSyncedCatalog(): Promise<SyncedCatalogFile | null> {
  try {
    const raw = await readFile(CATALOG_FILE, "utf8");
    const parsed = JSON.parse(raw) as SyncedCatalogFile;
    if (Array.isArray(parsed.image) && Array.isArray(parsed.video)) return parsed;
  } catch {
    // ignore
  }
  return null;
}

/** Return live synced catalog if present; otherwise sync now (best effort). */
export async function getLiveCatalog(options?: {
  forceSync?: boolean;
}): Promise<SyncedCatalogFile & { syncedNow: boolean; live: boolean }> {
  if (!options?.forceSync) {
    const existing = await loadSyncedCatalog();
    if (existing?.image.length && existing.video.length) {
      const ageMs = Date.now() - Date.parse(existing.updatedAt || "");
      if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 30 * 60 * 1000) {
        return { ...existing, syncedNow: false, live: true };
      }
    }
  }

  try {
    const { catalog } = await syncOpenArtCatalogAndCosts();
    return { ...catalog, syncedNow: true, live: true };
  } catch {
    const existing = await loadSyncedCatalog();
    if (existing) return { ...existing, syncedNow: false, live: false };
    throw new Error("تعذر مزامنة موديلات OpenArt");
  }
}
