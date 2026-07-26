import type { Metadata } from "next";
import { LegalShell } from "@/components/veronix/LegalShell";

export const metadata: Metadata = {
  title: "الأسئلة الشائعة",
  description:
    "إجابات عن Veronix.ai: التوليد بالذكاء الاصطناعي، الكريدت، الاشتراكات، والدفع عبر Stripe.",
  alternates: { canonical: "https://vyronix.app/faq" },
};

const FAQS = [
  {
    q: "ما هو Veronix.ai؟",
    a: "Veronix.ai منصة على vyronix.app لتوليد الصور والفيديو بالذكاء الاصطناعي مع حساب زبائن ومحفظة كريدت.",
  },
  {
    q: "هل يوجد فيديو مجاني؟",
    a: "نعم، أول فيديو Veronix مجاني مرة واحدة لكل حساب: مقدمة Veronix في البداية ثم 4 ثوانٍ مولّدة بدقة 480p مع الصوت. لمشاهدة النتيجة داخل حسابك اضغط تشغيل وسجّل إن لم تكن مسجّلًا.",
  },
  {
    q: "كيف أدفع؟",
    a: "الدفع يتم بأمان عبر Stripe للباقات الشهرية وشحن الكريدت.",
  },
  {
    q: "هل أحتاج تسجيل دخول؟",
    a: "نعم لإنشاء المحتوى وحفظ الأصول وإدارة الرصيد. يمكن التسجيل بالبريد أو Google.",
  },
  {
    q: "أين أتواصل مع الدعم؟",
    a: "راسلنا على support@vyronix.app أو عبر صفحة تواصل معنا.",
  },
];

export default function FaqPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <LegalShell title="الأسئلة الشائعة">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {FAQS.map((item) => (
        <section key={item.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-base font-semibold text-white">{item.q}</h2>
          <p className="mt-2 text-white/65">{item.a}</p>
        </section>
      ))}
    </LegalShell>
  );
}
