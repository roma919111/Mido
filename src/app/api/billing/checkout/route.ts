import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { getPlan, type PlanId } from "@/lib/plans";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import { adjustCredits, updateUser } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const body = (await request.json()) as { planId?: PlanId };
    const planId = body.planId;
    const plan = getPlan(planId);
    if (!plan || !planId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (!isStripeConfigured()) {
      // Dev / demo activation when Stripe keys are not set yet.
      await updateUser(user.id, { planId });
      const updated = await adjustCredits(user.id, plan.monthlyCredits);
      return NextResponse.json({
        demo: true,
        message: `Stripe is not configured. Activated ${plan.name} and added ${plan.monthlyCredits} credits for testing.`,
        user: {
          id: updated.id,
          email: updated.email,
          credits: updated.credits,
          planId: updated.planId,
        },
      });
    }

    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      planId,
      stripeCustomerId: user.stripeCustomerId,
    });

    return NextResponse.json({ url: session.url, sessionId: session.sessionId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
