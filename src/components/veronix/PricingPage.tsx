"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { SUBSCRIPTION_PLANS, type PlanId } from "@/lib/plans";
import { fetchJson } from "@/lib/fetch-json";

export function PricingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await fetchJson<{ user: CustomerUser | null }>("/api/auth/customer/me");
      setUser(data.user);
    })();
    if (params.get("success")) setMessage("Payment successful — credits will appear shortly.");
    if (params.get("canceled")) setMessage("Checkout canceled.");
    if (params.get("paywall")) setMessage("Subscribe to get credits before generating.");
  }, [params]);

  async function choose(planId: PlanId) {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent("/pricing")}&paywall=1`);
      return;
    }
    setBusy(planId);
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
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.demo) {
        setMessage(data.message || "Plan activated (demo mode).");
        if (data.user) setUser(data.user);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed");
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
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-8 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold">Monthly plans</h1>
        <p className="mt-2 text-white/50">
          Economic subscriptions from $10–$15. Credits sync to your Veronix wallet; generation costs
          match OpenArt exactly.
        </p>
        {message && (
          <p className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
            {message}
          </p>
        )}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-3xl border p-5 ${
                plan.highlight
                  ? "border-[#22f0ff]/50 bg-[rgba(34,240,255,0.06)]"
                  : "border-white/10 bg-[#141821]"
              }`}
            >
              <p className="text-sm text-white/50">{plan.name}</p>
              <p className="mt-2 font-display text-3xl font-bold">
                ${plan.priceUsd.toFixed(2)}
                <span className="text-sm font-normal text-white/45"> / mo</span>
              </p>
              <p className="mt-2 text-sm text-white/60">{plan.monthlyCredits} credits / month</p>
              <p className="mt-3 text-sm text-white/45">{plan.description}</p>
              <button
                type="button"
                disabled={busy === plan.id}
                onClick={() => void choose(plan.id)}
                className="mt-5 w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                {busy === plan.id ? "Processing…" : `Choose ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
