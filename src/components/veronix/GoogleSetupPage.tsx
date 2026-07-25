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
  const [appBaseUrl, setAppBaseUrl] = useState("");
  const [configured, setConfigured] = useState(false);
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await fetchJson<{
        configured?: boolean;
        redirectUri?: string;
        appBaseUrl?: string;
      }>("/api/auth/google/status");
      const isConfigured = Boolean(data.configured);
      setConfigured(isConfigured);
      setRedirectUri(data.redirectUri || "");
      setAppBaseUrl(data.appBaseUrl || "");
      // Only show Client ID/Secret form when not configured yet
      setShowCredentialForm(!isConfigured);
    })();
  }, []);

  async function copyRedirectUri() {
    if (!redirectUri) return;
    try {
      await navigator.clipboard.writeText(redirectUri);
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
      setShowCredentialForm(false);
      setMessage(
        data.message ||
          "تم الحفظ. المفاتيح محفوظة مرة واحدة — لا تحتاج تعيد لصقها. فقط حدّث Redirect URI في Google إذا تغيّر رابط الموقع.",
      );
      setClientSecret("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-10 text-white" dir="rtl">
      <BrandLogo size="lg" />
      <h1 className="mt-6 font-display text-2xl font-bold">إعداد Google Sign-In</h1>

      {configured ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          <p className="font-semibold">المفاتيح محفوظة بالفعل ✓</p>
          <p className="mt-1 text-emerald-100/80">
            Client ID و Client Secret موجودين — ما تحتاج تعيد إدخالهم كل مرة.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-white/50">
          خطوة واحدة: أنشئ OAuth Client في Google والصق المفتاحين هنا. بعد الحفظ تبقى محفوظة.
        </p>
      )}

      <div className="mt-6 space-y-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
        <p className="font-semibold text-amber-100">ليش يطلب منك شيء كل مرة؟</p>
        <p className="text-amber-50/85">
          مو لأن المفاتيح ضاعت. رابط الموقع الحالي مؤقت (
          <span dir="ltr" className="text-amber-100">
            *.trycloudflare.com
          </span>
          ). كل ما يتغيّر الرابط، Google يرفض تسجيل الدخول إلا إذا أضفت الـ Redirect URI الجديد في
          Console — بدون إعادة لصق Client ID/Secret.
        </p>
        {appBaseUrl ? (
          <p className="text-xs text-amber-100/60" dir="ltr">
            Current site: {appBaseUrl}
          </p>
        ) : null}
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm">
        <p className="font-semibold text-white">
          {configured ? "اللي تحتاجه الآن فقط" : "1) Google Cloud Console"}
        </p>
        <ol className="list-decimal space-y-2 pr-5 text-white/70">
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
          <li>
            {configured
              ? "افتح نفس OAuth Client اللي سويته قبل — لا تنشئ واحد جديد"
              : "Create Credentials → OAuth client ID → Application type: Web application"}
          </li>
          <li>
            في Authorized redirect URIs أضف بالضبط:
            <code
              className="mt-2 block break-all rounded-xl bg-black/40 p-3 text-left text-xs text-[#22f0ff]"
              dir="ltr"
            >
              {redirectUri || "…loading"}
            </code>
            <button
              type="button"
              onClick={() => void copyRedirectUri()}
              className="mt-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5"
            >
              {copied ? "تم النسخ ✓" : "نسخ Redirect URI"}
            </button>
          </li>
          {!configured && <li>انسخ Client ID و Client Secret والصقهما بالأسفل</li>}
        </ol>
      </div>

      {configured && !showCredentialForm ? (
        <div className="mt-6 space-y-3">
          {message && <p className="text-sm text-cyan-200">{message}</p>}
          <p className="text-sm text-white/55">
            بعد ما تضيف الـ Redirect URI أعلاه في Google Console، سجّل دخول العملاء يشتغل عبر Google
            بدون أي إعداد إضافي هنا.
          </p>
          <button
            type="button"
            onClick={() => setShowCredentialForm(true)}
            className="text-sm text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
          >
            تغيير Client ID / Secret (نادرًا تحتاجها)
          </button>
        </div>
      ) : (
        <form onSubmit={save} className="mt-6 space-y-3">
          {configured ? (
            <p className="text-xs text-white/45">
              المفاتيح الحالية شغّالة. عبّي الحقول فقط إذا تبي تستبدلها بمفاتيح جديدة.
            </p>
          ) : null}
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="GOOGLE_CLIENT_ID"
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            dir="ltr"
          />
          <input
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="GOOGLE_CLIENT_SECRET"
            required
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
            disabled={saving}
            className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] py-3 text-sm font-semibold"
          >
            {saving ? "Saving…" : configured ? "تحديث المفاتيح" : "حفظ وتفعيل Google"}
          </button>
          {configured ? (
            <button
              type="button"
              onClick={() => setShowCredentialForm(false)}
              className="w-full text-sm text-white/40"
            >
              إلغاء
            </button>
          ) : null}
        </form>
      )}

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/login" className="text-[#22f0ff]">
          الذهاب لتسجيل الدخول
        </Link>
        <span className="text-white/30">·</span>
        <span className={configured ? "text-emerald-300" : "text-amber-200"}>
          {configured ? "Google configured ✓" : "Not configured yet"}
        </span>
      </div>
    </div>
  );
}
