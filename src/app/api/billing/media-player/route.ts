import { NextResponse } from "next/server";
import { sanitizeTrafficSource } from "@/lib/media-player-commerce";
import { createMediaPlayerCheckoutSession, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isStripeConfigured())) {
    return NextResponse.json(
      { error: "الدفع غير مفعّل حالياً. تواصل مع الدعم." },
      { status: 503 },
    );
  }

  let body: { source?: string } = {};
  try {
    body = (await request.json()) as { source?: string };
  } catch {
    body = {};
  }

  try {
    const session = await createMediaPlayerCheckoutSession({
      source: sanitizeTrafficSource(body.source),
    });
    return NextResponse.json({ url: session.url, sessionId: session.sessionId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 422 },
    );
  }
}
