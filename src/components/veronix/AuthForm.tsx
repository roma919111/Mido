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
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [redirectUri, setRedirectUri] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await fetchJson<{
          configured?: boolean;
          redirectUri?: string;
        }>("/api/auth/google/status");
        setGoogleConfigured(Boolean(data.configured));
        setRedirectUri(data.redirectUri || "");
      } catch {
        setGoogleConfigured(false);
        setRedirectUri("");
      }
    })();
  }, []);

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

  const googleHref = `/api/auth/google?next=${encodeURIComponent(next)}${
    paywall ? "&paywall=1" : ""
  }`;

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

      {googleConfigured ? (
        <>
          <div className="my-4 flex items-center gap-3 text-[11px] text-white/30">
            <span className="h-px flex-1 bg-white/10" />
            أو
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <a
            href={googleHref}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white px-4 py-3 text-sm font-semibold text-[#111]"
          >
            المتابعة مع Google
          </a>
          <p className="mt-2 text-center text-[11px] text-white/35" dir="ltr">
            Redirect: {redirectUri || "https://veronix.ai/api/auth/google/callback"}
          </p>
        </>
      ) : (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/45">
          Google غير مفعّل بعد. استخدم البريد، أو أكمل{" "}
          <Link href="/setup/google" className="text-[#22f0ff]">
            إعداد Google
          </Link>
          .
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
