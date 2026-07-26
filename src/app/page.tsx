import type { Metadata } from "next";
import { VeronixApp } from "@/components/veronix/VeronixApp";

export const metadata: Metadata = {
  title: {
    absolute: "Veronix.ai — استوديو الصور والفيديو بالذكاء الاصطناعي",
  },
  description:
    "أنشئ صورًا وفيديوهات بالذكاء الاصطناعي على Veronix.ai. حسابات زبائن، كريدت، باقات شهرية، ودفع آمن عبر Stripe على vyronix.app.",
  alternates: { canonical: "https://vyronix.app/" },
  openGraph: {
    title: "Veronix.ai — استوديو الصور والفيديو",
    description:
      "منصة عربية لتوليد الصور والفيديو بالذكاء الاصطناعي على vyronix.app",
    url: "https://vyronix.app/",
  },
};

export default function HomePage() {
  return (
    <>
      {/* Server-rendered crawlable content for Google (complements the client studio UI). */}
      <section className="sr-only" aria-hidden={false}>
        <h1>Veronix.ai — استوديو الصور والفيديو بالذكاء الاصطناعي</h1>
        <p>
          Veronix.ai منصة رسمية على vyronix.app لتوليد الصور والفيديو بالذكاء
          الاصطناعي. سجّل حسابك، اختر الموديل، واكتب وصفك، وادفع بأمان عبر Stripe.
        </p>
        <ul>
          <li>توليد صور وفيديو بالذكاء الاصطناعي</li>
          <li>محفظة كريدت وباقات شهرية</li>
          <li>تسجيل دخول Google ودعم عربي</li>
          <li>صفحة التسعير والخصوصية والشروط والدعم</li>
        </ul>
        <a href="/pricing">الباقات والأسعار</a>
        <a href="/about">عن Veronix</a>
        <a href="/faq">الأسئلة الشائعة</a>
        <a href="/contact">تواصل معنا</a>
      </section>
      <VeronixApp />
    </>
  );
}
