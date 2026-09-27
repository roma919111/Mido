/** AI Rental Studio — GPU hour rental + H3/LTX lab (vyronix.app/ai-rental-studio). */

export const AI_RENTAL_STUDIO_PATH = "/ai-rental-studio";
export const AI_RENTAL_STUDIO_NAME = "AI Rental Studio";
export const AI_RENTAL_STUDIO_NAME_AR = "ستوديو التأجير AI";

export const STUDIO_RENTAL_DURATION_HOURS = 1;
export const STUDIO_RENTAL_PRICE_USD = 15;
export const STUDIO_RENTAL_PRICING_PATH = "/pricing?feature=studio-rental";

export const STUDIO_VIDEO_VARIANT_COUNT = 1;
export const VAST_H3_ESTIMATED_COST_PER_HOUR_USD = 1.5;

export function isAiRentalStudioPath(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  return path === AI_RENTAL_STUDIO_PATH || path.startsWith(`${AI_RENTAL_STUDIO_PATH}/`);
}
