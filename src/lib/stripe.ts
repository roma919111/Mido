import Stripe from "stripe";
import { getAppBaseUrl } from "@/lib/app-url";
import { getPlan, getTopUp, type PlanId } from "@/lib/plans";
import { loadStripeCredentials } from "@/lib/stripe-credentials";

export { getAppBaseUrl };

let stripeSingleton: Stripe | null = null;
let stripeKeyUsed: string | null = null;

export async function isStripeConfigured(): Promise<boolean> {
  const creds = await loadStripeCredentials();
  return Boolean(creds?.secretKey);
}

export async function getStripe(): Promise<Stripe> {
  const creds = await loadStripeCredentials();
  const key = creds?.secretKey?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeSingleton || stripeKeyUsed !== key) {
    stripeSingleton = new Stripe(key);
    stripeKeyUsed = key;
  }
  return stripeSingleton;
}

export async function getStripeWebhookSecret(): Promise<string | undefined> {
  const creds = await loadStripeCredentials();
  return creds?.webhookSecret?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined;
}

export function resetStripeClient(): void {
  stripeSingleton = null;
  stripeKeyUsed = null;
}

export function getStripePriceId(planId: PlanId): string | undefined {
  if (planId === "mini") return process.env.STRIPE_PRICE_MINI?.trim();
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

  const stripe = await getStripe();
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
      kind: "subscription",
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

export async function createTopUpCheckoutSession(input: {
  userId: string;
  email: string;
  topUpId: string;
  stripeCustomerId?: string;
}): Promise<{ url: string; sessionId: string }> {
  const pack = getTopUp(input.topUpId);
  if (!pack) throw new Error("Unknown top-up pack");

  const stripe = await getStripe();
  const base = getAppBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: input.stripeCustomerId || undefined,
    customer_email: input.stripeCustomerId ? undefined : input.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(pack.priceUsd * 100),
          product_data: {
            name: `Veronix.ai ${pack.name}`,
            description: `${pack.credits} credits top-up`,
          },
        },
      },
    ],
    success_url: `${base}/pricing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing?canceled=1`,
    metadata: {
      userId: input.userId,
      topUpId: pack.id,
      credits: String(pack.credits),
      kind: "topup",
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}
