import { callOpenArtTool, parseToolPayload } from "@/lib/openart-mcp";
import { getCatalogModel, resolveMcpModel } from "@/lib/model-catalog";

export interface QuoteInput {
  modelId: string;
  media: "image" | "video";
  mode: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  imageCount?: number;
  videoCount?: number;
  generateAudio?: boolean;
}

export interface QuoteResult {
  modelId: string;
  mcpModel: string;
  mode: string;
  totalCredits: number;
  unitCredits: number;
  available: boolean;
  config: Record<string, unknown>;
  pricingNote?: string;
  source: "openart" | "estimate";
}

function fallbackEstimate(input: QuoteInput): number {
  if (input.media === "image") return 15;
  const duration = input.duration ?? 5;
  const res = (input.resolution || "720p").toLowerCase();
  const base = res.includes("1080") || res.includes("1k") ? 150 : 70;
  return Math.round(base * (duration / 5));
}

function resolveMode(
  catalog: ReturnType<typeof getCatalogModel>,
  input: QuoteInput,
): string {
  const requested =
    input.mode || (input.media === "image" ? "text2image" : "text2video");
  const supported = catalog?.modes ?? [];
  if (!supported.length) return requested;
  if (supported.includes(requested)) return requested;
  // Fall back to a supported mode for this model (e.g. Grok Imagine = image2video only)
  if (input.media === "video") {
    return (
      supported.find((m) => m.includes("video")) ||
      supported[0] ||
      requested
    );
  }
  return supported.find((m) => m.includes("image")) || supported[0] || requested;
}

export async function quoteOpenArtCredits(input: QuoteInput): Promise<QuoteResult> {
  const catalog = getCatalogModel(input.modelId);
  const mcpModel = catalog ? resolveMcpModel(catalog) : input.modelId;
  const available = Boolean(catalog?.available && catalog.mcpId);

  const mode = resolveMode(catalog, input);

  const params: Record<string, unknown> =
    input.media === "image"
      ? {
          imageCount: input.imageCount ?? 1,
          aspectRatio: input.aspectRatio ?? "1:1",
        }
      : {
          videoCount: input.videoCount ?? 1,
          duration: input.duration ?? 5,
          resolution: input.resolution ?? "720p",
          aspectRatio: input.aspectRatio ?? "16:9",
          generateAudio: Boolean(input.generateAudio),
        };

  if (!available) {
    const totalCredits = fallbackEstimate(input);
    return {
      modelId: input.modelId,
      mcpModel,
      mode,
      totalCredits,
      unitCredits: totalCredits,
      available: false,
      config: params,
      source: "estimate",
    };
  }

  try {
    const result = await callOpenArtTool("openart_model_cost", {
      model: mcpModel,
      mode,
      params,
    });
    const payload = parseToolPayload(result);
    if (result.isError) {
      throw new Error(String(payload.error || payload.rawText || "Cost lookup failed"));
    }

    const items = (payload.items as Array<Record<string, unknown>> | undefined) ?? [];
    const first = items[0] ?? payload;
    const totalCredits = Number(first.totalCredits ?? first.unitCredits ?? 0);
    if (!Number.isFinite(totalCredits) || totalCredits <= 0) {
      throw new Error("Invalid credit quote from OpenArt");
    }

    return {
      modelId: input.modelId,
      mcpModel,
      mode,
      totalCredits,
      unitCredits: Number(first.unitCredits ?? totalCredits),
      available: true,
      config: (first.config as Record<string, unknown>) ?? params,
      pricingNote: typeof payload.pricingNote === "string" ? payload.pricingNote : undefined,
      source: "openart",
    };
  } catch (error) {
    // Prefer failing closed for live models so the Generate button never shows a fake price.
    throw new Error(
      error instanceof Error
        ? `تعذر مزامنة تكلفة Veronix للموديل ${catalog?.name || mcpModel}: ${error.message}`
        : `تعذر مزامنة تكلفة Veronix للموديل ${catalog?.name || mcpModel}`,
    );
  }
}

export async function quoteMultipleModels(
  modelIds: string[],
  base: Omit<QuoteInput, "modelId">,
): Promise<{ quotes: QuoteResult[]; totalCredits: number }> {
  const unique = [...new Set(modelIds)].slice(0, 4);
  const quotes: QuoteResult[] = [];
  for (const modelId of unique) {
    quotes.push(await quoteOpenArtCredits({ ...base, modelId }));
  }
  const totalCredits = quotes.reduce((sum, q) => sum + q.totalCredits, 0);
  return { quotes, totalCredits };
}
