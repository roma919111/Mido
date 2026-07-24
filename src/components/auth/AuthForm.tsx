"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";

type Mode = "login" | "signup" | "reset";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { refreshUser } = useApp();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/signin" : mode === "signup" ? "/api/auth/signup" : "/api/auth/reset";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          mode: mode === "reset" ? "update" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      if (mode === "reset") {
        setMessage("Password updated. You can sign in now.");
        return;
      }

      await refreshUser();
      router.push("/create");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="studio-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-[28px] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-sky-500">
            <Sparkles className="h-5 w-5 text-[#041018]" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-white">
              {mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
            </h1>
            <p className="text-sm text-white/45">Studio AI private customer access</p>
          </div>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          {mode === "signup" && (
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/40"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/40"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "reset" ? "New password" : "Password"}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/40"
          />

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 px-4 py-3 text-sm font-semibold text-[#041018] disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : mode === "signup" ? "Sign up" : "Update password"}
          </button>
        </form>

        {(error || message) && (
          <p
            className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
              error
                ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
                : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
            }`}
          >
            {error ?? message}
          </p>
        )}

        <div className="mt-5 space-y-2 text-sm text-white/45">
          {mode === "login" && (
            <>
              <p>
                No account?{" "}
                <Link href="/signup" className="text-cyan-300 hover:underline">
                  Sign up
                </Link>
              </p>
              <p>
                Forgot password?{" "}
                <Link href="/reset-password" className="text-cyan-300 hover:underline">
                  Reset it
                </Link>
              </p>
            </>
          )}
          {mode === "signup" && (
            <p>
              Already have an account?{" "}
              <Link href="/login" className="text-cyan-300 hover:underline">
                Sign in
              </Link>
            </p>
          )}
          {mode === "reset" && (
            <p>
              Remembered it?{" "}
              <Link href="/login" className="text-cyan-300 hover:underline">
                Back to sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
