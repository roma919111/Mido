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
    name: "شحن 2,000",
    priceUsd: 4,
    credits: 2000,
    description: "حزمة شحن إضافية سريعة.",
  },
  {
    id: "topup-5000",
    name: "شحن 5,000",
    priceUsd: 8,
    credits: 5000,
    description: "حزمة شحن متوسطة.",
  },
  {
    id: "topup-10000",
    name: "شحن 10,000",
    priceUsd: 14,
    credits: 10000,
    description: "حزمة شحن كبيرة.",
  },
];

export function getPlan(id: string | null | undefined): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

export function getTopUp(id: string | null | undefined): TopUpPack | undefined {
  return TOPUP_PACKS.find((p) => p.id === id);
}
