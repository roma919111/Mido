import { NextResponse } from "next/server";
import { isOwnerSetupAuthorized } from "@/lib/owner-credentials";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  hasStripeCredentials,
  loadStripeCredentials,
  saveStripeCredentials,
} from "@/lib/stripe-credentials";
import { getStripe, resetStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const creds = await loadStripeCredentials();
  const configured = await hasStripeCredentials();
  const base = getAppBaseUrl();
  return NextResponse.json({
    configured,
    hasWebhookSecret: Boolean(creds?.webhookSecret),
    keyPreview: creds?.secretKey
      ? `${creds.secretKey.slice(0, 7)}…${creds.secretKey.slice(-4)}`
      : null,
    mode: creds?.secretKey?.startsWith("sk_live")
      ? "live"
      : creds?.secretKey?.startsWith("sk_test")
        ? "test"
        : null,
    webhookUrl: `${base}/api/billing/webhook`,
    appBaseUrl: base,
  });
}

export async function POST(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      secretKey?: string;
      webhookSecret?: string;
    };
    const existing = await loadStripeCredentials();
    const secretKey = body.secretKey?.trim() || existing?.secretKey || "";
    const webhookSecret =
      body.webhookSecret?.trim() || existing?.webhookSecret || "";

    if (!secretKey) {
      return NextResponse.json({ error: "secretKey مطلوب" }, { status: 400 });
    }
    if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
      return NextResponse.json(
        { error: "المفتاح لازم يبدأ بـ sk_test_ أو sk_live_" },
        { status: 400 },
      );
    }

    await saveStripeCredentials({
      secretKey,
      webhookSecret: webhookSecret || undefined,
    });
    resetStripeClient();

    // Verify the key talks to Stripe
    const stripe = await getStripe();
    await stripe.balance.retrieve();

    const base = getAppBaseUrl();
    return NextResponse.json({
      ok: true,
      configured: true,
      mode: secretKey.startsWith("sk_live") ? "live" : "test",
      hasWebhookSecret: Boolean(webhookSecret),
      webhookUrl: `${base}/api/billing/webhook`,
      message: webhookSecret
        ? "تم ربط Stripe بنجاح. الدفع الحقيقي جاهز."
        : "تم حفظ المفتاح. أضف Webhook في Stripe والصق Signing secret هنا لإكمال الربط.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `فشل التحقق من Stripe: ${error.message}`
            : "Save failed",
      },
      { status: 422 },
    );
  }
}
