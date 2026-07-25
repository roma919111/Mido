"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { fetchJson } from "@/lib/fetch-json";

export function OpenArtSetupPage() {
  const params = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [oauthLoginUrl, setOauthLoginUrl] = useState("https://vyronix.app/api/auth/login");
  const callbackUrl = "https://vyronix.app/api/auth/callback";
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (params.get("connected") === "1") {
      setMessage("تم الربط بنجاح — هذا دائم على vyronix.app. ما راح تحتاج تعيده إلا إذا فصلت الحساب.");
      setConnected(true);
    }
    const err = params.get("error");
    if (err) setError(err);
  }, [params]);

  useEffect(() => {
    void (async () => {
      const { data } = await fetchJson<{
        platformConnected?: boolean;
        oauthLoginUrl?: string;
      }>("/api/setup/openart");
      setConnected(Boolean(data.platformConnected));
      // Always bind owner OAuth to the permanent domain (never localhost).
      setOauthLoginUrl("https://vyronix.app/api/auth/login");
    })();
  }, []);

  async function saveToken(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (setupKey.trim()) headers["x-owner-setup-key"] = setupKey.trim();

      const { res, data } = await fetchJson<{ error?: string; message?: string }>(
        "/api/setup/openart",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ accessToken }),
        },
      );
      if (!res.ok) throw new Error(data.error || "Save failed");
      setConnected(true);
      setMessage(data.message || "Saved");
      setAccessToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-xl overflow-x-hidden px-4 py-8 text-white sm:px-6 sm:py-10" dir="rtl">
      <BrandLogo size="lg" />
      <h1 className="mt-6 font-display text-xl font-bold sm:text-2xl">ربط حساب المنصة (مرة واحدة)</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/50">
        هذا ربط دائم على <span dir="ltr" className="text-white/70">vyronix.app</span>. بعد ما تكمل
        الدخول، الرسالة تختفي وما ترجع إلا إذا مسحت بيانات السيرفر.
      </p>

      <div
        className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
          connected
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-50"
            : "border-amber-400/30 bg-amber-400/10 text-amber-50"
        }`}
      >
        {connected
          ? "الحساب متصل بشكل دائم ✓ — رفع الصور والتوليد جاهزين."
          : "الحساب غير متصل الآن. اضغط الزر تحت وسجّل دخول OpenArt مرّة واحدة فقط."}
      </div>

      {!connected ? (
        <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm">
          <p className="font-semibold text-white">اربط الآن على الدومين الدائم</p>
          <p className="text-white/60">
            مهم: كمّل تسجيل الدخول لين ترجع لهذي الصفحة وتظهر «متصل». إذا سكّرت الصفحة قبل النهاية،
            يرجع يطلب الربط.
          </p>
          <p className="text-xs text-white/40" dir="ltr">
            Callback: {callbackUrl}
          </p>
          <a
            href={oauthLoginUrl}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] py-3 text-sm font-semibold text-white"
          >
            ربط حساب المنصة الآن
          </a>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm text-white/70">
          ما تحتاج تسوي شيء ثاني. ارجع للواجهة وجرّب رفع صورة / Generate.
        </div>
      )}

      <form onSubmit={saveToken} className="mt-6 space-y-3">
        <p className="text-sm font-semibold text-white/80">أو الصق Access Token (اختياري)</p>
        <input
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="OPENART_ACCESS_TOKEN"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
        <input
          value={setupKey}
          onChange={(e) => setSetupKey(e.target.value)}
          placeholder="OWNER_SETUP_KEY (only if you set one)"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        {message && <p className="text-sm text-cyan-200">{message}</p>}
        <button
          type="submit"
          disabled={saving || !accessToken.trim()}
          className="w-full rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "جارٍ الحفظ…" : "حفظ التوكن"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-white/40">
        <Link href="/" className="text-[#22f0ff]">
          العودة للرئيسية
        </Link>
      </p>
    </div>
  );
}
