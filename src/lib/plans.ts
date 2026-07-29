import {
  quoteVeronixImageCredits,
  quoteVeronixVideoCredits,
} from "@/lib/byteplus-pricing";

export type PlanId = "free" | "mini" | "pro";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  priceUsd: number;
  monthlyCredits: number;
  description: string;
  /** Bullet perks shown under the plan (checkmarks). */
  features: string[];
  highlight?: boolean;
}

export interface TopUpPack {
  id: string;
  name: string;
  priceUsd: number;
  credits: number;
  description: string;
  /** Bullet perks shown under the pack (checkmarks). */
  features: string[];
}

/** ~4s · 480p video debit — used for marketing “فيديو” counts. */
const VIDEO_CREDITS_4S_480P = quoteVeronixVideoCredits({
  duration: 4,
  resolution: "480p",
});
const IMAGE_CREDITS = quoteVeronixImageCredits(1);

function toArabicIndic(n: number): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
}

function yieldFeatures(credits: number): string[] {
  const images = Math.round(credits / IMAGE_CREDITS);
  const videos = Math.round(credits / VIDEO_CREDITS_4S_480P);
  return [`${toArabicIndic(images)} صورة`, `${toArabicIndic(videos)} فيديو`];
}

/**
 * Credits sized so balances feel large (1 credit ≈ $0.0001 sell).
 * Feature counts assume 4s · 480p video and images at +55% markup.
 */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "الأساسية",
    priceUsd: 0,
    monthlyCredits: 0,
    description: "ابدأ مجاناً، ثم رقِّ لباقة مدفوعة للتوليد المستمر وشحن الرصيد.",
    features: ["فيديو واحد مجاني", "صورة واحدة مجانية"],
  },
  {
    id: "mini",
    name: "برو",
    priceUsd: 10,
    monthlyCredits: 150_000,
    description: "باقة شهرية مناسبة للإنتاج المنتظم — وضوح 480p و720p.",
    features: yieldFeatures(150_000),
  },
  {
    id: "pro",
    name: "الترا",
    priceUsd: 15,
    monthlyCredits: 260_000,
    description: "أعلى باقة لصنّاع المحتوى بكثافة عالية — وضوح 480p و720p.",
    features: yieldFeatures(260_000),
    highlight: true,
  },
];

/** Three top-up packs: $4 / $8 / $14 (subscription required). */
export const TOPUP_PACKS: TopUpPack[] = [
  {
    id: "topup-4",
    name: "شحن $4",
    priceUsd: 4,
    credits: 35_000,
    description: "دفعة سريعة لجلسة توليد قصيرة.",
    features: yieldFeatures(35_000),
  },
  {
    id: "topup-8",
    name: "شحن $8",
    priceUsd: 8,
    credits: 75_000,
    description: "الأكثر توازناً لصنّاع المحتوى الأسبوعي.",
    features: yieldFeatures(75_000),
  },
  {
    id: "topup-14",
    name: "شحن $14",
    priceUsd: 14,
    credits: 140_000,
    description: "رصيد كبير للإنتاج المتواصل دون انقطاع.",
    features: yieldFeatures(140_000),
  },
];

/** Legacy checkout metadata ids → current packs. */
const TOPUP_ID_ALIASES: Record<string, string> = {
  "topup-2000": "topup-4",
  "topup-5000": "topup-8",
  "topup-10000": "topup-14",
};

export function getPlan(id: string | null | undefined): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

export function getTopUp(id: string | null | undefined): TopUpPack | undefined {
  if (!id) return undefined;
  const resolved = TOPUP_ID_ALIASES[id] || id;
  return TOPUP_PACKS.find((p) => p.id === resolved);
}

/** Treat null/unknown as free for product rules. */
export function normalizePlanId(id: string | null | undefined): PlanId {
  if (id === "mini" || id === "pro" || id === "free") return id;
  return "free";
}

export function isFreePlan(id: string | null | undefined): boolean {
  return normalizePlanId(id) === "free";
}

export function isPaidPlan(id: string | null | undefined): boolean {
  const plan = normalizePlanId(id);
  return plan === "mini" || plan === "pro";
}

/** Top-ups only after a paid subscription. */
export function canTopUp(id: string | null | undefined): boolean {
  return isPaidPlan(id);
}

/** Plan rank for upgrade rules (higher = better). */
export function getPlanRank(id: string | null | undefined): number {
  const normalized = normalizePlanId(id);
  return SUBSCRIPTION_PLANS.findIndex((p) => p.id === normalized);
}

export function isHighestPlan(id: string | null | undefined): boolean {
  return normalizePlanId(id) === "pro";
}

/** True only when moving to a strictly higher plan (includes free → paid). */
export function canUpgradeToPlan(
  currentPlanId: string | null | undefined,
  targetPlanId: string,
): boolean {
  const current = getPlanRank(currentPlanId);
  const target = getPlanRank(targetPlanId);
  if (target < 0) return false;
  return target > current;
}

/** True when moving to a strictly lower paid/free plan. */
export function canDowngradeToPlan(
  currentPlanId: string | null | undefined,
  targetPlanId: string,
): boolean {
  const current = getPlanRank(currentPlanId);
  const target = getPlanRank(targetPlanId);
  if (current < 0 || target < 0) return false;
  return target < current;
}

/** Switch back to free from any paid plan. */
export function canSwitchToFree(currentPlanId: string | null | undefined): boolean {
  return isPaidPlan(currentPlanId);
}

/**
 * Purchase / switch rules:
 * - Any plan → any other plan is allowed (upgrade or downgrade)
 * - Same plan blocked
 */
export function canPurchasePlan(
  currentPlanId: string | null | undefined,
  targetPlanId: string,
): boolean {
  if (!getPlan(targetPlanId)) return false;
  const current = normalizePlanId(currentPlanId);
  if (current === targetPlanId) return false;
  return true;
}
