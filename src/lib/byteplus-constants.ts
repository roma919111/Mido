/** Catalog + Ark model ids for BytePlus Seedance variants. */

import { VERONIX_MODEL_ID } from "@/lib/free-trial";

export const SEEDANCE_2_MODEL_ID = "seedance-2";

export const SEEDANCE_MINI_ARK_MODEL = "dreamina-seedance-2-0-mini-260615";
export const SEEDANCE_2_ARK_MODEL = "dreamina-seedance-2-0-260128";

export function getBytePlusArkModelId(catalogModelId?: string | null): string {
  if (catalogModelId === SEEDANCE_2_MODEL_ID) {
    return (
      process.env.BYTEPLUS_SEEDANCE_2_MODEL?.trim() ||
      process.env.BYTEPLUS_SEEDANCE_2_ARK_MODEL?.trim() ||
      SEEDANCE_2_ARK_MODEL
    );
  }
  if (catalogModelId === VERONIX_MODEL_ID) {
    return (
      process.env.BYTEPLUS_VIDEO_MODEL?.trim() ||
      process.env.ARK_VIDEO_MODEL?.trim() ||
      SEEDANCE_MINI_ARK_MODEL
    );
  }
  return (
    process.env.BYTEPLUS_VIDEO_MODEL?.trim() ||
    process.env.ARK_VIDEO_MODEL?.trim() ||
    SEEDANCE_MINI_ARK_MODEL
  );
}

export function getBytePlusApiKeyForModel(
  catalogModelId?: string | null,
): string | undefined {
  if (catalogModelId === SEEDANCE_2_MODEL_ID) {
    const dedicated = process.env.BYTEPLUS_SEEDANCE_2_API_KEY?.trim();
    if (dedicated) return dedicated;
  }
  return (
    process.env.BYTEPLUS_API_KEY?.trim() ||
    process.env.ARK_API_KEY?.trim() ||
    undefined
  );
}

export function isSeedance2Configured(): boolean {
  return Boolean(getBytePlusApiKeyForModel(SEEDANCE_2_MODEL_ID));
}

export function isBytePlusModelConfigured(catalogModelId?: string | null): boolean {
  return Boolean(getBytePlusApiKeyForModel(catalogModelId));
}
