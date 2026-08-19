import Stripe from "stripe";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  MEDIA_PLAYER_ACTIVATE_PATH,
  MEDIA_PLAYER_LANDING_PATH,
  MEDIA_PLAYER_CURRENCY,
  MEDIA_PLAYER_PRICE_SAR,
  MEDIA_PLAYER_PRODUCT_NAME,
  MEDIA_PLAYER_PRODUCT_NAME_AR,
} from "@/lib/media-player-commerce";
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

/** Cancel a Stripe subscription immediately (used when switching to free or upgrading). */
export async function cancelStripeSubscription(
  subscriptionId: string | null | undefined,
): Promise<void> {
  const id = subscriptionId?.trim();
  if (!id) return;
  if (!(await isStripeConfigured())) return;
  const stripe = await getStripe();
  try {
    await stripe.subscriptions.cancel(id);
  } catch (error) {
    // Already canceled / missing — ignore so plan switch still succeeds.
    const message = error instanceof Error ? error.message : String(error);
    if (!/no such subscription|already canceled|resource_missing/i.test(message)) {
      throw error;
    }
  }
}

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
  planId: PlanId;
  stripeCustomerId?: string;
}): Promise<{ url: string; sessionId: string }> {
  const plan = getPlan(input.planId);
  if (!plan) throw new Error("Unknown plan");
  if (plan.id === "free" || plan.priceUsd <= 0) {
    throw new Error("Free plan does not use Stripe checkout");
  }

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
      email: input.email,
      planId: input.planId,
      monthlyCredits: String(plan.monthlyCredits),
      kind: "subscription",
    },
    subscription_data: {
      metadata: {
        userId: input.userId,
        email: input.email,
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
      email: input.email,
      topUpId: pack.id,
      credits: String(pack.credits),
      kind: "topup",
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}

export async function createMediaPlayerCheckoutSession(input: {
  source?: string;
}): Promise<{ url: string; sessionId: string }> {
  const stripe = await getStripe();
  const base = getAppBaseUrl();
  const source = input.source?.trim().slice(0, 80) || "";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    billing_address_collection: "auto",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: MEDIA_PLAYER_CURRENCY,
          unit_amount: Math.round(MEDIA_PLAYER_PRICE_SAR * 100),
          recurring: { interval: "year" },
          product_data: {
            name: MEDIA_PLAYER_PRODUCT_NAME,
            description: `اشتراك سنوي 40 ريال سعودي — مشغّل ${MEDIA_PLAYER_PRODUCT_NAME_AR}`,
          },
        },
      },
    ],
    success_url: `${base}${MEDIA_PLAYER_ACTIVATE_PATH}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}${MEDIA_PLAYER_LANDING_PATH}?canceled=1`,
    metadata: {
      kind: "media_player",
      source,
    },
    subscription_data: {
      metadata: {
        kind: "media_player",
        source,
      },
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}
