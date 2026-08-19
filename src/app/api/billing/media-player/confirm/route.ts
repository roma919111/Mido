import { NextResponse } from "next/server";
import { fulfillCheckoutSession } from "@/lib/billing-fulfillment";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

/** Guest reclaim after Stripe redirect — media player checkout only. */
export async function POST(request: Request) {
  if (!(await isStripeConfigured())) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
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
    if (session.metadata?.kind !== "media_player") {
      return NextResponse.json({ error: "Not a media player session" }, { status: 403 });
    }

    const result = await fulfillCheckoutSession({
      id: session.id,
      metadata: session.metadata,
      customer: typeof session.customer === "string" ? session.customer : null,
      subscription: typeof session.subscription === "string" ? session.subscription : null,
      payment_status: session.payment_status,
      status: session.status,
      customer_email: session.customer_details?.email || session.customer_email,
      customer_details: session.customer_details,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Confirm failed" },
      { status: 500 },
    );
  }
}
