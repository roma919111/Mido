"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { CreateStudio } from "./CreateStudio";
import { SiteFooter } from "./SiteFooter";
import { fetchJson } from "@/lib/fetch-json";

export function VeronixApp() {
  const [user, setUser] = useState<CustomerUser | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await fetchJson<{ user: CustomerUser | null }>("/api/auth/customer/me");
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  async function logout() {
    await fetch("/api/auth/customer/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0b0d12] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 studio-backdrop" />
      <AppHeader user={user} onLogout={() => void logout()} />
      <main className="w-full pb-28">
        {/* Promo only — no create CTAs over the hero */}
        <section className="relative w-full overflow-hidden border-b border-white/8">
          <div className="relative mx-auto w-full max-w-6xl">
            <div className="relative aspect-[16/9] w-full sm:aspect-[21/9] sm:max-h-[420px]">
              <video
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                poster="/promo/poster.jpg"
                aria-label="Veronix.ai promotional action film"
              >
                <source src="/promo/veronix-action.mp4" type="video/mp4" />
              </video>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,13,18,0.05)_0%,rgba(11,13,18,0.25)_55%,rgba(11,13,18,0.88)_100%)]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-6 sm:pb-5" dir="rtl">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#22f0ff]/90 sm:text-xs">
                  Veronix.ai
                </p>
                <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Veronix
                </h1>
              </div>
            </div>
          </div>
        </section>

        {/* Combined create studio — image + video models together */}
        <section id="create" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6" dir="rtl">
            <p className="text-xs uppercase tracking-[0.22em] text-[#22f0ff]/80">إنشاء</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              استوديو الصور والفيديو
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              اختر صورة أو فيديو، ثم الموديل، واكتب وصفك.
            </p>
          </div>
          <CreateStudio user={user} onUserRefresh={refreshUser} />
        </section>
      </main>
      <div className="pb-24">
        <SiteFooter />
      </div>
      <BottomNav />
    </div>
  );
}
