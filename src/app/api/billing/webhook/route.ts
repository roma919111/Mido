import { NextResponse } from "next/server";
import { fulfillCheckoutSession } from "@/lib/billing-fulfillment";
import { adjustCredits, findUserById, updateUser } from "@/lib/db";
import { extendMediaPlayerOrderBySubscription } from "@/lib/media-player-orders";
import { getPlan, type PlanId } from "@/lib/plans";
import { getStripe, getStripeWebhookSecret, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isStripeConfigured())) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = await getStripe();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = await getStripeWebhookSecret();
  const rawBody = await request.text();

  let event;
  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else {
      event = JSON.parse(rawBody);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook" },
      { status: 400 },
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        id?: string;
        metadata?: Record<string, string>;
        customer?: string;
        subscription?: string;
        payment_status?: string;
        status?: string;
        customer_email?: string | null;
        customer_details?: { email?: string | null } | null;
      };
      await fulfillCheckoutSession(session);
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as {
        subscription?: string | { id?: string } | null;
        subscription_details?: { metadata?: Record<string, string> };
        parent?: {
          subscription_details?: {
            metadata?: Record<string, string>;
            subscription?: string | { id?: string };
          };
        };
        lines?: { data?: Array<{ metadata?: Record<string, string> }> };
        billing_reason?: string;
      };

      const meta =
        invoice.subscription_details?.metadata ||
        invoice.parent?.subscription_details?.metadata ||
        invoice.lines?.data?.[0]?.metadata ||
        {};

      const subscriptionId =
        (typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id) ||
        (typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : invoice.parent?.subscription_details?.subscription?.id);

      // Skip the first invoice if already handled by checkout.session.completed
      if (invoice.billing_reason === "subscription_create") {
        return NextResponse.json({ received: true });
      }

      if (meta.kind === "media_player") {
        if (subscriptionId) await extendMediaPlayerOrderBySubscription(subscriptionId);
        return NextResponse.json({ received: true });
      }

      const userId = meta.userId;
      const planId = meta.planId as PlanId | undefined;
      const monthlyCredits = Number(meta.monthlyCredits || 0);
      if (userId) {
        const user = await findUserById(userId);
        if (user) {
          const plan = getPlan(planId || user.planId || undefined);
          const credits = monthlyCredits || plan?.monthlyCredits || 0;
          if (planId) await updateUser(userId, { planId });
          if (credits > 0) await adjustCredits(userId, credits);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook handler failed" },
      { status: 500 },
    );
  }
}
