export type PlanId = "mini" | "pro";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  priceUsd: number;
  monthlyCredits: number;
  description: string;
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
    id: "mini",
    name: "الأولى",
    priceUsd: 10,
    monthlyCredits: 7500,
    description: "باقة شهرية مناسبة للبداية والاستخدام الخفيف.",
  },
  {
    id: "pro",
    name: "الثانية",
    priceUsd: 15,
    monthlyCredits: 11500,
    description: "رصيد أعلى لصنّاع المحتوى المنتظمين.",
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

/** Plan rank for upgrade-only rules (higher = better). */
export function getPlanRank(id: string | null | undefined): number {
  if (!id) return -1;
  const idx = SUBSCRIPTION_PLANS.findIndex((p) => p.id === id);
  return idx;
}

export function isHighestPlan(id: string | null | undefined): boolean {
  if (!id) return false;
  return getPlanRank(id) === SUBSCRIPTION_PLANS.length - 1;
}

/** True only when the user already has a plan and target is strictly higher. */
export function canUpgradeToPlan(
  currentPlanId: string | null | undefined,
  targetPlanId: string,
): boolean {
  const current = getPlanRank(currentPlanId);
  const target = getPlanRank(targetPlanId);
  if (current < 0 || target < 0) return false;
  return target > current;
}

/** New users may pick any plan; existing users may only move strictly upward. */
export function canPurchasePlan(
  currentPlanId: string | null | undefined,
  targetPlanId: string,
): boolean {
  const current = getPlanRank(currentPlanId);
  const target = getPlanRank(targetPlanId);
  if (target < 0) return false;
  if (current < 0) return true;
  return target > current;
}
