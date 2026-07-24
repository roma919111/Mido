"use client";

import { useEffect, useState, useTransition } from "react";
import { useApp } from "@/components/providers/AppProviders";

export default function SettingsPage() {
  const { user, refreshUser, openPricing, setUser } = useApp();
  const [draftName, setDraftName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<
    Array<{ id: string; amount: number; reason: string; balanceAfter: number; createdAt: string }>
  >([]);
  const [, startTransition] = useTransition();

  const fullName = draftName ?? user?.fullName ?? "";

  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();

    fetch("/api/credits", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        startTransition(() => setTransactions(data.transactions ?? []));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [user?.id, startTransition]);

  async function saveProfile() {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Update failed");
      return;
    }
    setUser(data.user);
    setDraftName(null);
    await refreshUser();
    setMessage("Profile updated.");
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-8 text-white/60">
        Sign in to manage your profile, subscription tier, and credit history.{" "}
        <a href="/login" className="text-cyan-300 underline">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/70">Account</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white">Settings</h1>
      </div>

      <section className="rounded-3xl border border-white/8 bg-white/[0.02] p-5">
        <h2 className="text-lg font-semibold text-white">User Profile</h2>
        <div className="mt-4 space-y-3">
          <input
            value={fullName}
            onChange={(e) => setDraftName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/40"
          />
          <input
            value={user.email}
            disabled
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/50"
          />
          <p className="text-sm text-white/45">
            Tier: <span className="text-cyan-200">{user.subscriptionTier}</span> · Credits:{" "}
            <span className="text-cyan-200">{user.credits}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void saveProfile()}
              className="rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 px-4 py-2.5 text-sm font-semibold text-[#041018]"
            >
              Save profile
            </button>
            <button
              type="button"
              onClick={openPricing}
              className="rounded-xl border border-cyan-300/30 px-4 py-2.5 text-sm text-cyan-100"
            >
              Upgrade / Pricing
            </button>
          </div>
          {message && <p className="text-sm text-cyan-100">{message}</p>}
        </div>
      </section>

      <section className="rounded-3xl border border-white/8 bg-white/[0.02] p-5">
        <h2 className="text-lg font-semibold text-white">Credit Transactions</h2>
        <div className="mt-4 space-y-2">
          {transactions.length === 0 && (
            <p className="text-sm text-white/40">No transactions yet.</p>
          )}
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm"
            >
              <div>
                <p className="text-white/80">{tx.reason}</p>
                <p className="text-xs text-white/35">{new Date(tx.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className={tx.amount < 0 ? "text-rose-200" : "text-cyan-200"}>
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                </p>
                <p className="text-xs text-white/35">bal {tx.balanceAfter}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
