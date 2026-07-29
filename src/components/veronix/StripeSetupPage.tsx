"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { fetchJson } from "@/lib/fetch-json";

export function StripeSetupPage() {
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    const { data } = await fetchJson<{
      configured?: boolean;
      hasWebhookSecret?: boolean;
      webhookUrl?: string;
      keyPreview?: string | null;
      mode?: string | null;
    }>("/api/setup/stripe");
    setConfigured(Boolean(data.configured));
    setHasWebhookSecret(Boolean(data.hasWebhookSecret));
    setWebhookUrl(data.webhookUrl || "");
    setKeyPreview(data.keyPreview || null);
    setMode(data.mode || null);
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  async function copyWebhook() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

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

      const { res, data } = await fetchJson<{
        error?: string;
        message?: string;
        mode?: string;
        hasWebhookSecret?: boolean;
      }>("/api/setup/stripe", {
        method: "POST",
        headers,
        body: JSON.stringify({ secretKey, webhookSecret }),
      });
      if (!res.ok) throw new Error(data.error || "Save failed");
      setConfigured(true);
      setHasWebhookSecret(Boolean(data.hasWebhookSecret));
      setMode(data.mode || null);
      setMessage(data.message || "Saved");
      setSecretKey("");
      setWebhookSecret("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-10 text-white" dir="rtl">
      <BrandLogo size="lg" />
      <h1 className="mt-6 font-display text-2xl font-bold">تفعيل Stripe</h1>
      <p className="mt-2 text-sm text-white/50">
        الصق مفاتيح Stripe هنا الآن. بدونها الترقية وشحن الكريدت مقفولة — وما ينضاف أي رصيد إلا بعد دفع حقيقي.
      </p>

      <div
        className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
          configured
            ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
            : "border-amber-400/25 bg-amber-400/10 text-amber-50"
        }`}
      >
        {configured ? (
          <>
            Stripe متصل ✓ {mode ? `(${mode})` : ""}{" "}
            {keyPreview ? (
              <span className="text-emerald-100/70" dir="ltr">
                {keyPreview}
              </span>
            ) : null}
            {!hasWebhookSecret ? (
              <p className="mt-1 text-amber-100">باقي Signing secret للـ Webhook.</p>
            ) : (
              <p className="mt-1">Webhook جاهز.</p>
            )}
          </>
        ) : (
          "Stripe غير مفعّل — الترقية وشحن الكريدت موقوفة حتى تربط الدفع. لن يُضاف أي رصيد بدون دفع حقيقي."
        )}
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm">
        <p className="font-semibold">1) Secret Key</p>
        <ol className="list-decimal space-y-2 pr-5 text-white/70">
          <li>
            افتح{" "}
            <a
              className="text-[#22f0ff]"
              href="https://dashboard.stripe.com/apikeys"
              target="_blank"
              rel="noreferrer"
            >
              Stripe → API keys
            </a>
          </li>
          <li>
            انسخ <span dir="ltr">Secret key</span> (
            <span dir="ltr">sk_test_…</span> للتجربة أو <span dir="ltr">sk_live_…</span> للإنتاج)
          </li>
        </ol>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm">
        <p className="font-semibold">2) Webhook</p>
        <ol className="list-decimal space-y-2 pr-5 text-white/70">
          <li>
            افتح{" "}
            <a
              className="text-[#22f0ff]"
              href="https://dashboard.stripe.com/webhooks"
              target="_blank"
              rel="noreferrer"
            >
              Stripe → Webhooks
            </a>{" "}
            → Add endpoint
          </li>
          <li>
            Endpoint URL — الصق بالضبط:
            <code
              className="mt-2 block break-all rounded-xl bg-black/40 p-3 text-left text-xs text-[#22f0ff]"
              dir="ltr"
            >
              {webhookUrl || "…"}
            </code>
            <button
              type="button"
              onClick={() => void copyWebhook()}
              className="mt-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80"
            >
              {copied ? "تم النسخ ✓" : "نسخ Webhook URL"}
            </button>
          </li>
          <li>
            Events: <span dir="ltr">checkout.session.completed</span> و{" "}
            <span dir="ltr">invoice.paid</span>
          </li>
          <li>
            بعد الإنشاء انسخ <span dir="ltr">Signing secret</span> (
            <span dir="ltr">whsec_…</span>)
          </li>
        </ol>
      </div>

      <form onSubmit={save} className="mt-6 space-y-3">
        <input
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder="sk_test_... أو sk_live_..."
          required={!configured}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
        <input
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder="whsec_... (Signing secret)"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
        {configured ? (
          <p className="text-xs text-white/40">
            إذا المفتاح محفوظ، اترك الحقل فاضي وحدّث فقط Signing secret.
          </p>
        ) : null}
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
          disabled={saving}
          className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] py-3 text-sm font-semibold"
        >
          {saving ? "جاري التحقق…" : configured ? "تحديث مفاتيح Stripe" : "حفظ وربط Stripe"}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/pricing" className="text-[#22f0ff]">
          صفحة الباقات
        </Link>
        <span className="text-white/30">·</span>
        <Link href="/setup" className="text-[#22f0ff]">
          إعداد المنصة
        </Link>
      </div>
    </div>
  );
}
