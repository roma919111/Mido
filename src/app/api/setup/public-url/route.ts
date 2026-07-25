import { NextResponse } from "next/server";
import { isOwnerSetupAuthorized } from "@/lib/owner-credentials";
import {
  googleRedirectUriForOrigin,
  loadLockedPublicOrigin,
  saveLockedPublicOrigin,
} from "@/lib/public-base-url";
import { syncStripeWebhookToPublicUrl } from "@/lib/stripe-webhook-sync";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const origin = loadLockedPublicOrigin();
  return NextResponse.json({
    locked: Boolean(origin),
    appBaseUrl: origin,
    redirectUri: origin ? googleRedirectUriForOrigin(origin) : null,
  });
}

export async function POST(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim() || "";
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    const origin = saveLockedPublicOrigin(url);
    const stripeSync = await syncStripeWebhookToPublicUrl(origin).catch((err) => ({
      ok: false as const,
      skipped: err instanceof Error ? err.message : "Stripe sync failed",
    }));

    return NextResponse.json({
      ok: true,
      locked: true,
      appBaseUrl: origin,
      redirectUri: googleRedirectUriForOrigin(origin),
      stripeWebhook: stripeSync,
      message:
        "تم قفل الرابط. Stripe Webhook يتحدث تلقائيًا. Google Callback يحتاج يتحدّث مرة واحدة فقط إذا تغيّر الدومين الدائم.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 400 },
    );
  }
}
