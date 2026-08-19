import type Stripe from "stripe";
import { getPlan, getTopUp, type PlanId } from "@/lib/plans";

export type CheckoutAnalytics = {
  transactionId: string;
  value: number;
  currency: string;
  itemId: string;
  itemName: string;
  kind: "subscription" | "topup" | string;
};

export function checkoutAnalyticsFromSession(
  session: Stripe.Checkout.Session,
): CheckoutAnalytics | null {
  const transactionId = session.id?.trim();
  if (!transactionId) return null;

  const kind = session.metadata?.kind || "subscription";
  const value = (session.amount_total ?? 0) / 100;
  const currency = (session.currency || "usd").toUpperCase();

  if (kind === "topup") {
    const topUpId = session.metadata?.topUpId || "topup";
    const pack = getTopUp(topUpId);
    return {
      transactionId,
      value,
      currency,
      itemId: topUpId,
      itemName: pack?.name || "Credit top-up",
      kind: "topup",
    };
  }

  const planId = (session.metadata?.planId || "subscription") as PlanId;
  const plan = getPlan(planId);
  return {
    transactionId,
    value,
    currency,
    itemId: planId,
    itemName: plan?.name || "Subscription",
    kind: "subscription",
  };
}
