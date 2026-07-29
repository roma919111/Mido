"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { fetchJson } from "@/lib/fetch-json";

export function DomainSetupPage() {
  const [appBaseUrl, setAppBaseUrl] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await fetchJson<{
          appBaseUrl?: string;
          redirectUri?: string;
        }>("/api/auth/google/status");
        setAppBaseUrl(data.appBaseUrl || "");
        setRedirectUri(data.redirectUri || "");
      } catch {
        /* ignore */
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
      <h1 className="mt-6 font-display text-2xl font-bold">رابط دائم (مرّة واحدة وخلاص)</h1>
      <p className="mt-2 text-sm text-white/50">
        روابط <span dir="ltr">*.trycloudflare.com</span> مؤقتة وتموت. عشان ما تعيد Google/Stripe كل
        مرة، تحتاج رابط ثابت.
      </p>

      {appBaseUrl ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-[#141821] px-4 py-3 text-sm">
          <p className="text-white/50">الرابط الحالي (مؤقت)</p>
          <p className="mt-1 break-all text-[#22f0ff]" dir="ltr">
            {appBaseUrl}
          </p>
          {redirectUri ? (
            <>
              <p className="mt-3 text-white/50">Google Callback الحالي</p>
              <code className="mt-1 block break-all text-xs text-white/70" dir="ltr">
                {redirectUri}
              </code>
              <button
                type="button"
                onClick={() => void copy(redirectUri, "g")}
                className="mt-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs"
              >
                {copied === "g" ? "تم النسخ ✓" : "نسخ"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 space-y-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-50">
        <p className="font-semibold text-emerald-100">الخيار الأفضل (دائم)</p>
        <ol className="list-decimal space-y-2 pr-5 text-emerald-50/90">
          <li>
            اشتري دومين رخيص (مثل <span dir="ltr">vyronix.app</span> /{" "}
            <span dir="ltr">vyronix.store</span>) من Namecheap أو Cloudflare Registrar
          </li>
          <li>اربطه على Cloudflare (DNS)</li>
          <li>
            سوّ Named Tunnel ثابت في Cloudflare → Hostname = الدومين → Service ={" "}
            <span dir="ltr">http://localhost:3000</span>
          </li>
          <li>
            حط في التطبيق: <span dir="ltr">APP_BASE_URL=https://your-domain.com</span>
          </li>
          <li>
            Google Callback مرّة واحدة:{" "}
            <span dir="ltr">https://your-domain.com/api/auth/google/callback</span>
          </li>
        </ol>
        <p className="text-xs text-emerald-100/80">
          Stripe Webhook عندنا يتحدث تلقائيًا لما نقفّل الرابط الجديد — ما تحتاج تعيد Webhook يدويًا.
        </p>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4 text-sm">
        <p className="font-semibold">بديل مجاني (شبه دائم)</p>
        <p className="text-white/65">
          انشر على Vercel واحصل على <span dir="ltr">https://vyronix-ai.vercel.app</span> — الاسم
          ما يتغيّر. بعد النشر نحدّث Google Callback مرّة واحدة فقط.
        </p>
        <p className="text-xs text-amber-200/80">
          ملاحظة: التطبيق يستخدم ملفات محلية (`.data`)؛ للنشر الدائم الأفضل دومين + سيرفر/تانل ثابت،
          مو serverless فقط.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/setup/stripe" className="text-[#22f0ff]">
          Stripe
        </Link>
        <span className="text-white/30">·</span>
        <Link href="/setup/google" className="text-[#22f0ff]">
          Google
        </Link>
        <span className="text-white/30">·</span>
        <Link href="/" className="text-white/45">
          الواجهة
        </Link>
      </div>
    </div>
  );
}
