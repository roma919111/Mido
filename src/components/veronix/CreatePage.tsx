"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { CreateStudio } from "./CreateStudio";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { fetchJson } from "@/lib/fetch-json";

export function CreatePage({ media }: { media: "image" | "video" }) {
  const { t, dir } = useLocale();
  const [user, setUser] = useState<CustomerUser | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await fetchJson<{ user: CustomerUser | null }>(
        "/api/auth/customer/me",
      );
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

  const title = media === "video" ? t.create.videoTitle : t.create.imageTitle;
  const subtitle = media === "video" ? t.create.videoSub : t.create.imageSub;

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#0b0d12] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 studio-backdrop" />
      <AppHeader compact user={user} onLogout={() => void logout()} />
      <main className="pb-[calc(6.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <section className="mx-auto max-w-3xl px-4 pt-3 sm:px-6 sm:pt-6" dir={dir}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#22f0ff]/80 sm:text-xs sm:tracking-[0.22em]">
            {t.home.studioEyebrow}
          </p>
          <h1 className="mt-1 font-display text-xl font-extrabold leading-tight tracking-tight sm:mt-2 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-white/55 sm:mt-2 sm:text-sm">
            {subtitle}
          </p>
        </section>
        <CreateStudio
          user={user}
          onUserRefresh={refreshUser}
          lockedMedia={media}
        />
      </main>
      <BottomNav />
    </div>
  );
}
