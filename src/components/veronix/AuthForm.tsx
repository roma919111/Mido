"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/veronix/LanguageSwitcher";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { fetchJson } from "@/lib/fetch-json";
import type { CustomerUser } from "@/components/veronix/AppHeader";
import { writeCustomerSnapshot } from "@/lib/customer-user-cache";

interface AuthFormProps {
  mode: "login" | "signup";
  /** Hide top logo row when AppHeader is already shown. */
  embedded?: boolean;
}

export function AuthForm({ mode, embedded = false }: AuthFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const { t, dir } = useLocale();
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
        mode === "login"
          ? "/api/auth/customer/login"
          : "/api/auth/customer/signup";
      const { res, data } = await fetchJson<{ error?: string }>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) throw new Error(data.error || "Auth failed");
      try {
        const me = await fetchJson<{ user: CustomerUser | null }>(
          "/api/auth/customer/me",
        );
        if (me.data.user) writeCustomerSnapshot(me.data.user);
      } catch {
        // best-effort — next page will refresh session
      }
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
    <div
      className="mx-auto flex max-w-md flex-col justify-center px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6"
      dir={dir}
    >
      {!embedded ? (
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="w-fit">
            <BrandLogo size="lg" />
          </Link>
          <LanguageSwitcher compact />
        </div>
      ) : null}

      <h1 className={`font-display text-2xl font-bold ${embedded ? "mt-0" : "mt-6"}`}>
        {mode === "login" ? t.auth.loginTitle : t.auth.signupTitle}
      </h1>
      <p className="mt-2 text-sm text-white/50">
        {mode === "signup" ? t.auth.signupSub : t.auth.loginSub}
      </p>

      {paywall ? (
        <p className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
          {t.auth.paywallHint}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        {mode === "signup" ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.auth.name}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          />
        ) : null}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.auth.email}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t.auth.password}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading
            ? "…"
            : mode === "login"
              ? t.auth.submitLogin
              : t.auth.submitSignup}
        </button>
      </form>

      {googleConfigured ? (
        <>
          <div className="my-4 flex items-center gap-3 text-[11px] text-white/30">
            <span className="h-px flex-1 bg-white/10" />
            {t.auth.orGoogle}
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <a
            href={googleHref}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white px-4 py-3 text-sm font-semibold text-[#111]"
          >
            Google
          </a>
          {redirectUri ? (
            <p className="mt-2 text-center text-[11px] text-white/35" dir="ltr">
              Redirect: {redirectUri}
            </p>
          ) : null}
        </>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <p className="mt-6 text-sm text-white/45">
        {mode === "login" ? (
          <>
            {t.auth.noAccount}{" "}
            <Link
              href={`/signup?next=${encodeURIComponent(next)}${paywall ? "&paywall=1" : ""}`}
              className="text-[#22f0ff]"
            >
              {t.auth.signupTitle}
            </Link>
          </>
        ) : (
          <>
            {t.auth.hasAccount}{" "}
            <Link
              href={`/login?next=${encodeURIComponent(next)}${paywall ? "&paywall=1" : ""}`}
              className="text-[#22f0ff]"
            >
              {t.auth.loginTitle}
            </Link>
          </>
        )}
      </p>

      <Link href="/" className="mt-4 text-sm text-white/35 hover:text-white/60">
        {t.footer.backHome}
      </Link>
    </div>
  );
}
