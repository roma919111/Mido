"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { fetchJson } from "@/lib/fetch-json";

export function DomainSetupPage() {
  const [appBaseUrl, setAppBaseUrl] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function refresh() {
    const { data } = await fetchJson<{
      appBaseUrl?: string;
      redirectUri?: string;
    }>("/api/auth/google/status");
    setAppBaseUrl(data.appBaseUrl || "");
    setRedirectUri(data.redirectUri || "");
    setLocked(Boolean(data.appBaseUrl && !/localhost/i.test(data.appBaseUrl)));
    if (data.appBaseUrl) setInputUrl(data.appBaseUrl);
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  async function lockUrl(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { res, data } = await fetchJson<{
        error?: string;
        message?: string;
        appBaseUrl?: string;
        redirectUri?: string;
      }>("/api/setup/public-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });
      if (!res.ok) throw new Error(data.error || "Save failed");
      setAppBaseUrl(data.appBaseUrl || inputUrl);
      setRedirectUri(data.redirectUri || "");
      setLocked(true);
      setMessage(data.message || "تم قفل الرابط");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-10 text-white" dir="rtl">
      <BrandLogo size="lg" />
      <h1 className="mt-6 font-display text-2xl font-bold">قفل رابط Google Callback</h1>
      <p className="mt-2 text-sm text-white/50">
        المشكلة السابقة: كل تانل يغيّر الرابط فيكسر Google. الحل: نقفل رابط واحد هنا، والتطبيق
        يرسله دائمًا لـ Google — ما يتغيّر لوحده.
      </p>

      {locked && redirectUri ? (
        <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          <p className="font-semibold">مقفل ✓ — حط هذا في Google Console مرة واحدة</p>
          <code className="mt-2 block break-all rounded-xl bg-black/40 p-3 text-left text-xs text-[#22f0ff]" dir="ltr">
            {redirectUri}
          </code>
          <button
            type="button"
            onClick={() => void copy(redirectUri, "google")}
            className="mt-2 rounded-lg border border-emerald-300/30 px-3 py-1.5 text-xs text-emerald-50"
          >
            {copied === "google" ? "تم النسخ ✓" : "نسخ Google Callback"}
          </button>
          <p className="mt-2 text-emerald-100/70" dir="ltr">
            Site: {appBaseUrl}
          </p>
        </div>
      ) : null}

      <form onSubmit={lockUrl} className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm">
        <p className="font-semibold">الرابط العام الحالي (يُقفل)</p>
        <input
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="https://...."
          required
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
        <p className="text-xs text-white/45">
          افتح الموقع من الرابط العام اللي يشتغل عندك الآن، انسخه من شريط المتصفح، الصقه هنا، واضغط
          قفل. بعدين انسخ Callback إلى Google → Authorized redirect URIs.
        </p>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        {message && <p className="text-sm text-cyan-200">{message}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] py-3 text-sm font-semibold"
        >
          {saving ? "…" : "قفل هذا الرابط لـ Google Callback"}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-sm text-white/55">
        <p>بعد القفل:</p>
        <ol className="list-decimal space-y-1 pr-5">
          <li>Google Cloud → نفس OAuth Client → أضف الـ Callback المنسوخ أعلاه</li>
          <li>احفظ في Google</li>
          <li>جرّب تسجيل الدخول بـ Google من نفس رابط الموقع المقفل</li>
        </ol>
        <p className="text-xs text-amber-200/80">
          لما تشتري دومين لاحقًا: غيّر القفل هنا مرة واحدة + حدّث Google مرة واحدة.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/setup/google" className="text-[#22f0ff]">
          إعداد Google Keys
        </Link>
        <span className="text-white/30">·</span>
        <Link href="/login" className="text-[#22f0ff]">
          تسجيل الدخول
        </Link>
      </div>
    </div>
  );
}
