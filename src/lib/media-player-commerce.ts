export const MEDIA_PLAYER_PRICE_SAR = 40;
export const MEDIA_PLAYER_CURRENCY = "sar";
export const MEDIA_PLAYER_PRODUCT_NAME = "Max Media Player";
export const MEDIA_PLAYER_PRODUCT_NAME_AR = "ماكس ميديا بلاير";
export const MEDIA_PLAYER_ACTIVATE_PATH = "/max";
export const MEDIA_PLAYER_LANDING_PATH = "/maxmediaplayer";
/** Europe replica — movies/series proxy here so bytes do not detour via Singapore. */
export const PLAYER_MEDIA_ORIGIN = "https://maxmedia-production.up.railway.app";
export const MEDIA_PLAYER_LANDING_URL = `https://vyronix.app${MEDIA_PLAYER_LANDING_PATH}`;
export const MEDIA_PLAYER_ACTIVATE_URL = `https://vyronix.app${MEDIA_PLAYER_ACTIVATE_PATH}`;
export const MEDIA_PLAYER_SOURCE_STORAGE_KEY = "maxvr.player.src";

/** @deprecated use MEDIA_PLAYER_PRICE_SAR */
export const MEDIA_PLAYER_PRICE_USD = MEDIA_PLAYER_PRICE_SAR;

export function formatMediaPlayerPrice(): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
    numberingSystem: "latn",
  }).format(MEDIA_PLAYER_PRICE_SAR);
}

export function sanitizeTrafficSource(raw?: string | null): string {
  return (raw ?? "")
    .trim()
    .slice(0, 80)
    .replace(/[^\p{L}\p{N}._-]/gu, "");
}
