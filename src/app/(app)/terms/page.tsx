import type { Metadata } from "next";
import { LegalShell } from "@/components/veronix/LegalShell";

export const metadata: Metadata = {
  title: "شروط الاستخدام — Veronix.ai",
  description: "شروط استخدام منصة Veronix.ai لتوليد الصور والفيديو.",
};

export default function TermsPage() {
  return (
    <LegalShell title="شروط الاستخدام">
      <p>آخر تحديث: 26 يوليو 2026</p>
      <p>
        باستخدامك لموقع <span dir="ltr">vyronix.app</span> فإنك توافق على هذه
        الشروط.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">الخدمة</h2>
      <p>
        Veronix.ai منصة لتوليد الصور والفيديو بالذكاء الاصطناعي عبر حساب مدفوع
        بالكريدت/الاشتراك. قد تتغير الموديلات والأسعار والحدود التقنية مع الوقت.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">الحساب والاستخدام المقبول</h2>
      <ul className="list-disc space-y-1 pr-5">
        <li>أنت مسؤول عن نشاط حسابك ومحتوى الأوامر التي ترسلها.</li>
        <li>يُمنع استخدام الخدمة لأنشطة غير قانونية أو ضارة أو مخادعة.</li>
        <li>يُمنع محاولة اختراق المنصة أو إساءة استهلاك الموارد.</li>
      </ul>
      <h2 className="pt-2 text-base font-semibold text-white">الكريدت والدفع</h2>
      <p>
        الكريدت يُخصم عند التوليد الناجح حسب التسعير المعروض. المدفوعات تتم عبر
        Stripe. الكريدت المصروف لا يُعاد إلا وفق سياسة الاسترجاع المعلنة أو عند
        فشل تقني واضح من جانبنا.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">الملكية الفكرية</h2>
      <p>
        تتحمل مسؤولية أن أوامرك ومراجعك لا تنتهك حقوق الغير. علامات Veronix
        التجارية ومحتوى المنصة محفوظة لنا.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">إخلاء المسؤولية</h2>
      <p>
        نقدّم الخدمة «كما هي». قد تفشل بعض عمليات التوليد أو تتأخر بسبب مزوّدين
        خارجيين. لا نضمن نتائج إبداعية محددة.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">التواصل</h2>
      <p>
        <a className="text-[#22f0ff]" href="mailto:support@vyronix.app" dir="ltr">
          support@vyronix.app
        </a>
      </p>
    </LegalShell>
  );
}
