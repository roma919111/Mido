"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { fetchJson } from "@/lib/fetch-json";
import { CANONICAL_HOST, CANONICAL_ORIGIN, GOOGLE_REDIRECT_URI } from "@/lib/site";

export function DomainSetupPage() {
  const [appBaseUrl, setAppBaseUrl] = useState(CANONICAL_ORIGIN);
  const [redirectUri, setRedirectUri] = useState(GOOGLE_REDIRECT_URI);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await fetchJson<{
          appBaseUrl?: string;
          redirectUri?: string;
        }>("/api/auth/google/status");
        setAppBaseUrl(data.appBaseUrl || CANONICAL_ORIGIN);
        setRedirectUri(data.redirectUri || GOOGLE_REDIRECT_URI);
      } catch {
        /* keep defaults */
      }
    })();
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

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-10 text-white" dir="rtl">
      <BrandLogo size="lg" />
      <h1 className="mt-6 font-display text-2xl font-bold">تثبيت الدومين</h1>
      <p className="mt-2 text-sm text-white/50">
        الدومين الثابت للمنصة:{" "}
        <span className="text-white" dir="ltr">
          {CANONICAL_HOST}
        </span>
        . بعد الربط مرة واحدة، Google و Stripe ما يحتاجون يتحدثون كل ما تغيّر التانل.
      </p>

      <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
        <p className="font-semibold">مثبّت في التطبيق ✓</p>
        <p className="mt-1 text-emerald-100/80" dir="ltr">
          APP_BASE_URL = {appBaseUrl}
        </p>
        <p className="mt-1 break-all text-emerald-100/70" dir="ltr">
          Google redirect = {redirectUri}
        </p>
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm">
        <p className="font-semibold">1) Google Console — مرة واحدة فقط</p>
        <p className="text-white/65">
          افتح نفس OAuth Client وأضف هذا Redirect URI (لا تنشئ Client جديد):
        </p>
        <code className="mt-2 block break-all rounded-xl bg-black/40 p-3 text-left text-xs text-[#22f0ff]" dir="ltr">
          {GOOGLE_REDIRECT_URI}
        </code>
        <button
          type="button"
          onClick={() => void copy(GOOGLE_REDIRECT_URI, "google")}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5"
        >
          {copied === "google" ? "تم النسخ ✓" : "نسخ Redirect URI"}
        </button>
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm">
        <p className="font-semibold">2) Cloudflare — ربط الدومين بالتطبيق</p>
        <p className="text-white/65">
          حالياً{" "}
          <span dir="ltr" className="text-white/90">
            veronix.ai
          </span>{" "}
          يفتح صفحة تعريف أخرى. عشان التطبيق يفتح على الدومين الثابت، من حساب Cloudflare:
        </p>
        <ol className="list-decimal space-y-2 pr-5 text-white/70">
          <li>
            Zero Trust → Networks → Tunnels → Create a tunnel اسمه{" "}
            <span dir="ltr">veronix-app</span>
          </li>
          <li>
            Public Hostname:
            <ul className="mt-1 list-disc pr-5">
              <li dir="ltr">
                Subdomain: (فارغ) أو <code>www</code>
              </li>
              <li dir="ltr">
                Domain: <code>{CANONICAL_HOST}</code>
              </li>
              <li dir="ltr">
                Service: <code>http://localhost:3000</code>
              </li>
            </ul>
          </li>
          <li>ثبّت الـ connector على السيرفر اللي يشغّل Veronix وشغّل التانل</li>
        </ol>
        <p className="text-xs text-amber-200/80">
          ملاحظة: لو تبي تبقي الصفحة التعريفية على الجذر، استخدم{" "}
          <span dir="ltr">app.veronix.ai</span> بدل الجذر وغيّر APP_BASE_URL لها.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/setup/google" className="text-[#22f0ff]">
          إعداد Google
        </Link>
        <span className="text-white/30">·</span>
        <Link href="/login" className="text-[#22f0ff]">
          تسجيل الدخول
        </Link>
        <span className="text-white/30">·</span>
        <Link href="/" className="text-white/45">
          الواجهة
        </Link>
      </div>
    </div>
  );
}
