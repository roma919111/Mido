"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { fetchJson } from "@/lib/fetch-json";
import { GOOGLE_REDIRECT_URI, PREVIEW_HOST, PREVIEW_ORIGIN } from "@/lib/site";

export function DomainSetupPage() {
  const [appBaseUrl, setAppBaseUrl] = useState(PREVIEW_ORIGIN);
  const [redirectUri, setRedirectUri] = useState(GOOGLE_REDIRECT_URI);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await fetchJson<{
          appBaseUrl?: string;
          redirectUri?: string;
        }>("/api/auth/google/status");
        setAppBaseUrl(data.appBaseUrl || PREVIEW_ORIGIN);
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
      <h1 className="mt-6 font-display text-2xl font-bold">رابط التجربة الدائم</h1>
      <p className="mt-2 text-sm text-white/50">
        ما تحتاج تشتري دومين الآن. عندك رابط مجاني ثابت باسم{" "}
        <span className="text-white" dir="ltr">
          VYRONIX
        </span>{" "}
        تختبر فيه كل شيء، وبعدين لما تشتري دومين نغيّر سطر واحد فقط.
      </p>

      <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
        <p className="font-semibold">رابطك الحالي ✓</p>
        <p className="mt-1 break-all font-medium" dir="ltr">
          {appBaseUrl}
        </p>
        <button
          type="button"
          onClick={() => void copy(appBaseUrl, "url")}
          className="mt-2 rounded-lg border border-emerald-300/30 px-3 py-1.5 text-xs text-emerald-50 hover:bg-emerald-400/10"
        >
          {copied === "url" ? "تم النسخ ✓" : "نسخ الرابط"}
        </button>
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm">
        <p className="font-semibold">كيف يظل نفس الاسم؟</p>
        <ul className="list-disc space-y-2 pr-5 text-white/70">
          <li>
            التانل يشتغل بـ subdomain ثابت:{" "}
            <span dir="ltr" className="text-white/90">
              {PREVIEW_HOST}
            </span>
          </li>
          <li>كل ما نعيد تشغيل التانل بنفس الاسم، الرابط يرجع نفسه</li>
          <li>أول زيارة من المتصفح قد تطلب تأكيد بسيط من loca.lt — مرة واحدة ثم يكمل</li>
        </ul>
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm">
        <p className="font-semibold">Google — مرة واحدة على رابط التجربة</p>
        <p className="text-white/65">أضف هذا في Authorized redirect URIs:</p>
        <code
          className="mt-2 block break-all rounded-xl bg-black/40 p-3 text-left text-xs text-[#22f0ff]"
          dir="ltr"
        >
          {redirectUri}
        </code>
        <button
          type="button"
          onClick={() => void copy(redirectUri, "google")}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5"
        >
          {copied === "google" ? "تم النسخ ✓" : "نسخ Redirect URI"}
        </button>
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
        <p className="font-semibold text-amber-100">لما تشتري دومين لاحقًا</p>
        <ol className="list-decimal space-y-2 pr-5 text-amber-50/85">
          <li>
            غيّر <span dir="ltr">APP_BASE_URL</span> للدومين الجديد
          </li>
          <li>أضف Redirect URI الجديد مرة واحدة في Google Console</li>
          <li>اربط الدومين بالسيرفر (Cloudflare / Vercel) — وخلاص</li>
        </ol>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <a href={appBaseUrl} className="text-[#22f0ff]" target="_blank" rel="noreferrer">
          فتح الرابط
        </a>
        <span className="text-white/30">·</span>
        <Link href="/setup/google" className="text-[#22f0ff]">
          إعداد Google
        </Link>
        <span className="text-white/30">·</span>
        <Link href="/signup" className="text-[#22f0ff]">
          إنشاء حساب
        </Link>
      </div>
    </div>
  );
}
