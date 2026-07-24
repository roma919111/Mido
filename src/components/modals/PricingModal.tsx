"use client";

import { Check, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { PRICING_TIERS } from "@/lib/pricing";
import type { SubscriptionTier } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PricingModal({ open, onClose }: Props) {
  const router = useRouter();
  const { user, refreshUser, setUser } = useApp();
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function upgrade(tier: SubscriptionTier) {
    if (!user) {
      router.push("/signup");
      return;
    }
    setLoading(tier);
    setError(null);
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upgrade failed");
      setUser(data.user);
      await refreshUser();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upgrade failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[28px] p-5 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-white/10 p-2 text-white/60 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-8 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Upgrade / Pricing</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white sm:text-4xl">
            Choose your Studio plan
          </h2>
          <p className="mt-2 text-sm text-white/50">
            Credits power every image and video generation in your private customer wallet.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-3xl border p-5 ${
                tier.highlighted
                  ? "border-cyan-300/40 bg-cyan-400/10 glow-cyan"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">{tier.name}</h3>
                {tier.highlighted && (
                  <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#041018]">
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-3 font-[family-name:var(--font-display)] text-4xl text-white">
                ${tier.price}
                <span className="text-base font-normal text-white/40">/mo</span>
              </p>
              <p className="mt-1 text-sm text-cyan-100/80">{tier.credits.toLocaleString()} credits</p>
              <p className="mt-3 text-sm text-white/50">{tier.description}</p>
              <ul className="mt-5 space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-white/70">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={loading === tier.id || user?.subscriptionTier === tier.id}
                onClick={() => void upgrade(tier.id)}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 px-4 py-3 text-sm font-semibold text-[#041018] disabled:opacity-50"
              >
                <Zap className="h-4 w-4" />
                {user?.subscriptionTier === tier.id
                  ? "Current plan"
                  : loading === tier.id
                    ? "Updating…"
                    : tier.price === 0
                      ? "Stay on Free"
                      : `Upgrade to ${tier.name}`}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
