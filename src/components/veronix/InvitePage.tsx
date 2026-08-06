"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/veronix/AppHeader";
import { BottomNav } from "@/components/veronix/BottomNav";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { fetchJson } from "@/lib/fetch-json";
import { shareAsset } from "@/lib/share-asset";
import Link from "next/link";
import { Copy, Gift, Share2 } from "lucide-react";
import { trackAnalyticsEvent } from "@/components/veronix/AnalyticsScripts";

type ReferralPayload = {
  referral?: {
    code: string;
    signupUrl: string | null;
    referrerBonus: number;
    refereeBonus: number;
  };
};

export function InvitePage() {
  const { t, dir, locale } = useLocale();
  const { user, logout, ready, refreshing } = useCustomerUser();
  const [signupUrl, setSignupUrl] = useState<string | null>(null);
  const [bonuses, setBonuses] = useState({ referrer: 500, referee: 200 });
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { res, data } = await fetchJson<ReferralPayload>("/api/referral/me", {
          credentials: "include",
        });
        if (res.ok && data.referral) {
          setSignupUrl(data.referral.signupUrl);
          setBonuses({
            referrer: data.referral.referrerBonus,
            referee: data.referral.refereeBonus,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const copyLink = useCallback(async () => {
    if (!signupUrl) return;
    try {
      await navigator.clipboard.writeText(signupUrl);
      setNote(t.invite.copied);
      trackAnalyticsEvent("share", { method: "copy_invite" });
    } catch {
      setNote(t.invite.copyFailed);
    }
  }, [signupUrl, t.invite.copied, t.invite.copyFailed]);

  const nativeShare = useCallback(async () => {
    const code = user?.referralCode;
    const ok = await shareAsset({ referralCode: code, locale }, "native");
    setNote(ok.ok ? t.invite.shared : t.invite.shareFailed);
    if (ok.ok) trackAnalyticsEvent("share", { method: "native_invite" });
  }, [user?.referralCode, locale, t.invite.shared, t.invite.shareFailed]);

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <AppHeader
        user={user}
        ready={ready}
        refreshing={refreshing}
        onLogout={() => void logout()}
      />
      <main className="mx-auto max-w-lg px-4 pb-bottom-nav pt-8 sm:px-6" dir={dir}>
        <p className="text-xs uppercase tracking-[0.2em] text-[#22f0ff]/80">{t.invite.eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">{t.invite.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">{t.invite.subtitle}</p>

        {!user ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#141821] p-5">
            <p className="text-sm text-white/60">{t.invite.loginRequired}</p>
            <Link
              href="/signup?next=/invite"
              className="mt-4 inline-flex rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-5 py-2.5 text-sm font-bold"
            >
              {t.header.signup}
            </Link>
          </div>
        ) : loading ? (
          <p className="mt-8 text-sm text-white/45">{t.invite.loading}</p>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-[#22f0ff]/25 bg-[#22f0ff]/8 p-5">
              <div className="flex items-center gap-2 text-[#22f0ff]">
                <Gift className="h-5 w-5" />
                <p className="text-sm font-semibold">{t.invite.rewardTitle}</p>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li>{t.invite.rewardYou.replace("{n}", String(bonuses.referrer))}</li>
                <li>{t.invite.rewardFriend.replace("{n}", String(bonuses.referee))}</li>
              </ul>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-white/40">{t.invite.yourLink}</span>
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  value={signupUrl || "…"}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white/80 outline-none"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-sm font-semibold"
                >
                  <Copy className="h-4 w-4" />
                  {t.invite.copy}
                </button>
              </div>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void nativeShare()}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold"
              >
                <Share2 className="h-4 w-4" />
                {t.invite.share}
              </button>
              <button
                type="button"
                onClick={() =>
                  void shareAsset({ referralCode: user.referralCode, locale }, "whatsapp")
                }
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-100"
              >
                WhatsApp
              </button>
            </div>

            {note ? <p className="text-center text-xs text-[#22f0ff]">{note}</p> : null}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
