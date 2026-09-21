"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpen,
  Home,
  Scissors,
  Sparkles,
  Wrench,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useLocale } from "@/components/veronix/LocaleProvider";

const LANDING_PATH = "/landing";

type NavItem = {
  id: string;
  label: (t: ReturnType<typeof useLocale>["t"]) => string;
  icon: typeof Home;
};

const NAV: NavItem[] = [
  { id: "home", label: (t) => t.nav.home, icon: Home },
  { id: "editing", label: (t) => t.nav.editing, icon: Scissors },
  { id: "create", label: (t) => t.nav.create, icon: Sparkles },
  { id: "tools", label: (t) => t.nav.tools, icon: Wrench },
  { id: "assets", label: (t) => t.nav.assets, icon: FolderOpen },
];

export function LandingExperimentApp() {
  const pathname = usePathname();
  const { t, dir } = useLocale();
  const onLanding = pathname === LANDING_PATH || pathname.startsWith(`${LANDING_PATH}/`);

  return (
    <div className="relative min-h-screen bg-[#080a10] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,240,255,0.12),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(124,92,255,0.08),transparent)]"
      />

      <div className="flex min-h-screen">
        <aside
          className="fixed inset-y-0 left-0 z-40 flex w-[15.5rem] flex-col border-r border-white/10 bg-[#0b0d12]/95 backdrop-blur-md"
          aria-label={dir === "rtl" ? "قائمة تجريبية" : "Experimental menu"}
        >
          <div className="border-b border-white/8 px-4 py-5">
            <BrandLogo size="sm" />
            <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-2 text-[11px] leading-snug text-amber-100/90">
              {dir === "rtl"
                ? "مساحة تجربة — التصميم هنا لا يؤثر على الموقع الحالي."
                : "Experiment sandbox — changes here do not affect the live home page."}
            </p>
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-3">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = item.id === "home" && onLanding;
              const label = item.label(t);

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.id !== "home"}
                  title={
                    item.id !== "home"
                      ? dir === "rtl"
                        ? "سنربطها لاحقاً أثناء التصميم"
                        : "Will wire up during design iteration"
                      : undefined
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-[linear-gradient(135deg,rgba(124,92,255,0.35),rgba(34,240,255,0.2))] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                      : item.id === "home"
                        ? "text-white/70 hover:bg-white/5 hover:text-white"
                        : "cursor-not-allowed text-white/35"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-[1.15rem] w-[1.15rem] shrink-0 opacity-90" aria-hidden />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/8 p-3">
            <Link
              href="/"
              className="flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10"
            >
              {dir === "rtl" ? "← العودة للموقع الحالي" : "← Back to current site"}
            </Link>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col pl-[15.5rem]">
          <header className="sticky top-0 z-30 border-b border-white/8 bg-[#080a10]/80 px-6 py-4 backdrop-blur-md">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#22f0ff]/80">
              {dir === "rtl" ? "لاندينغ تجريبي" : "Landing preview"}
            </p>
            <h1 className="mt-1 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
              {dir === "rtl" ? "واجهة رئيسية — مسودة" : "Home UI — draft"}
            </h1>
          </header>

          <main className="flex-1 px-6 py-8" dir={dir}>
            <section className="mx-auto max-w-4xl">
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-8 text-center sm:p-12">
                <p className="text-sm text-white/45">
                  {dir === "rtl" ? "منطقة المحتوى الرئيسي" : "Main content area"}
                </p>
                <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/65">
                  {dir === "rtl"
                    ? "القائمة على اليسار (ثابتة بصرياً). أخبرني بالتخطيط والألوان والأقسام التي تريدها وسأطبّقها هنا قبل نقلها للصفحة الرئيسية."
                    : "Left rail menu (visual left). Tell me layout, colors, and sections to build here first—before we ship to the production home page."}
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    dir === "rtl" ? "Hero / بانر" : "Hero",
                    dir === "rtl" ? "استوديو سريع" : "Quick studio",
                    dir === "rtl" ? "معرض / خلاصة" : "Gallery / feed",
                  ].map((label) => (
                    <div
                      key={label}
                      className="rounded-xl border border-white/10 bg-[#0f1219] px-4 py-10 text-xs uppercase tracking-wider text-white/30"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
