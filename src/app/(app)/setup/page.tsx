import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export const dynamic = "force-dynamic";

const LINKS = [
  {
    href: "/setup/stripe",
    title: "Stripe — الدفع",
    body: "اربط المفاتيح هنا قبل أي ترقية أو شحن كريدت. بدونها لن يُضاف رصيد.",
    priority: true,
  },
  {
    href: "/setup/openart",
    title: "منصة التوليد",
    body: "ربط حساب التوليد للمنصة (صور وفيديو).",
  },
  {
    href: "/setup/google",
    title: "Google Login",
    body: "تسجيل الدخول بحساب Google للزبائن.",
  },
  {
    href: "/setup/domain",
    title: "النطاق",
    body: "إعدادات الدومين العام vyronix.app.",
  },
] as const;

export default function SetupHubPage() {
  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-10 text-white" dir="rtl">
      <BrandLogo size="lg" />
      <h1 className="mt-6 font-display text-3xl font-extrabold">إعداد المنصة</h1>
      <p className="mt-2 text-sm text-white/55">
        فعّل الخدمات من هنا. الدفع والترقية لا يشتغلان إلا بعد ربط Stripe.
      </p>

      <div className="mt-8 space-y-3">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-2xl border px-4 py-4 transition hover:border-[#22f0ff]/40 ${
              "priority" in item && item.priority
                ? "border-[#22f0ff]/45 bg-[rgba(34,240,255,0.1)]"
                : "border-white/10 bg-[#141821]"
            }`}
          >
            <p className="font-semibold text-white">{item.title}</p>
            <p className="mt-1 text-sm text-white/55">{item.body}</p>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-white/35">
        <Link href="/pricing" className="text-[#22f0ff]">
          العودة للباقات
        </Link>
      </p>
    </div>
  );
}
