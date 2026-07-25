export type PlanId = "mini" | "standard" | "pro";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  priceUsd: number;
  monthlyCredits: number;
  description: string;
  highlight?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "mini",
    name: "Mini",
    priceUsd: 10,
    monthlyCredits: 1200,
    description: "Starter monthly credits for light image & short video work.",
  },
  {
    id: "standard",
    name: "Standard",
    priceUsd: 12.5,
    monthlyCredits: 2000,
    description: "Balanced plan for regular creators.",
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 15,
    monthlyCredits: 3500,
    description: "Highest monthly allowance for power users.",
  },
];

export function getPlan(id: string | null | undefined): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}
