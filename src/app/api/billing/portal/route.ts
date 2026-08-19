import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getCurrentUser } from "@/lib/customer-auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const customerId = user.stripeCustomerId?.trim();
    if (!customerId) {
      return NextResponse.json(
        { error: "No billing account linked yet.", code: "no_customer" },
        { status: 409 },
      );
    }

    if (!(await isStripeConfigured())) {
      return NextResponse.json(
        { error: "Billing is not configured.", code: "stripe_required" },
        { status: 503 },
      );
    }

    const stripe = await getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppBaseUrl()}/settings?tab=billing`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a portal URL" }, { status: 422 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Portal failed" },
      { status: 422 },
    );
  }
}
