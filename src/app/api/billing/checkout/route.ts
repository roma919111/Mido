import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import {
  canPurchasePlan,
  canTopUp,
  getPlan,
  getTopUp,
  isFreePlan,
  isHighestPlan,
  isPaidPlan,
  type PlanId,
} from "@/lib/plans";
import {
  cancelStripeSubscription,
  createCheckoutSession,
  createTopUpCheckoutSession,
  isStripeConfigured,
} from "@/lib/stripe";
import { adjustCredits, publicUser, updateUser } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const body = (await request.json()) as { planId?: PlanId; topUpId?: string };

    if (body.topUpId) {
      if (!canTopUp(user.planId)) {
        return NextResponse.json(
          {
            error: "إضافة الكريدت متاحة بعد الترقية لباقة مدفوعة فقط.",
            code: "free_plan_topup_blocked",
          },
          { status: 409 },
        );
      }

      const pack = getTopUp(body.topUpId);
      if (!pack) {
        return NextResponse.json({ error: "Invalid top-up pack" }, { status: 400 });
      }

      if (!(await isStripeConfigured())) {
        const updated = await adjustCredits(user.id, pack.credits);
        return NextResponse.json({
          demo: true,
          message: `Stripe غير مفعّل. تمت إضافة ${pack.credits} كريدت للتجربة.`,
          user: publicUser(updated),
        });
      }

      const session = await createTopUpCheckoutSession({
        userId: user.id,
        email: user.email,
        topUpId: pack.id,
        stripeCustomerId: user.stripeCustomerId,
      });
      return NextResponse.json({ url: session.url, sessionId: session.sessionId });
    }

    const planId = body.planId;
    const plan = getPlan(planId);
    if (!plan || !planId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (user.planId === planId || (isFreePlan(user.planId) && planId === "free")) {
      return NextResponse.json(
        {
          error: "هذه باقتك الحالية. يمكنك الترقية لباقة أعلى أو الرجوع للمجانية من باقة مدفوعة.",
          code: "same_plan",
        },
        { status: 409 },
      );
    }

    if (isHighestPlan(user.planId) && isPaidPlan(planId)) {
      return NextResponse.json(
        {
          error: "أنت على أعلى باقة. أضف كريدت أو ارجع للباقة المجانية.",
          code: "highest_plan_topup_or_free",
        },
        { status: 409 },
      );
    }

    if (!canPurchasePlan(user.planId, planId)) {
      return NextResponse.json(
        {
          error: "لا يمكن الرجوع لباقة مدفوعة أدنى. الترقية للأعلى أو الرجوع للمجانية فقط.",
          code: "downgrade_blocked",
        },
        { status: 409 },
      );
    }

    // Free plan: cancel Stripe billing, no charge, no credits granted.
    if (planId === "free" || plan.priceUsd <= 0) {
      await cancelStripeSubscription(user.stripeSubscriptionId);
      const updated = await updateUser(user.id, {
        planId: "free",
        stripeSubscriptionId: undefined,
      });
      return NextResponse.json({
        ok: true,
        message: "تم التحويل إلى الباقة المجانية وإيقاف الاستقطاع الشهري.",
        user: publicUser(updated),
      });
    }

    if (!(await isStripeConfigured())) {
      // Dev / demo activation when Stripe keys are not set yet.
      await cancelStripeSubscription(user.stripeSubscriptionId);
      await updateUser(user.id, { planId, stripeSubscriptionId: undefined });
      const updated = await adjustCredits(user.id, plan.monthlyCredits);
      return NextResponse.json({
        demo: true,
        message: `Stripe غير مفعّل. تم تفعيل ${plan.name} وإضافة ${plan.monthlyCredits} كريدت للتجربة.`,
        user: publicUser(updated),
      });
    }

    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      planId,
      stripeCustomerId: user.stripeCustomerId,
    });

    return NextResponse.json({ url: session.url, sessionId: session.sessionId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 422 },
    );
  }
}
