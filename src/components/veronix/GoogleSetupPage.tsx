"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { fetchJson } from "@/lib/fetch-json";

export function GoogleSetupPage() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [configured, setConfigured] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await fetchJson<{
        configured?: boolean;
        redirectUri?: string;
      }>("/api/auth/google/status");
      setConfigured(Boolean(data.configured));
      setRedirectUri(data.redirectUri || "");
    })();
  }, []);

  async function save(e: React.FormEvent) {
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
        "/api/setup/google",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ clientId, clientSecret }),
        },
      );
      if (!res.ok) throw new Error(data.error || "Save failed");
      setConfigured(true);
      setMessage(data.message || "Saved");
      setClientSecret("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-10 text-white">
      <BrandLogo size="lg" />
      <h1 className="mt-6 font-display text-2xl font-bold">Google Sign-In setup</h1>
      <p className="mt-2 text-sm text-white/50">
        التطبيق جاهز بالكامل. الخطوة الوحيدة من جوجل (ضرورية): إنشاء OAuth Client ولصق المفتاحين
        هنا.
      </p>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm">
        <p className="font-semibold text-white">1) Google Cloud Console</p>
        <ol className="list-decimal space-y-2 pl-5 text-white/70">
          <li>
            افتح{" "}
            <a
              className="text-[#22f0ff]"
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
            >
              Google Credentials
            </a>
          </li>
          <li>Create Credentials → OAuth client ID → Application type: Web application</li>
          <li>
            Authorized redirect URIs — الصق بالضبط:
            <code className="mt-2 block break-all rounded-xl bg-black/40 p-3 text-xs text-[#22f0ff]">
              {redirectUri || "…loading"}
            </code>
          </li>
          <li>انسخ Client ID و Client Secret والصقهما بالأسفل</li>
        </ol>
      </div>

      <form onSubmit={save} className="mt-6 space-y-3">
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="GOOGLE_CLIENT_ID"
          required
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
        />
        <input
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder="GOOGLE_CLIENT_SECRET"
          required
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
        />
        <input
          value={setupKey}
          onChange={(e) => setSetupKey(e.target.value)}
          placeholder="OWNER_SETUP_KEY (only if you set one)"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        {message && <p className="text-sm text-cyan-200">{message}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] py-3 text-sm font-semibold"
        >
          {saving ? "Saving…" : configured ? "Update Google credentials" : "Save & enable Google"}
        </button>
      </form>

      <div className="mt-6 flex gap-3 text-sm">
        <Link href="/login" className="text-[#22f0ff]">
          Go to Login
        </Link>
        <span className="text-white/30">·</span>
        <span className={configured ? "text-emerald-300" : "text-amber-200"}>
          {configured ? "Google configured ✓" : "Not configured yet"}
        </span>
      </div>
    </div>
  );
}
