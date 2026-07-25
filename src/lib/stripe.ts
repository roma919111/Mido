import Stripe from "stripe";
import { getPlan, type PlanId } from "@/lib/plans";

let stripeSingleton: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

export function getAppBaseUrl(): string {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    "http://localhost:3000"
  );
}

export function getStripePriceId(planId: PlanId): string | undefined {
  if (planId === "mini") return process.env.STRIPE_PRICE_MINI?.trim();
  if (planId === "standard") return process.env.STRIPE_PRICE_STANDARD?.trim();
  if (planId === "pro") return process.env.STRIPE_PRICE_PRO?.trim();
  return undefined;
}

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
  planId: PlanId;
  stripeCustomerId?: string;
}): Promise<{ url: string; sessionId: string }> {
  const plan = getPlan(input.planId);
  if (!plan) throw new Error("Unknown plan");

  const stripe = getStripe();
  const base = getAppBaseUrl();
  const priceId = getStripePriceId(input.planId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.stripeCustomerId || undefined,
    customer_email: input.stripeCustomerId ? undefined : input.email,
    line_items: priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(plan.priceUsd * 100),
              recurring: { interval: "month" },
              product_data: {
                name: `Veronix.ai ${plan.name}`,
                description: `${plan.monthlyCredits} credits / month`,
              },
            },
          },
        ],
    success_url: `${base}/pricing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing?canceled=1`,
    metadata: {
      userId: input.userId,
      planId: input.planId,
      monthlyCredits: String(plan.monthlyCredits),
    },
    subscription_data: {
      metadata: {
        userId: input.userId,
        planId: input.planId,
        monthlyCredits: String(plan.monthlyCredits),
      },
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}
