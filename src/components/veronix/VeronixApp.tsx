"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard, ImageIcon } from "lucide-react";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
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
    <div className="relative min-h-screen bg-[#0b0d12] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 studio-backdrop" />
      <AppHeader user={user} onLogout={() => void logout()} />
      <main className="pb-28">
        <section className="relative w-full overflow-hidden">
          <div className="relative aspect-[16/10] max-h-[70vh] w-full sm:aspect-[21/9]">
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
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,13,18,0.15)_0%,rgba(11,13,18,0.35)_45%,rgba(11,13,18,0.92)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 px-4 pb-8 pt-16 sm:px-8" dir="rtl">
              <div className="mx-auto max-w-3xl">
                <p className="text-xs uppercase tracking-[0.28em] text-[#22f0ff]/90">Veronix.ai</p>
                <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                  Veronix
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
                  استوديو توليد الصور والفيديو بالذكاء الاصطناعي — أكشن، سرعة، وجودة سينمائية.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/create/video"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-5 py-3 text-sm font-semibold text-white"
                  >
                    <Clapperboard className="h-4 w-4" />
                    إنشاء فيديو
                  </Link>
                  <Link
                    href="/create/image"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur"
                  >
                    <ImageIcon className="h-4 w-4" />
                    إنشاء صورة
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
