import { NextResponse } from "next/server";
import { fulfillCheckoutSession } from "@/lib/billing-fulfillment";
import { checkoutAnalyticsFromSession } from "@/lib/checkout-analytics";
import { getCurrentUser } from "@/lib/customer-auth";
import { publicUser } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Reclaim a paid Checkout session when the success redirect returns
 * (covers cases where the Stripe webhook could not reach the tunnel).
 */
export async function POST(request: Request) {
  if (!(await isStripeConfigured())) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const customer = await getCurrentUser();
  if (!customer) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as { sessionId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metaUserId = session.metadata?.userId;
    const metaEmail = (session.metadata?.email || session.customer_details?.email || "")
      .trim()
      .toLowerCase();
    const ownsSession =
      !metaUserId ||
      metaUserId === customer.id ||
      (metaEmail && metaEmail === customer.email.toLowerCase());
    if (!ownsSession) {
      return NextResponse.json({ error: "Session does not belong to this account" }, { status: 403 });
    }

    const result = await fulfillCheckoutSession({
      id: session.id,
      metadata: {
        ...(session.metadata || {}),
        userId: customer.id,
        email: customer.email,
      },
      customer: typeof session.customer === "string" ? session.customer : null,
      subscription:
        typeof session.subscription === "string" ? session.subscription : null,
      payment_status: session.payment_status,
      status: session.status,
      customer_email: session.customer_details?.email || customer.email,
      customer_details: session.customer_details,
    });

    const user = await getCurrentUser();
    const analytics = checkoutAnalyticsFromSession(session);
    return NextResponse.json({
      ok: true,
      ...result,
      user: user ? publicUser(user) : null,
      analytics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Confirm failed" },
      { status: 500 },
    );
  }
}
