"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, Coins, Sparkles, Zap } from "lucide-react";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { SiteFooter } from "./SiteFooter";
import { BottomNav } from "./BottomNav";
import {
  canDowngradeToPlan,
  canPurchasePlan,
  canTopUp,
  canUpgradeToPlan,
  getPlan,
  getTopUp,
  isFreePlan,
  isHighestPlan,
  isPaidPlan,
  normalizePlanId,
  SUBSCRIPTION_PLANS,
  TOPUP_PACKS,
  type PlanId,
} from "@/lib/plans";
import { fetchJson } from "@/lib/fetch-json";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { ModelPricingTable } from "@/components/veronix/ModelPricingTable";
import { trackBeginCheckout, trackPurchase } from "@/components/veronix/AnalyticsScripts";
import type { CheckoutAnalytics } from "@/lib/checkout-analytics";

export function PricingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, dir, locale } = useLocale();
  const { user, setUser, logout, ready, refreshing } = useCustomerUser();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState<boolean | null>(null);

  const currentPlanId = normalizePlanId(user?.planId);
  const currentPlan = getPlan(currentPlanId);
  const onHighest = isHighestPlan(currentPlanId);
  const onFree = isFreePlan(currentPlanId);
  const topUpsAllowed = canTopUp(currentPlanId);

  const switchTargets = useMemo(
    () => SUBSCRIPTION_PLANS.filter((p) => canPurchasePlan(currentPlanId, p.id)),
    [currentPlanId],
  );

  useEffect(() => {
    void (async () => {
      try {
        const stripe = await fetchJson<{ configured?: boolean }>("/api/setup/stripe");
        setStripeReady(Boolean(stripe.data.configured));
      } catch {
        setStripeReady(false);
      }

      const sessionId = params.get("session_id");
      if (params.get("success") && sessionId) {
        setMessage("تم الدفع بنجاح — جارٍ تأكيد الرصيد…");
        const { res, data: confirm } = await fetchJson<{
          user?: CustomerUser | null;
          applied?: boolean;
          reason?: string;
          error?: string;
          analytics?: CheckoutAnalytics | null;
        }>("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (res.ok && confirm.user) {
          if (confirm.analytics) {
            trackPurchase({
              transactionId: confirm.analytics.transactionId,
              value: confirm.analytics.value,
              currency: confirm.analytics.currency,
              items: [
                {
                  itemId: confirm.analytics.itemId,
                  itemName: confirm.analytics.itemName,
                  price: confirm.analytics.value,
                },
              ],
            });
          }
          setUser(confirm.user);
          setMessage(
            confirm.applied
              ? `تم تفعيل الباقة وإضافة الرصيد بنجاح (${confirm.user.credits.toLocaleString()} كريدت).`
              : `الدفع مؤكد. رصيدك الحالي ${confirm.user.credits.toLocaleString()} كريدت.`,
          );
          return;
        }
        setMessage(confirm.error || "تم الدفع — حدّث الصفحة إن لم يظهر الرصيد فوراً.");
        return;
      }

      if (params.get("success")) setMessage("تم الدفع بنجاح — سيظهر الرصيد خلال لحظات.");
      if (params.get("canceled")) setMessage("تم إلغاء عملية الدفع.");
      if (params.get("paywall")) setMessage("اشترك أو أضف كريدت قبل التوليد.");
      if (params.get("feature") === "edit") {
        setMessage("استوديو الإيديتينج متاح مع باقة الترا فقط — رقِّ اشتراكك أدناه.");
      }
    })();
  }, [params]);

  async function checkout(body: { planId?: PlanId; topUpId?: string }, busyKey: string) {
    if (!user) {
      router.push(`/signup?next=${encodeURIComponent("/pricing")}&paywall=1`);
      return;
    }
    setBusy(busyKey);
    setMessage(null);
    try {
      const { res, data } = await fetchJson<{
        url?: string;
        ok?: boolean;
        message?: string;
        error?: string;
        user?: CustomerUser;
        needsStripeSetup?: boolean;
        code?: string;
      }>("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        if (data.needsStripeSetup) {
          setStripeReady(false);
          router.push("/setup/stripe");
          return;
        }
        throw new Error(data.error || "فشل الدفع");
      }
      if (data.url) {
        if (body.planId) {
          const plan = getPlan(body.planId);
          if (plan && plan.priceUsd > 0) {
            trackBeginCheckout({
              value: plan.priceUsd,
              items: [{ itemId: plan.id, itemName: plan.name, price: plan.priceUsd }],
            });
          }
        } else if (body.topUpId) {
          const pack = getTopUp(body.topUpId);
          if (pack) {
            trackBeginCheckout({
              value: pack.priceUsd,
              items: [{ itemId: pack.id, itemName: pack.name, price: pack.priceUsd }],
            });
          }
        }
        // Real Stripe Checkout only — credits apply after paid webhook/confirm.
        window.location.href = data.url;
        return;
      }
      if (data.ok) {
        // Free-plan switch only (no credits granted).
        setMessage(data.message || "تم التحديث بنجاح.");
        if (data.user) setUser(data.user);
        return;
      }
      throw new Error("لم يكتمل الدفع. لن تُضاف كريدت بدون دفع ناجح.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "فشل الدفع");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <AppHeader
        user={user}
        ready={ready}
        refreshing={refreshing}
        onLogout={() => {
          void logout();
        }}
      />
      <main className="mx-auto max-w-5xl px-4 pb-bottom-nav pt-8 sm:px-6" dir={dir}>
        <p className="text-xs uppercase tracking-[0.22em] text-[#22f0ff]/80">
          {t.pricing.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">{t.pricing.title}</h1>
        <p className="mt-2 text-white/50">{t.pricing.subtitle}</p>
        <p className="mt-2 text-xs text-emerald-200/80">{t.pricing.freeTrialNote}</p>

        {currentPlan && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#22f0ff]/25 bg-[rgba(34,240,255,0.08)] px-4 py-3 text-sm">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#22f0ff]/15 text-[#22f0ff]">
              <Check className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-white">
                {t.pricing.current}: {currentPlan.name}
              </p>
              <p className="text-white/55">
                {currentPlan.monthlyCredits > 0
                  ? `${currentPlan.monthlyCredits.toLocaleString(locale === "en" ? "en-US" : "ar-EG")} · `
                  : "0 · "}
                {(user?.credits ?? 0).toLocaleString(locale === "en" ? "en-US" : "ar-EG")}
              </p>
            </div>
          </div>
        )}

        {stripeReady === false && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-sm text-amber-50">
            <p className="font-semibold">{t.pricing.stripeMissing}</p>
          </div>
        )}

        {message && (
          <p className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
            {message}
          </p>
        )}

        <h2 className="mt-10 font-display text-2xl font-bold">الباقات</h2>
        <p className="mt-2 text-white/50">
          {onFree
            ? "أنت على الباقة الأساسية. رقِّ لباقة مدفوعة للحصول على كريدت شهري وإمكانية الشحن."
            : "يمكنك الترقية أو الرجوع لأي باقة أخرى، أو إضافة كريدت. نفس الباقة لا تُعاد شراؤها."}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            const canUpgrade = canUpgradeToPlan(currentPlanId, plan.id);
            const canDowngrade = canDowngradeToPlan(currentPlanId, plan.id);
            const canBuy = canPurchasePlan(currentPlanId, plan.id);
            const switchingToFree = plan.id === "free" && canBuy;
            const disabled = Boolean(busy) || !canBuy;

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl border p-5 ${
                  isCurrent
                    ? "border-[#22f0ff]/60 bg-[rgba(34,240,255,0.08)] opacity-80"
                    : canUpgrade || plan.highlight
                      ? "border-[#22f0ff]/40 bg-[rgba(34,240,255,0.05)]"
                      : switchingToFree || canDowngrade
                        ? "border-white/20 bg-[#141821]"
                        : "border-white/10 bg-[#141821]"
                }`}
              >
                {isCurrent && (
                  <span className="absolute left-4 top-4 rounded-full bg-[#22f0ff]/20 px-2.5 py-1 text-[11px] font-semibold text-[#22f0ff]">
                    باقتك الحالية
                  </span>
                )}
                {canUpgrade && (
                  <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-2.5 py-1 text-[11px] font-semibold text-white">
                    <ArrowUpRight className="h-3 w-3" />
                    ترقية
                  </span>
                )}
                {canDowngrade && !switchingToFree && (
                  <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                    رجوع
                  </span>
                )}
                {switchingToFree && (
                  <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                    إيقاف الاشتراك
                  </span>
                )}
                <p className="text-sm text-white/50">الباقة {plan.name}</p>
                <p className="mt-2 font-display text-3xl font-bold" dir="ltr">
                  {plan.priceUsd === 0 ? (
                    "Free"
                  ) : (
                    <>
                      ${plan.priceUsd.toFixed(2)}
                      <span className="text-sm font-normal text-white/45"> / mo</span>
                    </>
                  )}
                </p>
                {plan.monthlyCredits > 0 && (
                  <p className="mt-2 text-sm text-white/60">
                    {plan.monthlyCredits.toLocaleString("en-US")} كريدت / شهر
                  </p>
                )}
                <ul className="mt-3 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22f0ff]/15 text-[#22f0ff] ring-1 ring-[#22f0ff]/30">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-white/45">{plan.description}</p>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!canBuy) return;
                    void checkout({ planId: plan.id }, plan.id);
                  }}
                  className={`mt-5 w-full rounded-2xl py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                    canUpgrade
                      ? "bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] text-white"
                      : switchingToFree || canDowngrade
                        ? "border border-white/20 bg-white/10 text-white"
                        : isCurrent
                          ? "border border-white/15 bg-white/5 text-white/70"
                          : "bg-white text-black"
                  }`}
                >
                  {busy === plan.id
                    ? "جارٍ المعالجة…"
                    : isCurrent
                      ? "باقتك الحالية"
                      : switchingToFree
                        ? "الرجوع للباقة الأساسية"
                        : canUpgrade
                          ? `رقِّ إلى الباقة ${plan.name}`
                          : canDowngrade
                            ? `الرجوع إلى الباقة ${plan.name}`
                            : `اختر الباقة ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {switchTargets.length > 0 && (
          <p className="mt-3 text-center text-xs text-white/40">
            التحويل المتاح: {switchTargets.map((p) => p.name).join(" · ")}
          </p>
        )}

        <section
          id="topup"
          className={`mt-12 overflow-hidden rounded-[28px] border ${
            topUpsAllowed
              ? onHighest
                ? "border-[#22f0ff]/35 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(124,92,255,0.28),transparent_55%),radial-gradient(90%_90%_at_0%_100%,rgba(34,240,255,0.16),transparent_50%),#10141c]"
                : "border-white/10 bg-[#10141c]"
              : "border-white/10 bg-[#10141c]/70 opacity-90"
          }`}
        >
          <div className="border-b border-white/8 px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#22f0ff]/90">
                  <Coins className="h-3.5 w-3.5" />
                  إضافة كريدت
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                  {topUpsAllowed
                    ? onHighest
                      ? "أنت على أعلى باقة — اشحن رصيدك الآن"
                      : "حزم الشحن الإضافي"
                    : "الشحن غير متاح على الباقة الأساسية"}
                </h2>
                <p className="mt-2 max-w-xl text-sm text-white/55">
                  {topUpsAllowed
                    ? "اشحن رصيدك فورًا دون انتظار تجديد الباقة."
                    : "رقِّ إلى باقة برو أو الترا لتفعيل إضافة الكريدت."}
                </p>
              </div>
              {topUpsAllowed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80">
                  <Zap className="h-3.5 w-3.5 text-[#22f0ff]" />
                  الباقة {currentPlan?.name} مفعّلة
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100">
                  يتطلب ترقية
                </span>
              )}
            </div>
          </div>

          {topUpsAllowed ? (
            <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-7">
              {TOPUP_PACKS.map((pack, index) => {
                const featured = index === 1;
                return (
                  <div
                    key={pack.id}
                    className={`relative flex flex-col rounded-3xl border p-5 transition duration-300 hover:-translate-y-0.5 hover:border-[#22f0ff]/35 ${
                      featured
                        ? "border-[#22f0ff]/55 bg-[linear-gradient(180deg,rgba(34,240,255,0.14),rgba(20,24,33,0.95))] shadow-[0_0_40px_rgba(34,240,255,0.12)]"
                        : "border-white/10 bg-[#141821]/90"
                    }`}
                  >
                    {featured && (
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-2.5 py-1 text-[11px] font-semibold text-white">
                        <Sparkles className="h-3 w-3" />
                        الأفضل قيمة
                      </span>
                    )}
                    <p className="text-sm text-white/50">{pack.name}</p>
                    <p className="mt-3 font-display text-4xl font-bold tracking-tight" dir="ltr">
                      ${pack.priceUsd.toFixed(2)}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#22f0ff]">
                      +{pack.credits.toLocaleString("en-US")}
                      <span className="mr-1 text-sm font-normal text-white/50">كريدت</span>
                    </p>
                    <ul className="mt-3 space-y-2">
                      {pack.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm text-white/70"
                        >
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22f0ff]/15 text-[#22f0ff] ring-1 ring-[#22f0ff]/30">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-white/45">
                      {pack.description}
                    </p>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void checkout({ topUpId: pack.id }, pack.id)}
                      className={`mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold transition disabled:opacity-60 ${
                        featured || onHighest
                          ? "bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] text-white hover:brightness-110"
                          : "bg-white text-black hover:bg-white/90"
                      }`}
                    >
                      {busy === pack.id ? "جارٍ المعالجة…" : "أضف الكريدت الآن"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-8 sm:px-7">
              <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-8 text-center">
                <p className="font-display text-lg font-semibold">الشحن مقفل على الباقة الأساسية</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
                  اختر باقة برو ({SUBSCRIPTION_PLANS.find((p) => p.id === "mini")?.monthlyCredits.toLocaleString("en-US")} كريدت / $10) أو الترا ({SUBSCRIPTION_PLANS.find((p) => p.id === "pro")?.monthlyCredits.toLocaleString("en-US")} كريدت / $15)
                  لتفعيل الشحن $4 / $8 / $14.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {SUBSCRIPTION_PLANS.filter((p) => isPaidPlan(p.id)).map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void checkout({ planId: plan.id }, plan.id)}
                      className="rounded-2xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      رقِّ إلى {plan.name} — ${plan.priceUsd}/mo
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <ModelPricingTable />
      </main>
      <div className="pb-bottom-nav">
        <SiteFooter />
      </div>
      <BottomNav />
    </div>
  );
}
