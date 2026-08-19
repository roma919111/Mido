"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Home, Loader2 } from "lucide-react";
import { useLocale } from "@/components/veronix/LocaleProvider";
import {
  getEditStudioExportState,
  subscribeEditStudioExport,
  type EditStudioExportJobState,
} from "@/lib/edit-studio-export-job";
import { publishEditExportToHome } from "@/lib/edit-studio-publish";

export function EditStudioExportHost() {
  const { dir, t } = useLocale();
  const [job, setJob] = useState<EditStudioExportJobState>(() =>
    getEditStudioExportState(),
  );
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishNote, setPublishNote] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  useEffect(() => subscribeEditStudioExport(setJob), []);

  useEffect(() => {
    if (job.phase !== "done") {
      setPublished(false);
      setPublishNote(null);
    }
  }, [job.phase, job.downloadUrl]);

  async function handlePublish() {
    if (!job.downloadUrl || publishBusy || published) return;
    setPublishBusy(true);
    setPublishNote(null);
    try {
      const res = await fetch(job.downloadUrl);
      const blob = await res.blob();
      const result = await publishEditExportToHome({
        blob,
        filename: job.downloadFilename || "vyronix-export.mp4",
        prompt: job.exportPrompt || undefined,
        aspectRatio: job.exportAspect || undefined,
      });
      if (result.ok) {
        setPublished(true);
        setPublishNote(t.editStudio.publishDone);
      } else {
        setPublishNote(result.error || t.editStudio.publishFailed);
      }
    } catch {
      setPublishNote(t.editStudio.publishFailed);
    } finally {
      setPublishBusy(false);
    }
  }

  if (job.phase === "idle" && !job.error && !job.downloadUrl) return null;

  const tone =
    job.phase === "error"
      ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
      : job.phase === "done"
        ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
        : "border-[#22f0ff]/35 bg-[#0d1118]/95 text-white";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(3.25rem+env(safe-area-inset-top))] z-[200] px-3"
      dir={dir}
    >
      <div
        className={`pointer-events-auto mx-auto flex max-w-lg flex-col gap-2 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md ${tone}`}
      >
        <div className="flex items-center gap-3">
          {job.active ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#22f0ff]" />
          ) : job.downloadUrl ? (
            <Download className="h-5 w-5 shrink-0 text-emerald-300" />
          ) : null}
          <div className="min-w-0 flex-1">
            {job.error ? (
              <p className="text-sm font-semibold">{job.error}</p>
            ) : (
              <>
                <p className="text-sm font-semibold">{job.message}</p>
                {job.active ? (
                  <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#22f0ff] transition-[width] duration-300"
                        style={{ width: `${Math.max(4, Math.min(100, job.pct))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] opacity-70">
                      {dir === "rtl"
                        ? `${job.pct}% — سيُحمّل الملف تلقائياً عند الانتهاء`
                        : `${job.pct}% — file downloads automatically when ready`}
                    </p>
                  </>
                ) : job.phase === "done" ? (
                  <p className="mt-0.5 text-[11px] opacity-70">
                    {dir === "rtl"
                      ? "تحقق من تبويب التصدير — أو استخدم الأزرار أدناه"
                      : "Check the export tab — or use the buttons below"}
                  </p>
                ) : null}
              </>
            )}
          </div>
          {job.downloadUrl && !job.active ? (
            <a
              href={job.downloadUrl}
              download={job.downloadFilename || "vyronix-export.mp4"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-100 ring-1 ring-emerald-400/35 transition hover:bg-emerald-500/30"
            >
              <Download className="h-3.5 w-3.5" />
              {dir === "rtl" ? "تحميل" : "Download"}
            </a>
          ) : null}
        </div>

        {job.downloadUrl && !job.active && job.phase === "done" ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
            <button
              type="button"
              disabled={publishBusy || published}
              onClick={() => void handlePublish()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {publishBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Home className="h-3.5 w-3.5" aria-hidden />
              )}
              {published ? t.editStudio.publishedToHome : t.editStudio.publishToHome}
            </button>
            {published ? (
              <Link
                href="/"
                className="text-[11px] font-semibold text-emerald-200/90 underline-offset-2 hover:underline"
              >
                {t.editStudio.viewOnHome}
              </Link>
            ) : null}
            {publishNote ? (
              <p className="w-full text-[11px] text-emerald-100/90">{publishNote}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
