"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { SUBSCRIPTION_PLANS, TOPUP_PACKS, type PlanId } from "@/lib/plans";
import { fetchJson } from "@/lib/fetch-json";

export function PricingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await fetchJson<{ user: CustomerUser | null }>("/api/auth/customer/me");
      setUser(data.user);
    })();
    if (params.get("success")) setMessage("تم الدفع بنجاح — سيظهر الرصيد خلال لحظات.");
    if (params.get("canceled")) setMessage("تم إلغاء عملية الدفع.");
    if (params.get("paywall")) setMessage("اشترك للحصول على كريدت قبل التوليد.");
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
        demo?: boolean;
        message?: string;
        error?: string;
        user?: CustomerUser;
      }>("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(data.error || "فشل الدفع");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.demo) {
        setMessage(data.message || "تم التفعيل (وضع تجريبي).");
        if (data.user) setUser(data.user);
      }
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
        onLogout={() => {
          void fetch("/api/auth/customer/logout", { method: "POST" }).then(() => setUser(null));
        }}
      />
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-8 sm:px-6" dir="rtl">
        <h1 className="font-display text-3xl font-extrabold">الباقات الشهرية</h1>
        <p className="mt-2 text-white/50">
          باقتان اقتصاديتان من 10$ إلى 15$. الكريدت يُضاف لمحفظة Veronix ويُخصم حسب التسعير ×1.8.
        </p>
        {message && (
          <p className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
            {message}
          </p>
        )}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-3xl border p-5 ${
                plan.highlight
                  ? "border-[#22f0ff]/50 bg-[rgba(34,240,255,0.06)]"
                  : "border-white/10 bg-[#141821]"
              }`}
            >
              <p className="text-sm text-white/50">الباقة {plan.name}</p>
              <p className="mt-2 font-display text-3xl font-bold" dir="ltr">
                ${plan.priceUsd.toFixed(2)}
                <span className="text-sm font-normal text-white/45"> / mo</span>
              </p>
              <p className="mt-2 text-sm text-white/60">
                {plan.monthlyCredits.toLocaleString("en-US")} كريدت / شهر
              </p>
              <p className="mt-3 text-sm text-white/45">{plan.description}</p>
              <button
                type="button"
                disabled={busy === plan.id}
                onClick={() => void checkout({ planId: plan.id }, plan.id)}
                className="mt-5 w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                {busy === plan.id ? "جارٍ المعالجة…" : `اختر الباقة ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        <h2 className="mt-12 font-display text-2xl font-bold">حزم الشحن الإضافي</h2>
        <p className="mt-2 text-white/50">اشحن رصيدك فورًا دون انتظار تجديد الباقة.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {TOPUP_PACKS.map((pack) => (
            <div key={pack.id} className="rounded-3xl border border-white/10 bg-[#141821] p-5">
              <p className="text-sm text-white/50">{pack.name}</p>
              <p className="mt-2 font-display text-3xl font-bold" dir="ltr">
                ${pack.priceUsd.toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-white/60">
                {pack.credits.toLocaleString("en-US")} كريدت
              </p>
              <p className="mt-3 text-sm text-white/45">{pack.description}</p>
              <button
                type="button"
                disabled={busy === pack.id}
                onClick={() => void checkout({ topUpId: pack.id }, pack.id)}
                className="mt-5 w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                {busy === pack.id ? "جارٍ المعالجة…" : "اشحن الآن"}
              </button>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
