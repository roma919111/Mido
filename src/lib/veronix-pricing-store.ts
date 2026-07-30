import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_VERONIX_PRICING,
  getActivePricingConfig,
  normalizePricingConfig,
  setActivePricingConfig,
  type VeronixPricingConfig,
} from "@/lib/byteplus-pricing";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "veronix-pricing.json");

type Stored = VeronixPricingConfig & {
  updatedAt?: string;
};

let loaded = false;
let loadPromise: Promise<VeronixPricingConfig> | null = null;

async function readStored(): Promise<VeronixPricingConfig> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return normalizePricingConfig(parsed);
  } catch {
    return { ...DEFAULT_VERONIX_PRICING };
  }
}

/** Load pack pricing from disk into the runtime active config. */
export async function ensurePricingConfigLoaded(): Promise<VeronixPricingConfig> {
  if (loaded) return getActivePricingConfig();
  if (!loadPromise) {
    loadPromise = (async () => {
      const cfg = await readStored();
      loaded = true;
      return setActivePricingConfig(cfg);
    })().finally(() => {
      loadPromise = null;
    });
  }
  return loadPromise;
}

export async function loadPricingConfig(): Promise<VeronixPricingConfig> {
  const cfg = await readStored();
  loaded = true;
  return setActivePricingConfig(cfg);
}

export async function savePricingConfig(
  input: Partial<VeronixPricingConfig>,
): Promise<VeronixPricingConfig> {
  const cfg = normalizePricingConfig(input);
  await mkdir(DATA_DIR, { recursive: true });
  const payload: Stored = {
    ...cfg,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(FILE, JSON.stringify(payload, null, 2), "utf8");
  loaded = true;
  return setActivePricingConfig(cfg);
}
