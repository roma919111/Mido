"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { fetchJson } from "@/lib/fetch-json";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const paywall = params.get("paywall");
  const urlError = params.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(urlError);
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [redirectUri, setRedirectUri] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await fetchJson<{
          configured?: boolean;
          redirectUri?: string;
        }>("/api/auth/google/status");
        setGoogleReady(Boolean(data.configured));
        setRedirectUri(data.redirectUri || "");
      } catch {
        setGoogleReady(false);
      }
    })();
  }, []);

  function startGoogle() {
    const q = new URLSearchParams();
    if (paywall) q.set("paywall", "1");
    else q.set("next", next);
    window.location.assign(`/api/auth/google?${q.toString()}`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const path =
        mode === "login" ? "/api/auth/customer/login" : "/api/auth/customer/signup";
      const { res, data } = await fetchJson<{ error?: string }>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) throw new Error(data.error || "Auth failed");
      if (paywall) router.push("/pricing?paywall=1");
      else router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10" dir="rtl">
      <Link href="/" className="w-fit">
        <BrandLogo size="lg" />
      </Link>

      <h1 className="mt-6 font-display text-2xl font-bold">
        {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
      </h1>
      <p className="mt-2 text-sm text-white/50">
        {mode === "signup"
          ? "أي شخص يقدر ينشئ حساب — بالبريد مباشرة، أو عبر Google."
          : "ادخل لحسابك لإدارة الكريدت والـ Assets"}
      </p>

      {paywall && (
        <p className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
          لإكمال Generate سجّل حسابك أولاً ثم اختر باقة.
        </p>
      )}

      {/* Primary path: email — works for every customer without Google Console */}
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        {mode === "signup" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="الاسم"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          />
        )}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="البريد"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة المرور"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "…" : mode === "login" ? "دخول بالبريد" : "إنشاء حساب بالبريد"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[11px] text-white/35">
        <div className="h-px flex-1 bg-white/10" />
        أو
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        onClick={() => startGoogle()}
        disabled={!googleReady}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white px-4 py-3.5 text-sm font-semibold text-black transition enabled:hover:bg-white/90 disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.5 16 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.3 5.2C39.9 36.2 44 31 44 24c0-1.2-.1-2.3-.4-3.5z"
          />
        </svg>
        {mode === "signup" ? "متابعة عبر Google" : "دخول عبر Google"}
      </button>

      {googleReady && redirectUri && (
        <p className="mt-2 break-all text-[10px] text-white/35" dir="ltr">
          Google Redirect URI: {redirectUri}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      <p className="mt-6 text-sm text-white/45">
        {mode === "login" ? (
          <>
            ما عندك حساب؟{" "}
            <Link
              href={`/signup?next=${encodeURIComponent(next)}${paywall ? "&paywall=1" : ""}`}
              className="text-[#22f0ff]"
            >
              إنشاء حساب
            </Link>
          </>
        ) : (
          <>
            عندك حساب؟{" "}
            <Link
              href={`/login?next=${encodeURIComponent(next)}${paywall ? "&paywall=1" : ""}`}
              className="text-[#22f0ff]"
            >
              تسجيل الدخول
            </Link>
          </>
        )}
      </p>

      <Link href="/" className="mt-4 text-sm text-white/35 hover:text-white/60">
        ← الرجوع للواجهة
      </Link>
    </div>
  );
}
