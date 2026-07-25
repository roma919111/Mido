"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { fetchJson } from "@/lib/fetch-json";

interface AssetItem {
  id: string;
  mediaType: "image" | "video";
  url: string;
  prompt: string;
  model: string;
  creditsUsed: number;
  status: string;
  createdAt: string;
  historyId?: string;
  error?: string;
}

export function AssetsPage() {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "video" | "image">("all");

  const loadAssets = useCallback(async () => {
    const me = await fetchJson<{ user: CustomerUser | null }>("/api/auth/customer/me");
    setUser(me.data.user);
    if (!me.data.user) {
      setError("سجّل الدخول لعرض ملفاتك.");
      return;
    }
    const { res, data } = await fetchJson<{ assets?: AssetItem[]; error?: string }>(
      "/api/assets",
    );
    if (!res.ok) {
      setError(data.error || "Failed to load assets");
      return;
    }
    setError(null);
    setAssets(data.assets || []);
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  // Keep polling while any asset is still running so customers retain completed media.
  useEffect(() => {
    const hasRunning = assets.some((a) => a.status === "running");
    if (!hasRunning || !user) return;
    const t = window.setInterval(() => {
      void loadAssets();
    }, 8000);
    return () => window.clearInterval(t);
  }, [assets, user, loadAssets]);

  const visible = assets.filter((a) => filter === "all" || a.mediaType === filter);

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <AppHeader
        user={user}
        onLogout={() => {
          void fetch("/api/auth/customer/logout", { method: "POST" }).then(() => {
            setUser(null);
            setAssets([]);
          });
        }}
      />
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6" dir="rtl">
        <h1 className="font-display text-3xl font-extrabold">Assets</h1>
        <p className="mt-2 text-sm text-white/50">
          كل توليداتك محفوظة في حسابك — فيديو وصور.
        </p>

        <div className="mt-4 flex gap-2">
          {(
            [
              { id: "all" as const, label: "الكل" },
              { id: "video" as const, label: "فيديو" },
              { id: "image" as const, label: "صور" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                filter === tab.id
                  ? "bg-white text-black"
                  : "border border-white/10 text-white/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#141821] p-6 text-sm text-white/70">
            {error}{" "}
            <Link href="/login?next=/assets" className="text-[#22f0ff]">
              دخول
            </Link>
          </div>
        )}

        {!error && visible.length === 0 && (
          <p className="mt-8 text-sm text-white/45">
            لا توجد توليدات بعد. ابدأ من الصفحة الرئيسية بموديل Veronix.
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-[#141821]"
            >
              <div className="aspect-square bg-black/40">
                {item.url && item.mediaType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                ) : item.url && item.mediaType === "video" ? (
                  <video src={item.url} controls className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/35">
                    {item.status === "running" ? "جارٍ التوليد…" : item.status}
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 text-sm text-white/80">{item.prompt}</p>
                <p className="text-[11px] text-white/40">
                  {item.model === "seedance-2-mini" ? "Veronix" : item.model}
                  {" · "}
                  {item.creditsUsed === 0 ? "مجاني" : `−${item.creditsUsed}`}
                  {" · "}
                  {item.status}
                </p>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs text-[#22f0ff]"
                    download
                  >
                    فتح / تحميل
                  </a>
                )}
                {item.error && <p className="text-xs text-rose-300">{item.error}</p>}
              </div>
            </article>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
