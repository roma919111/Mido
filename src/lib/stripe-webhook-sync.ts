import Stripe from "stripe";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  loadStripeCredentials,
  saveStripeCredentials,
} from "@/lib/stripe-credentials";
import { resetStripeClient } from "@/lib/stripe";

const EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "invoice.paid",
];

/**
 * Keep the Stripe webhook endpoint pointed at the current public app URL.
 * Uses the saved secret key — no Stripe dashboard password needed.
 */
export async function syncStripeWebhookToPublicUrl(
  origin = getAppBaseUrl(),
): Promise<{
  ok: boolean;
  webhookUrl?: string;
  skipped?: string;
  endpointId?: string;
}> {
  const creds = await loadStripeCredentials();
  if (!creds?.secretKey) {
    return { ok: false, skipped: "Stripe secret key not configured" };
  }

  const base = origin.replace(/\/$/, "");
  if (!base || /localhost|127\.0\.0\.1/i.test(base)) {
    return { ok: false, skipped: "Public URL is local; webhook sync skipped" };
  }

  const webhookUrl = `${base}/api/billing/webhook`;
  const stripe = new Stripe(creds.secretKey);

  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  for (const ep of existing.data) {
    const isOurs =
      ep.url.includes("/api/billing/webhook") ||
      ep.description === "Veronix.ai billing" ||
      ep.url.includes("trycloudflare.com") ||
      ep.url.includes("loca.lt");
    if (isOurs && ep.url !== webhookUrl) {
      try {
        await stripe.webhookEndpoints.del(ep.id);
      } catch {
        // ignore delete races
      }
    }
  }

  const current = (await stripe.webhookEndpoints.list({ limit: 100 })).data.find(
    (ep) => ep.url === webhookUrl,
  );

  if (current) {
    await stripe.webhookEndpoints.update(current.id, {
      enabled_events: EVENTS,
      disabled: false,
      description: "Veronix.ai billing",
    });
    return { ok: true, webhookUrl, endpointId: current.id };
  }

  const created = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: EVENTS,
    description: "Veronix.ai billing",
  });

  if (created.secret) {
    await saveStripeCredentials({
      secretKey: creds.secretKey,
      webhookSecret: created.secret,
    });
    resetStripeClient();
  }

  return { ok: true, webhookUrl, endpointId: created.id };
}
