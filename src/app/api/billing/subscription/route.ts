import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { getPlan, isPaidPlan, normalizePlanId } from "@/lib/plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const planId = normalizePlanId(user.planId);
    const plan = getPlan(planId);

    let subscription: {
      status: string;
      currentPeriodEnd: number | null;
      cancelAtPeriodEnd: boolean;
    } | null = null;

    if (user.stripeSubscriptionId && (await isStripeConfigured())) {
      try {
        const stripe = await getStripe();
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const item = sub.items.data[0];
        subscription = {
          status: sub.status,
          currentPeriodEnd: item?.current_period_end ?? null,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        };
      } catch {
        // Subscription missing in Stripe — local plan still shown.
      }
    }

    return NextResponse.json({
      planId,
      planName: plan?.name || planId,
      planPriceUsd: plan?.priceUsd ?? 0,
      monthlyCredits: plan?.monthlyCredits ?? 0,
      credits: user.credits,
      isPaid: isPaidPlan(planId),
      hasStripeCustomer: Boolean(user.stripeCustomerId?.trim()),
      subscription,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load subscription" },
      { status: 422 },
    );
  }
}
