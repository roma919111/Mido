import type { Metadata } from "next";
import { LegalShell } from "@/components/veronix/LegalShell";

export const metadata: Metadata = {
  title: "سياسة الخصوصية — Veronix.ai",
  description: "كيف تجمع Veronix.ai بياناتك وتستخدمها وتحميها.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="سياسة الخصوصية">
      <p>آخر تحديث: 26 يوليو 2026</p>
      <p>
        تشغيل خدمة Veronix.ai يتم عبر الموقع{" "}
        <span dir="ltr">https://vyronix.app</span>. نحن نحترم خصوصيتك ونوضح هنا
        ما نجمعه ولماذا.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">البيانات التي نجمعها</h2>
      <ul className="list-disc space-y-1 pr-5">
        <li>بيانات الحساب: الاسم، البريد، ومعرّف Google عند تسجيل الدخول.</li>
        <li>بيانات الاستخدام: الأوامر، الموديلات، والأصول المُولَّدة داخل حسابك.</li>
        <li>بيانات الدفع: تُعالَج عبر Stripe؛ لا نخزّن أرقام البطاقات لدينا.</li>
        <li>بيانات تقنية أساسية مثل الجلسة والكوكيز اللازمة لتشغيل الحساب.</li>
      </ul>
      <h2 className="pt-2 text-base font-semibold text-white">كيف نستخدم البيانات</h2>
      <ul className="list-disc space-y-1 pr-5">
        <li>تشغيل الاستوديو ومحفظة الكريدت والاشتراكات.</li>
        <li>تنفيذ عمليات التوليد عبر مزوّدي الذكاء الاصطناعي المعتمدين.</li>
        <li>الأمان، منع الإساءة، والدعم الفني.</li>
      </ul>
      <h2 className="pt-2 text-base font-semibold text-white">المشاركة مع أطراف ثالثة</h2>
      <p>
        قد تُعالَج بعض البيانات لدى Stripe (الدفع) وGoogle (تسجيل الدخول) ومزوّد
        التوليد OpenArt لتنفيذ طلبك فقط. لا نبيع بياناتك الشخصية.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">التواصل</h2>
      <p>
        للاستفسارات حول الخصوصية:{" "}
        <a className="text-[#22f0ff]" href="mailto:support@vyronix.app" dir="ltr">
          support@vyronix.app
        </a>
      </p>
    </LegalShell>
  );
}
