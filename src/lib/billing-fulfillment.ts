import {
  adjustCredits,
  claimCheckoutSession,
  findUserById,
  hasProcessedCheckoutSession,
  updateUser,
} from "@/lib/db";
import { getPlan, getTopUp, isPaidPlan, type PlanId } from "@/lib/plans";
import { cancelStripeSubscription } from "@/lib/stripe";

type CheckoutSessionLike = {
  id?: string;
  metadata?: Record<string, string> | null;
  customer?: string | null;
  subscription?: string | null;
  payment_status?: string | null;
  status?: string | null;
};

/**
 * Apply a paid Stripe Checkout session to the customer wallet.
 * Idempotent by Stripe session id — safe for webhook retries and success-page reclaim.
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

  const userId = session.metadata?.userId;
  if (!userId) return { applied: false, reason: "missing_user" };

  const user = await findUserById(userId);
  if (!user) return { applied: false, reason: "user_not_found" };

  const kind = session.metadata?.kind;
  let credits = 0;
  let planId: PlanId | undefined;

  if (kind === "topup") {
    if (!isPaidPlan(user.planId)) {
      return { applied: false, reason: "free_plan_topup_blocked" };
    }
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

  // Claim before mutating so concurrent webhook + confirm cannot double-credit.
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

  // Cancel the previous subscription when upgrading so only one monthly charge remains.
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
