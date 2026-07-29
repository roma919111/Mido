import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export const dynamic = "force-dynamic";

/** OpenArt setup retired — generation is BytePlus-only via BYTEPLUS_API_KEY. */
export default function RetiredOpenArtSetupPage() {
  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-10 text-white" dir="rtl">
      <BrandLogo size="lg" />
      <h1 className="mt-6 font-display text-3xl font-extrabold">OpenArt لم يعد مستخدماً</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/60">
        التوليد يعتمد على BytePlus ModelArk فقط. ضع{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 text-[#22f0ff]">BYTEPLUS_API_KEY</code>{" "}
        في إعدادات السيرفر ثم أعد التشغيل.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/setup"
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80"
        >
          العودة للإعداد
        </Link>
        <Link
          href="/create/video"
          className="rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-2 text-sm font-semibold text-white"
        >
          استوديو الفيديو
        </Link>
      </div>
    </div>
  );
}
