import { resolveUserForCheckoutSession } from "@/lib/checkout-user";
import {
  adjustCredits,
  claimCheckoutSession,
  hasProcessedCheckoutSession,
  updateUser,
} from "@/lib/db";
import { recordMediaPlayerOrder } from "@/lib/media-player-orders";
import { getPlan, getTopUp, isPaidPlan, type PlanId } from "@/lib/plans";
import { cancelStripeSubscription } from "@/lib/stripe";

type CheckoutSessionLike = {
  id?: string;
  metadata?: Record<string, string> | null;
  customer?: string | null;
  subscription?: string | null;
  payment_status?: string | null;
  status?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
};

/**
 * Apply a paid Stripe Checkout session to the customer wallet.
 * Idempotent by Stripe session id — safe for webhook retries and success-page reclaim.
 * Resolves user by metadata.userId OR email so payments survive local DB rebuilds.
 */
export async function fulfillCheckoutSession(
  session: CheckoutSessionLike,
): Promise<{ applied: boolean; reason?: string; credits?: number; planId?: string | null }> {
  const sessionId = session.id?.trim();
  if (!sessionId) return { applied: false, reason: "missing_session_id" };

  if (await hasProcessedCheckoutSession(sessionId)) {
    return { applied: false, reason: "already_processed" };
  }

  const paymentOk =
    session.payment_status === "paid" ||
    session.status === "complete" ||
    session.payment_status === "no_payment_required";
  if (!paymentOk) {
    return { applied: false, reason: "not_paid" };
  }

  const kind = session.metadata?.kind;
  if (kind === "media_player") {
    const email =
      session.customer_details?.email || session.customer_email || session.metadata?.email || "";
    await recordMediaPlayerOrder({
      email: email || "unknown",
      stripeSessionId: sessionId,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
      stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
      source: session.metadata?.source,
    });
    const claimed = await claimCheckoutSession(sessionId);
    if (!claimed) return { applied: false, reason: "already_processed" };
    return { applied: true, reason: "media_player" };
  }

  const user = await resolveUserForCheckoutSession(session);
  if (!user) return { applied: false, reason: "user_not_found" };
  const userId = user.id;
  let credits = 0;
  let planId: PlanId | undefined;

  if (kind === "topup") {
    // Always credit paid top-ups (including restore-after-wipe). Customer paid Stripe.
    const pack = getTopUp(session.metadata?.topUpId);
    credits = Number(session.metadata?.credits || pack?.credits || 0);
  } else {
    planId = session.metadata?.planId as PlanId | undefined;
    if (!planId) return { applied: false, reason: "missing_plan" };
    if (planId === "free" || !isPaidPlan(planId)) {
      return { applied: false, reason: "invalid_paid_plan" };
    }
    const plan = getPlan(planId);
    credits = Number(session.metadata?.monthlyCredits || plan?.monthlyCredits || 0);
  }

  const claimed = await claimCheckoutSession(sessionId);
  if (!claimed) return { applied: false, reason: "already_processed" };

  if (kind === "topup") {
    await updateUser(userId, {
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : user.stripeCustomerId,
    });
    if (credits > 0) await adjustCredits(userId, credits);
    return { applied: true, credits, planId: user.planId };
  }

  const nextSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : user.stripeSubscriptionId;

  if (
    user.stripeSubscriptionId &&
    nextSubscriptionId &&
    user.stripeSubscriptionId !== nextSubscriptionId
  ) {
    await cancelStripeSubscription(user.stripeSubscriptionId);
  }

  await updateUser(userId, {
    planId: planId!,
    stripeCustomerId:
      typeof session.customer === "string" ? session.customer : user.stripeCustomerId,
    stripeSubscriptionId: nextSubscriptionId,
  });
  if (credits > 0) await adjustCredits(userId, credits);
  return { applied: true, credits, planId: planId! };
}
