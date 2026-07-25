import { findUserById, updateUser, type UserRecord } from "@/lib/db";
import { fulfillCheckoutSession } from "@/lib/billing-fulfillment";
import { getPlan, isPaidPlan, type PlanId } from "@/lib/plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

/**
 * Sync paid plan membership from Stripe after local identity/DB issues.
 *
 * Important wallet rules:
 * - Spent credits MUST stay spent when the customer leaves and returns.
 * - Login /me NEVER refills the monthly package.
 * - Credits increase only from:
 *   1) a new paid Checkout session (idempotent by session id)
 *   2) Stripe invoice.paid monthly renewal (webhook)
 *   3) paid top-up Checkout
 */
export async function reconcileCustomerWallet(user: UserRecord): Promise<{
  user: UserRecord;
  restored: boolean;
  appliedSessions: number;
}> {
  if (!(await isStripeConfigured())) {
    return { user, restored: false, appliedSessions: 0 };
  }

  const stripe = await getStripe();
  let current = user;
  let appliedSessions = 0;

  try {
    let customerId = current.stripeCustomerId?.trim() || "";
    if (!customerId) {
      const found = await stripe.customers.list({ email: current.email, limit: 5 });
      customerId = found.data[0]?.id || "";
    }
    if (!customerId) {
      return { user: current, restored: false, appliedSessions: 0 };
    }

    if (customerId !== current.stripeCustomerId) {
      current = await updateUser(current.id, { stripeCustomerId: customerId });
    }

    // Replay ONLY checkout sessions not yet applied locally (idempotent).
    // Already-processed purchases never re-add credits — spending stays deducted.
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      limit: 30,
    });

    for (const session of sessions.data) {
      const paid =
        session.payment_status === "paid" ||
        session.status === "complete" ||
        session.payment_status === "no_payment_required";
      if (!paid) continue;

      const result = await fulfillCheckoutSession({
        id: session.id,
        payment_status: session.payment_status,
        status: session.status,
        customer: typeof session.customer === "string" ? session.customer : customerId,
        subscription:
          typeof session.subscription === "string" ? session.subscription : null,
        metadata: {
          ...(session.metadata || {}),
          userId: current.id,
          email: current.email,
        },
      });
      if (result.applied) appliedSessions += 1;
    }

    // Sync plan membership only — never refill credits on login.
    const activeSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 5,
    });
    const trialing = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
      limit: 5,
    });
    const sub = [...activeSubs.data, ...trialing.data][0];
    if (sub) {
      const planId = (sub.metadata?.planId || current.planId) as PlanId | null;
      const plan = getPlan(planId || undefined);
      const patch: Partial<UserRecord> = {
        stripeSubscriptionId: sub.id,
      };
      if (plan && isPaidPlan(plan.id)) {
        patch.planId = plan.id;
      }
      // Do NOT set credits here. Remaining balance after generations must persist.
      current = await updateUser(current.id, patch);
    }

    current = (await findUserById(current.id)) || current;
    return {
      user: current,
      restored: appliedSessions > 0,
      appliedSessions,
    };
  } catch {
    const latest = (await findUserById(user.id)) || user;
    return { user: latest, restored: false, appliedSessions };
  }
}
