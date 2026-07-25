import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { adjustCredits, findUserById, updateUser } from "@/lib/db";
import { getPlan, getTopUp, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
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
        metadata?: Record<string, string>;
        customer?: string;
        subscription?: string;
      };
      const userId = session.metadata?.userId;
      const kind = session.metadata?.kind;
      if (userId && kind === "topup") {
        const pack = getTopUp(session.metadata?.topUpId);
        const credits = Number(session.metadata?.credits || pack?.credits || 0);
        await updateUser(userId, {
          stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
        });
        if (credits > 0) await adjustCredits(userId, credits);
      } else {
        const planId = session.metadata?.planId as PlanId | undefined;
        const monthlyCredits = Number(session.metadata?.monthlyCredits || 0);
        if (userId && planId) {
          const plan = getPlan(planId);
          const credits = monthlyCredits || plan?.monthlyCredits || 0;
          await updateUser(userId, {
            planId,
            stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
            stripeSubscriptionId:
              typeof session.subscription === "string" ? session.subscription : undefined,
          });
          if (credits > 0) await adjustCredits(userId, credits);
        }
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as {
        subscription_details?: { metadata?: Record<string, string> };
        parent?: { subscription_details?: { metadata?: Record<string, string> } };
        lines?: { data?: Array<{ metadata?: Record<string, string> }> };
        billing_reason?: string;
      };

      // Skip the first invoice if already handled by checkout.session.completed
      if (invoice.billing_reason === "subscription_create") {
        return NextResponse.json({ received: true });
      }

      const meta =
        invoice.subscription_details?.metadata ||
        invoice.parent?.subscription_details?.metadata ||
        invoice.lines?.data?.[0]?.metadata ||
        {};
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
