import type { Metadata } from "next";
import { LegalShell } from "@/components/veronix/LegalShell";

export const metadata: Metadata = {
  title: "عن Veronix.ai",
  description: "تعرّف على منصة Veronix.ai لاستوديو الصور والفيديو بالذكاء الاصطناعي.",
};

export default function AboutPage() {
  return (
    <LegalShell title="عن Veronix.ai">
      <p>
        <strong className="text-white">Veronix.ai</strong> استوديو عربي لتوليد
        الصور والفيديو بالذكاء الاصطناعي على الدومين الرسمي{" "}
        <span dir="ltr">https://vyronix.app</span>.
      </p>
      <p>
        نقدّم حسابات زبائن، محفظة كريدت، باقات شهرية، وتجربة إنشاء مباشرة من
        المتصفح — مع دفع آمن عبر Stripe وتسجيل اختياري عبر Google.
      </p>
      <h2 className="pt-2 text-base font-semibold text-white">ما يميزنا</h2>
      <ul className="list-disc space-y-1 pr-5">
        <li>واجهة عربية واضحة لإنشاء الصور والفيديو.</li>
        <li>تسعير بالكريدت شفاف قبل التوليد.</li>
        <li>تجربة مجانية محدودة لأول فيديو Veronix وفق الشروط المعروضة.</li>
        <li>استضافة إنتاج دائمة على بنية تحتية سحابية مع نطاق مخصص.</li>
      </ul>
      <h2 className="pt-2 text-base font-semibold text-white">التواصل الرسمي</h2>
      <p>
        البريد:{" "}
        <a className="text-[#22f0ff]" href="mailto:support@vyronix.app" dir="ltr">
          support@vyronix.app
        </a>
      </p>
      <p>
        الموقع:{" "}
        <a className="text-[#22f0ff]" href="https://vyronix.app" dir="ltr">
          https://vyronix.app
        </a>
      </p>
    </LegalShell>
  );
}
