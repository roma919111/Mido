"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HardDrive, Loader2, Trash2, X } from "lucide-react";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { fetchJson } from "@/lib/fetch-json";

type StoragePayload = {
  usedPct: number;
  usedBytes: number;
  totalBytes: number;
  freeBytes: number;
  pressure: boolean;
  critical: boolean;
  driveReady: boolean;
  videoCount: number;
  loggedIn: boolean;
};

const DISMISS_KEY = "veronix_storage_dismiss_until";

function formatBytesClient(bytes: number, locale: "ar" | "en"): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return locale === "ar" ? `${gb.toFixed(1)} جيجا` : `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return locale === "ar" ? `${Math.round(mb)} ميجا` : `${Math.round(mb)} MB`;
}

export function StoragePressureHost() {
  const { t, dir, locale } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<StoragePayload | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { res, data } = await fetchJson<StoragePayload>("/api/storage/status");
      if (!res.ok) return;
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!status?.pressure || !status.loggedIn) {
      setOpen(false);
      return;
    }
    const force =
      params.get("storage") === "1" ||
      params.get("storage") === "drive" ||
      params.get("drive") === "ready";
    if (force) {
      setOpen(true);
      return;
    }
    try {
      const until = Number(sessionStorage.getItem(DISMISS_KEY) || "0");
      if (until > Date.now()) {
        setOpen(false);
        return;
      }
    } catch {
      // ignore
    }
    setOpen(true);
  }, [status, params]);

  useEffect(() => {
    if (params.get("drive") !== "ready") return;
    void (async () => {
      setOpen(true);
      setBusy(true);
      setNote(t.storage.uploading);
      try {
        const { res, data } = await fetchJson<{
          uploaded?: number;
          failed?: number;
          error?: string;
          needsDriveAuth?: boolean;
        }>("/api/storage/drive-export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deleteAfter: true, limit: 10 }),
        });
        if (res.status === 401 && data.needsDriveAuth) {
          setNote(t.storage.needDrive);
          return;
        }
        if (!res.ok) {
          setNote(data.error || t.storage.uploadFailed);
          return;
        }
        setNote(
          t.storage.uploadDone
            .replace("{n}", String(data.uploaded || 0))
            .replace("{f}", String(data.failed || 0)),
        );
        await refresh();
      } catch {
        setNote(t.storage.uploadFailed);
      } finally {
        setBusy(false);
        // Clean URL params
        if (pathname) {
          router.replace(pathname);
        }
      }
    })();
  }, [params, pathname, refresh, router, t.storage]);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, String(Date.now() + 30 * 60 * 1000));
    } catch {
      // ignore
    }
    setOpen(false);
  }

  async function startDrive() {
    setBusy(true);
    setNote(null);
    window.location.href = `/api/auth/google/drive?next=${encodeURIComponent(
      "/assets?storage=drive",
    )}`;
  }

  async function runExport() {
    setBusy(true);
    setNote(t.storage.uploading);
    try {
      const { res, data } = await fetchJson<{
        uploaded?: number;
        failed?: number;
        error?: string;
        needsDriveAuth?: boolean;
      }>("/api/storage/drive-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAfter: true, limit: 10 }),
      });
      if (res.status === 401 && data.needsDriveAuth) {
        await startDrive();
        return;
      }
      if (!res.ok) {
        setNote(data.error || t.storage.uploadFailed);
        return;
      }
      setNote(
        t.storage.uploadDone
          .replace("{n}", String(data.uploaded || 0))
          .replace("{f}", String(data.failed || 0)),
      );
      await refresh();
    } catch {
      setNote(t.storage.uploadFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!open || !status?.pressure || !status.loggedIn) return null;

  const loc = locale === "en" ? "en" : "ar";

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-pressure-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-400/25 bg-[#141821] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30">
              <HardDrive className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-amber-200/90">
                {t.storage.eyebrow}
              </p>
              <h2 id="storage-pressure-title" className="mt-1 text-lg font-bold text-white">
                {status.critical ? t.storage.titleCritical : t.storage.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white"
            aria-label={t.storage.later}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-white/60">{t.storage.body}</p>

          <div>
            <div className="mb-1.5 flex justify-between text-xs text-white/50">
              <span>
                {formatBytesClient(status.usedBytes, loc)} / {formatBytesClient(status.totalBytes, loc)}
              </span>
              <span className="font-semibold text-amber-200">{status.usedPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${
                  status.critical ? "bg-rose-400" : "bg-amber-400"
                }`}
                style={{ width: `${Math.min(100, status.usedPct)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/40">
              {t.storage.videosAvailable.replace("{n}", String(status.videoCount))}
            </p>
          </div>

          <div className="grid gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void (status.driveReady ? runExport() : startDrive())}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#4285F4,#34A853)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <HardDrive className="h-4 w-4" aria-hidden />
              )}
              {status.driveReady ? t.storage.uploadToDrive : t.storage.connectDrive}
            </button>

            <Link
              href="/assets"
              onClick={dismiss}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {t.storage.deleteMyself}
            </Link>

            <button
              type="button"
              onClick={dismiss}
              className="rounded-2xl px-4 py-2 text-sm text-white/50 hover:text-white/80"
            >
              {t.storage.later}
            </button>
          </div>

          {note ? <p className="text-xs text-[#22f0ff]/90">{note}</p> : null}
          <p className="text-[11px] leading-relaxed text-white/35">{t.storage.driveHint}</p>
        </div>
      </div>
    </div>
  );
}
