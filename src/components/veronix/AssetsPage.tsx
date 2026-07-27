"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { fetchJson } from "@/lib/fetch-json";
import {
  clearEtaStart,
  formatCountdownLabel,
  inferTargetSecondsFromAsset,
  lockEtaStart,
  remainingGenerateSeconds,
} from "@/lib/generate-eta";
import { veronixDownloadPath, veronixMediaSrc } from "@/lib/media-proxy";

interface AssetItem {
  id: string;
  mediaType: "image" | "video";
  url: string;
  prompt: string;
  mode?: string;
  model: string;
  creditsUsed: number;
  status: string;
  createdAt: string;
  historyId?: string;
  error?: string;
  targetSeconds?: number;
}

function RunningCountdown({
  assetId,
  createdAt,
  targetSeconds,
}: {
  assetId: string;
  createdAt: string;
  targetSeconds: number;
}) {
  const [remaining, setRemaining] = useState(() => {
    const started = lockEtaStart(assetId, createdAt);
    return remainingGenerateSeconds(started, targetSeconds);
  });

  useEffect(() => {
    const started = lockEtaStart(assetId, createdAt);
    const tick = () => {
      setRemaining(remainingGenerateSeconds(started, targetSeconds));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [assetId, createdAt, targetSeconds]);

  return (
    <span className="text-2xl font-bold tabular-nums text-[#22f0ff]">
      {formatCountdownLabel(remaining)}
    </span>
  );
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
    const next = (data.assets || []).filter((a) => a.mode !== "sequence-part");
    setAssets(next);
    for (const a of next) {
      if (a.status === "completed" || a.status === "failed") {
        clearEtaStart(a.id);
      }
    }
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold">Assets</h1>
            <p className="mt-2 text-sm text-white/50">
              كل توليداتك محفوظة في حسابك — فيديو واحد لكل طلب.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/create/video"
              className="inline-flex h-9 items-center rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-3 text-xs font-semibold text-white"
            >
              إنشاء فيديو
            </Link>
            <Link
              href="/create/image"
              className="inline-flex h-9 items-center rounded-full border border-white/15 px-3 text-xs font-semibold text-white/85"
            >
              إنشاء صورة
            </Link>
            {user && (
              <button
                type="button"
                onClick={() => {
                  void fetch("/api/auth/customer/logout", { method: "POST" }).then(() => {
                    setUser(null);
                    setAssets([]);
                  });
                }}
                className="inline-flex h-9 items-center rounded-full border border-rose-400/35 px-3 text-xs font-semibold text-rose-100"
              >
                خروج
              </button>
            )}
          </div>
        </div>

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
                {(() => {
                  const src = veronixMediaSrc({
                    historyId: item.historyId,
                    url: item.url,
                    mediaType: item.mediaType,
                  });
                  const canPlay =
                    Boolean(src) &&
                    (Boolean(item.url) || Boolean(item.historyId)) &&
                    item.status !== "failed" &&
                    item.status !== "running";
                  if (item.mediaType === "image" && canPlay) {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src || item.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    );
                  }
                  if (item.mediaType === "video" && canPlay) {
                    return (
                      <video
                        src={src || undefined}
                        controls
                        playsInline
                        controlsList="nodownload"
                        className="h-full w-full object-cover"
                      />
                    );
                  }
                  const target = inferTargetSecondsFromAsset(item);
                  return (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
                      <span className="text-base font-semibold text-white">
                        {item.status === "running"
                          ? "جاري التوليد"
                          : item.status === "failed"
                            ? "فشل التوليد"
                            : item.status}
                      </span>
                      {item.status === "running" && (
                        <RunningCountdown
                          assetId={item.id}
                          createdAt={item.createdAt}
                          targetSeconds={target}
                        />
                      )}
                      {item.status === "running" && (
                        <span className="text-xs text-white/40">
                          تقدير لمدة {target}ث
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 text-sm text-white/80">{item.prompt}</p>
                <p className="text-[11px] text-white/40">
                  {item.mode === "sequence-pending"
                    ? "جاري التوليد"
                    : item.mode === "sequence-concat"
                      ? "فيديو واحد"
                      : item.model === "seedance-2-mini"
                        ? "Veronix"
                        : item.model}
                  {" · "}
                  {item.creditsUsed === 0 ? "مجاني" : `−${item.creditsUsed}`}
                  {" · "}
                  {item.status}
                </p>
                <p className="text-[10px] text-white/35">تم إنشاؤه بواسطة VYRONIX</p>
                {(item.url || item.historyId) && item.status === "completed" && (
                  <a
                    href={
                      veronixDownloadPath({
                        historyId: item.historyId,
                        url: item.url,
                        mediaType: item.mediaType,
                      }) || "/assets"
                    }
                    className="inline-block text-xs text-[#22f0ff]"
                    download
                  >
                    تحميل
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
