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
}

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
    monthlyCredits: 7200,
    description: "باقة شهرية مناسبة للإنتاج المنتظم.",
    features: ["١٥٠ فيديو ~", "١٢٠٠ صورة ~"],
  },
  {
    id: "pro",
    name: "الترا",
    priceUsd: 15,
    monthlyCredits: 14400,
    description: "أعلى باقة لصنّاع المحتوى بكثافة عالية.",
    features: ["٣٠٠ فيديو ~", "١٢٠٠٠ صورة ~"],
    highlight: true,
  },
];

export const TOPUP_PACKS: TopUpPack[] = [
  {
    id: "topup-2000",
    name: "شحن سريع",
    priceUsd: 4,
    credits: 2000,
    description: "دفعة سريعة لجلسة توليد واحدة أو اثنتين.",
  },
  {
    id: "topup-5000",
    name: "شحن متوازن",
    priceUsd: 8,
    credits: 5000,
    description: "الأكثر توازناً لصنّاع المحتوى الأسبوعي.",
  },
  {
    id: "topup-10000",
    name: "شحن احترافي",
    priceUsd: 14,
    credits: 10000,
    description: "رصيد كبير للإنتاج المتواصل دون انقطاع.",
  },
];

export function getPlan(id: string | null | undefined): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

export function getTopUp(id: string | null | undefined): TopUpPack | undefined {
  return TOPUP_PACKS.find((p) => p.id === id);
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

/** Switch back to free from any paid plan. */
export function canSwitchToFree(currentPlanId: string | null | undefined): boolean {
  return isPaidPlan(currentPlanId);
}

/**
 * Purchase rules:
 * - Free → paid upgrade OK
 * - Paid → higher paid upgrade OK
 * - Paid → free switch OK
 * - Same plan / downgrade between paid plans blocked
 */
export function canPurchasePlan(
  currentPlanId: string | null | undefined,
  targetPlanId: string,
): boolean {
  if (!getPlan(targetPlanId)) return false;
  const current = normalizePlanId(currentPlanId);
  if (current === targetPlanId) return false;

  if (targetPlanId === "free") {
    return canSwitchToFree(current);
  }

  if (isFreePlan(current)) {
    return isPaidPlan(targetPlanId);
  }

  return canUpgradeToPlan(current, targetPlanId);
}
