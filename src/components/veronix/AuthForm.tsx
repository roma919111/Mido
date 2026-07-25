"use client";

import { useState } from "react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <BrandLogo size="lg" />
      <h1 className="mt-6 font-display text-2xl font-bold">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-white/50">
        {paywall
          ? "Sign in to unlock Generate and choose a monthly plan."
          : "Access Assets, credits, and Veronix.ai generation history."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        {mode === "signup" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          />
        )}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] py-3 text-sm font-semibold text-white"
        >
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <p className="mt-4 text-sm text-white/45">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-[#22f0ff]">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-[#22f0ff]">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
