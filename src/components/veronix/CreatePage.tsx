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
    <div className="relative min-h-screen bg-[#0b0d12] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 studio-backdrop" />
      <AppHeader user={user} onLogout={() => void logout()} />
      <main>
        <section className="mx-auto max-w-3xl px-4 pt-6 sm:px-6" dir={dir}>
          <p className="text-xs uppercase tracking-[0.22em] text-[#22f0ff]/80">
            {t.home.studioEyebrow}
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
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
