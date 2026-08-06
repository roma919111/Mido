import type { CatalogModel } from "@/lib/model-catalog";
import { VIDEO_MODELS } from "@/lib/model-catalog";
import { VERONIX_MODEL_ID } from "@/lib/free-trial";
import { PIXVERSE_MODEL_ID } from "@/lib/pixverse-constants";
import { GEMINI_OMNI_FLASH_MODEL_ID } from "@/lib/gemini-constants";
import { MINIMAX_H3_MODEL_ID } from "@/lib/minimax-constants";

export type ModelProviderKey =
  | "vyronix"
  | "seedance"
  | "pixverse"
  | "minimax"
  | "kling"
  | "gemini"
  | "grok"
  | "wan"
  | "openai"
  | "flux"
  | "sora"
  | "veo"
  | "luma"
  | "recraft"
  | "qwen"
  | "reve"
  | "generic";

const PROVIDER_LOGOS: Record<ModelProviderKey, string> = {
  vyronix: "/models/vyronix.svg",
  seedance: "/models/seedance.svg",
  pixverse: "/models/pixverse.png",
  minimax: "/icons/minimax.svg",
  kling: "/models/kling.svg",
  gemini: "/models/gemini.svg",
  grok: "/models/grok.svg",
  wan: "/models/wan.svg",
  openai: "/models/openai.svg",
  flux: "/models/flux.svg",
  sora: "/models/sora.svg",
  veo: "/models/veo.svg",
  luma: "/models/luma.svg",
  recraft: "/models/recraft.svg",
  qwen: "/models/qwen.svg",
  reve: "/models/reve.svg",
  generic: "/models/generic.svg",
};

/** Resolve a stable provider key for logo lookup. */
export function modelProviderKey(
  model: Pick<CatalogModel, "id" | "name" | "mcpId">,
): ModelProviderKey {
  const hay = `${model.id} ${model.mcpId || ""} ${model.name}`.toLowerCase();

  if (
    hay.includes("vyronix") ||
    hay.includes("veronix") ||
    model.id === "seedance-2-mini" ||
    model.id === "vyronix-image"
  ) {
    return "vyronix";
  }
  if (hay.includes("pixverse")) return "pixverse";
  if (hay.includes("minimax")) return "minimax";
  if (hay.includes("kling")) return "kling";
  if (hay.includes("gemini") || hay.includes("nano-banana")) return "gemini";
  if (hay.includes("grok")) return "grok";
  if (hay.includes("wan")) return "wan";
  if (hay.includes("seedance") || hay.includes("seedream") || hay.includes("byte-plus")) {
    return "seedance";
  }
  if (hay.includes("gpt") || hay.includes("sora") || hay.includes("openai")) return "openai";
  if (hay.includes("flux") || hay.includes("juggernaut") || hay.includes("sdxl")) return "flux";
  if (hay.includes("veo")) return "veo";
  if (hay.includes("ltx")) return "luma";
  if (hay.includes("recraft")) return "recraft";
  if (hay.includes("qwen")) return "qwen";
  if (hay.includes("reve")) return "reve";

  return "generic";
}

export function modelLogoSrc(
  model: Pick<CatalogModel, "id" | "name" | "mcpId">,
): string {
  return PROVIDER_LOGOS[modelProviderKey(model)];
}

const ASSET_MODEL_LABELS: Record<string, string> = {
  [VERONIX_MODEL_ID]: "VYRONIX",
  [PIXVERSE_MODEL_ID]: "PixVerse V6",
  [GEMINI_OMNI_FLASH_MODEL_ID]: "Gemini Omni Flash",
  [MINIMAX_H3_MODEL_ID]: "MiniMax H3",
  "vyronix-image": "VYRONIX",
};

/** Customer-facing model name on Assets tiles / feed meta. */
export function assetModelLabel(
  modelId?: string | null,
  historyId?: string | null,
): string | null {
  const id = String(modelId || "").trim();
  if (id && ASSET_MODEL_LABELS[id]) return ASSET_MODEL_LABELS[id];

  const hid = String(historyId || "").trim();
  if (hid.startsWith("bp:")) return "VYRONIX";
  if (hid.startsWith("pv:")) return "PixVerse V6";
  if (hid.startsWith("gm:")) return "Gemini Omni Flash";
  if (hid.startsWith("mm:")) return "MiniMax H3";

  if (id) {
    const fromCatalog = VIDEO_MODELS.find((m) => m.id === id)?.name;
    if (fromCatalog) return fromCatalog;
    return id;
  }
  return null;
}
