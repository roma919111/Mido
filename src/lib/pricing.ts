import type { PricingTier, SubscriptionTier } from "./types";

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    credits: 50,
    description: "Explore Studio AI and ship your first creations.",
    features: ["50 credits / month", "Standard 720p video", "Personal library", "Community explore"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 15,
    credits: 1000,
    description: "For daily creators who need speed and volume.",
    features: [
      "1,000 credits / month",
      "1080p Pro video",
      "Priority generation queue",
      "Private + public sharing",
      "Style presets unlocked",
    ],
    highlighted: true,
  },
  {
    id: "master",
    name: "Master",
    price: 35,
    credits: 3500,
    description: "Maximum throughput for studios and power users.",
    features: [
      "3,500 credits / month",
      "Highest concurrency",
      "Team-ready library tools",
      "Workflow templates",
      "Priority support",
    ],
  },
];

export function creditsForTier(tier: SubscriptionTier): number {
  return PRICING_TIERS.find((t) => t.id === tier)?.credits ?? 50;
}
