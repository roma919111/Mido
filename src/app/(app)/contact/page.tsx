import type { Metadata } from "next";
import { LegalShell } from "@/components/veronix/LegalShell";

export const metadata: Metadata = {
  title: "تواصل معنا — Veronix.ai",
  description: "تواصل مع فريق دعم Veronix.ai.",
};

export default function ContactPage() {
  return (
    <LegalShell title="تواصل معنا">
      <p>
        نسعد بمساعدتك في الحساب، الدفع، أو مشاكل التوليد. راسلنا على البريد
        الرسمي وسنرد في أقرب وقت ممكن.
      </p>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-[#22f0ff]/80">
          البريد الرسمي
        </p>
        <a
          href="mailto:support@vyronix.app?subject=Veronix%20support"
          className="mt-2 inline-block text-lg font-semibold text-white hover:text-[#22f0ff]"
          dir="ltr"
        >
          support@vyronix.app
        </a>
        <p className="mt-3 text-sm text-white/45">
          الموقع:{" "}
          <a href="https://vyronix.app" className="text-[#22f0ff]" dir="ltr">
            https://vyronix.app
          </a>
        </p>
      </div>
      <p>
        عند المراسلة، اذكر بريد حسابك ووصفًا مختصرًا للمشكلة (مع لقطة شاشة إن
        أمكن) لنتمكن من المساعدة أسرع.
      </p>
    </LegalShell>
  );
}
