"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  CreditCard,
  Loader2,
  Settings,
  UserRound,
  Zap,
} from "lucide-react";
import { AppHeader, type CustomerUser } from "@/components/veronix/AppHeader";
import { BottomNav } from "@/components/veronix/BottomNav";
import { UserAvatar } from "@/components/veronix/ProfileMenu";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { fetchJson } from "@/lib/fetch-json";
import {
  getPlan,
  isFreePlan,
  isPaidPlan,
  normalizePlanId,
} from "@/lib/plans";

type SettingsTab = "profile" | "billing";

type SubscriptionInfo = {
  planId: string;
  planName: string;
  planPriceUsd: number;
  monthlyCredits: number;
  credits: number;
  isPaid: boolean;
  hasStripeCustomer: boolean;
  subscription: {
    status: string;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
  } | null;
};

function formatRenewal(ts: number | null, locale: string): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toLocaleDateString(
    locale === "ar" ? "ar-EG" : "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );
}

export function SettingsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, dir, locale } = useLocale();
  const { user, setUser, logout, ready, refreshing } = useCustomerUser();

  const tabParam = params.get("tab");
  const tab: SettingsTab = tabParam === "billing" ? "billing" : "profile";

  const [name, setName] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [billing, setBilling] = useState<SubscriptionInfo | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingBusy, setBillingBusy] = useState<string | null>(null);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const loadBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      const { res, data } = await fetchJson<SubscriptionInfo>("/api/billing/subscription");
      if (res.ok) setBilling(data);
    } catch {
      // ignore
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "billing" && user) void loadBilling();
  }, [tab, user, loadBilling]);

  async function saveName() {
    if (!user) return;
    setNameBusy(true);
    setNameMessage(null);
    try {
      const { res, data } = await fetchJson<{ user?: CustomerUser; error?: string }>(
        "/api/auth/customer/profile",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        },
      );
      if (res.ok && data.user) {
        setUser(data.user);
        setNameMessage(t.settings.nameSaved);
      } else {
        setNameMessage(data.error || t.settings.nameError);
      }
    } catch {
      setNameMessage(t.settings.nameError);
    } finally {
      setNameBusy(false);
    }
  }

  async function onAvatarPick(file: File | null) {
    if (!file || !user) return;
    setAvatarBusy(true);
    setAvatarMessage(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const { res, data } = await fetchJson<{ user?: CustomerUser; error?: string }>(
        "/api/auth/customer/avatar",
        { method: "POST", body: form },
      );
      if (res.ok && data.user) {
        setUser(data.user);
        setAvatarMessage(t.settings.avatarSaved);
      } else {
        setAvatarMessage(data.error || t.settings.avatarError);
      }
    } catch {
      setAvatarMessage(t.settings.avatarError);
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function cancelSubscription() {
    if (!confirm(t.settings.cancelConfirm)) return;
    setBillingBusy("cancel");
    setBillingMessage(null);
    try {
      const { res, data } = await fetchJson<{
        ok?: boolean;
        message?: string;
        user?: CustomerUser;
        error?: string;
      }>("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "free" }),
      });
      if (res.ok && data.user) {
        setUser(data.user);
        setBillingMessage(data.message || t.settings.cancelDone);
        void loadBilling();
      } else {
        setBillingMessage(data.error || t.settings.cancelError);
      }
    } catch {
      setBillingMessage(t.settings.cancelError);
    } finally {
      setBillingBusy(null);
    }
  }

  async function openBillingPortal() {
    setBillingBusy("portal");
    setBillingMessage(null);
    try {
      const { res, data } = await fetchJson<{ url?: string; error?: string }>(
        "/api/billing/portal",
        { method: "POST" },
      );
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setBillingMessage(data.error || t.settings.portalError);
    } catch {
      setBillingMessage(t.settings.portalError);
    } finally {
      setBillingBusy(null);
    }
  }

  function setTab(next: SettingsTab) {
    router.replace(next === "billing" ? "/settings?tab=billing" : "/settings");
  }

  const planId = normalizePlanId(billing?.planId ?? user?.planId);
  const plan = getPlan(planId);
  const onPaid = isPaidPlan(planId);

  return (
    <div className="min-h-dvh bg-[#0b0d12] text-white" dir={dir}>
      <AppHeader
        user={user}
        onLogout={logout}
        ready={ready}
        refreshing={refreshing}
      />

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6 sm:px-6 sm:pb-32 sm:pt-8">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-white/70 ring-1 ring-white/10">
            <Settings className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[#22f0ff]/90">
              {t.settings.eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {t.settings.title}
            </h1>
            <p className="mt-2 text-sm text-white/55">{t.settings.subtitle}</p>
          </div>
        </div>

        <div
          className="mt-6 flex gap-2 rounded-2xl border border-white/10 bg-[#141821] p-1"
          role="tablist"
        >
          {(["profile", "billing"] as const).map((id) => {
            const active = tab === id;
            const label = id === "profile" ? t.settings.profileTab : t.settings.billingTab;
            const Icon = id === "profile" ? UserRound : CreditCard;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-black"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>

        {ready && !user ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#141821] px-4 py-10 text-center text-sm text-white/55">
            <p>{t.settings.loginRequired}</p>
            <Link
              href="/login?next=/settings"
              className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black"
            >
              {t.header.login}
            </Link>
          </div>
        ) : tab === "profile" ? (
          <section className="mt-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#141821] p-5">
              <h2 className="text-sm font-semibold text-white">{t.settings.avatarTitle}</h2>
              <p className="mt-1 text-xs text-white/45">{t.settings.avatarHint}</p>

              <div className="mt-4 flex items-center gap-4">
                {user ? <UserAvatar user={user} /> : null}
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onAvatarPick(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    disabled={avatarBusy || !user}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 hover:border-white/25 disabled:opacity-50"
                  >
                    {avatarBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Camera className="h-4 w-4" aria-hidden />
                    )}
                    {t.settings.changeAvatar}
                  </button>
                </div>
              </div>
              {avatarMessage ? (
                <p className="mt-3 text-xs text-[#22f0ff]/90">{avatarMessage}</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#141821] p-5">
              <h2 className="text-sm font-semibold text-white">{t.settings.nameTitle}</h2>
              <p className="mt-1 text-xs text-white/45">{t.settings.nameHint}</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#22f0ff]/40 focus:outline-none focus:ring-1 focus:ring-[#22f0ff]/30"
                placeholder={t.settings.namePlaceholder}
              />
              <p className="mt-2 text-xs text-white/35">{user?.email}</p>
              <button
                type="button"
                disabled={nameBusy || !user || name.trim().length < 2}
                onClick={() => void saveName()}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {nameBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                {t.settings.saveName}
              </button>
              {nameMessage ? (
                <p className="mt-3 text-xs text-[#22f0ff]/90">{nameMessage}</p>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="mt-6 space-y-4">
            {billingLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#141821] px-4 py-10 text-sm text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t.settings.billingLoading}
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-[#141821] p-5">
                  <h2 className="text-sm font-semibold text-white">{t.settings.planTitle}</h2>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-white">
                        {billing?.planName ?? plan?.name ?? planId}
                      </p>
                      <p className="mt-1 text-sm text-white/50" dir="ltr">
                        {billing?.planPriceUsd === 0 || isFreePlan(planId)
                          ? "Free"
                          : `$${billing?.planPriceUsd ?? plan?.priceUsd ?? 0} / mo`}
                      </p>
                      {billing?.subscription?.currentPeriodEnd ? (
                        <p className="mt-2 text-xs text-white/45">
                          {billing.subscription.cancelAtPeriodEnd
                            ? t.settings.endsOn
                            : t.settings.renewsOn}{" "}
                          {formatRenewal(billing.subscription.currentPeriodEnd, locale)}
                        </p>
                      ) : null}
                      {billing?.subscription?.status ? (
                        <p className="mt-1 text-xs text-white/35">
                          {t.settings.status}: {billing.subscription.status}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-[#22f0ff]/10 px-2.5 py-1 text-[11px] font-semibold text-[#22f0ff]">
                      {onPaid ? t.settings.paidPlan : t.settings.freePlan}
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                    <p className="text-xs text-white/45">{t.settings.creditsBalance}</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-white">
                      {(billing?.credits ?? user?.credits ?? 0).toLocaleString(
                        locale === "en" ? "en-US" : "ar-EG",
                      )}
                    </p>
                    {(billing?.monthlyCredits ?? plan?.monthlyCredits ?? 0) > 0 ? (
                      <p className="mt-1 text-xs text-white/40">
                        {t.settings.monthlyCredits}:{" "}
                        {(billing?.monthlyCredits ?? plan?.monthlyCredits ?? 0).toLocaleString(
                          locale === "en" ? "en-US" : "ar-EG",
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#141821] p-5">
                  <h2 className="text-sm font-semibold text-white">{t.settings.manageTitle}</h2>
                  <p className="mt-1 text-xs text-white/45">{t.settings.manageHint}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-2.5 text-sm font-bold text-white"
                    >
                      <Zap className="h-4 w-4" aria-hidden />
                      {t.settings.changePlan}
                    </Link>

                    {billing?.hasStripeCustomer ? (
                      <button
                        type="button"
                        disabled={Boolean(billingBusy)}
                        onClick={() => void openBillingPortal()}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 hover:border-white/25 disabled:opacity-50"
                      >
                        {billingBusy === "portal" ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <CreditCard className="h-4 w-4" aria-hidden />
                        )}
                        {t.settings.stripePortal}
                      </button>
                    ) : null}

                    {onPaid ? (
                      <button
                        type="button"
                        disabled={Boolean(billingBusy)}
                        onClick={() => void cancelSubscription()}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 hover:border-rose-400/50 disabled:opacity-50"
                      >
                        {billingBusy === "cancel" ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : null}
                        {t.settings.cancelSubscription}
                      </button>
                    ) : null}
                  </div>

                  {billingMessage ? (
                    <p className="mt-4 text-xs text-[#22f0ff]/90">{billingMessage}</p>
                  ) : null}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
