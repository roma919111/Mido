import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const LINKS = [
  { href: "/about", label: "عن Veronix" },
  { href: "/contact", label: "تواصل معنا" },
  { href: "/privacy", label: "الخصوصية" },
  { href: "/terms", label: "الشروط" },
  { href: "/pricing", label: "الباقات" },
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/8 bg-[rgba(7,9,13,0.92)]">
      <div
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6"
        dir="rtl"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <BrandLogo size="sm" />
            <p className="max-w-md text-sm leading-relaxed text-white/45">
              منصة Veronix.ai لتوليد الصور والفيديو بالذكاء الاصطناعي — حسابات
              زبائن، محفظة كريدت، ودفع آمن عبر Stripe.
            </p>
            <a
              href="mailto:support@vyronix.app"
              className="inline-block text-sm text-[#22f0ff]/90 hover:text-[#22f0ff]"
              dir="ltr"
            >
              support@vyronix.app
            </a>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/55">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-xs text-white/30">
          © {new Date().getFullYear()} Veronix.ai · vyronix.app · جميع الحقوق
          محفوظة.
        </p>
      </div>
    </footer>
  );
}
