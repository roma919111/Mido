"use client";

import { useCallback, useEffect, useState } from "react";
import { Mic, Phone, Upload, Database, KeyRound, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { tenantHostFromSlug } from "@/lib/tenant-slug";

type PortalTenant = {
  slug: string;
  registryNameAr: string;
  registryNameEn: string;
  activityLabel: string;
  status: string;
  phone?: string;
  assistantId?: string;
  uploads: Array<{
    id: string;
    fileName: string;
    sizeBytes: number;
    uploadedAt: string;
    storage: string;
  }>;
};

type Props = {
  slug: string;
  initialAccessToken?: string;
};

export function VoiceTenantPortalApp({ slug, initialAccessToken }: Props) {
  const [tenant, setTenant] = useState<PortalTenant | null>(null);
  const [authed, setAuthed] = useState(false);
  const [needsAccessToken, setNeedsAccessToken] = useState(false);
  const [accessInput, setAccessInput] = useState(initialAccessToken || "");
  const [phone, setPhone] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sessionUrl = `/api/tenant/session?slug=${encodeURIComponent(slug)}`;
  const settingsUrl = `/api/tenant/settings?slug=${encodeURIComponent(slug)}`;
  const uploadUrl = `/api/tenant/upload?slug=${encodeURIComponent(slug)}`;

  const loadSession = useCallback(async () => {
    const { res, data } = await fetchJson<{
      tenant?: PortalTenant;
      authed?: boolean;
      needsAccessToken?: boolean;
      error?: string;
    }>(sessionUrl);
    if (!res.ok) {
      setError(data.error || "تعذر تحميل الصفحة");
      return;
    }
    if (data.tenant) {
      setTenant(data.tenant);
      setPhone(data.tenant.phone || "");
      setAssistantId(data.tenant.assistantId || "");
    }
    setAuthed(Boolean(data.authed));
    setNeedsAccessToken(Boolean(data.needsAccessToken));
  }, [sessionUrl]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!initialAccessToken || authed) return;
    void (async () => {
      setBusy("access");
      const { res, data } = await fetchJson<{ ok?: boolean; error?: string }>(sessionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: initialAccessToken }),
      });
      setBusy(null);
      if (res.ok) {
        await loadSession();
        setMessage("تم تسجيل الدخول للبوابة");
      } else {
        setError(data.error || "رمز الدخول غير صحيح");
      }
    })();
  }, [initialAccessToken, authed, sessionUrl, loadSession]);

  async function submitAccess(e: React.FormEvent) {
    e.preventDefault();
    setBusy("access");
    setError(null);
    const { res, data } = await fetchJson<{ ok?: boolean; error?: string }>(sessionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: accessInput.trim() }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(data.error || "رمز الدخول غير صحيح");
      return;
    }
    setMessage("تم تسجيل الدخول");
    await loadSession();
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy("settings");
    setError(null);
    const { res, data } = await fetchJson<{ ok?: boolean; error?: string }>(settingsUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim(), assistantId: assistantId.trim() }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(data.error || "فشل الحفظ");
      return;
    }
    setMessage("تم حفظ إعدادات الربط");
    await loadSession();
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setBusy("upload");
    setError(null);
    const form = new FormData();
    form.set("file", file);
    try {
      const res = await fetch(uploadUrl, { method: "POST", body: form, credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "فشل الرفع");
      setMessage(`تم رفع ${file.name} بأمان`);
      await loadSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الرفع");
    } finally {
      setBusy(null);
    }
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080a10] text-white/60">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const host = tenantHostFromSlug(tenant.slug);
  const inactive = tenant.status !== "active";

  return (
    <div className="min-h-screen bg-[#080a10] text-white" dir="rtl">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8">
        <header className="border-b border-white/10 pb-6">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#22f0ff]/80" dir="ltr">
            {host}
          </p>
          <h1 className="mt-2 font-display text-2xl font-extrabold">{tenant.registryNameAr}</h1>
          <p className="mt-1 text-sm text-white/50">{tenant.registryNameEn}</p>
          <p className="mt-2 text-xs text-white/40">{tenant.activityLabel}</p>
        </header>

        {inactive ? (
          <main className="flex flex-1 flex-col justify-center py-12 text-center">
            <p className="text-lg font-semibold text-amber-200/90">الموقع قيد الإعداد</p>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              {tenant.status === "pending_approval"
                ? "بانتظار موافقة الإدارة على السجل التجاري."
                : tenant.status === "awaiting_payment"
                  ? "تمت الموافقة — بانتظار تأكيد الدفع من vyronix.app/admin."
                  : tenant.status === "rejected"
                    ? "تم رفض الطلب. تواصل مع الدعم."
                    : "سيتم التفعيل قريباً."}
            </p>
          </main>
        ) : (
          <>
            <section className="mt-8 rounded-2xl border border-white/12 bg-[linear-gradient(145deg,rgba(124,92,255,0.18),rgba(34,240,255,0.08))] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#22f0ff]/15">
                  <Mic className="h-6 w-6 text-[#22f0ff]" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold">المساعد الصوتي</h2>
                  <p className="text-xs text-white/55">Fabi — واجهة موحّدة لجميع المشتركين</p>
                </div>
              </div>
              <button
                type="button"
                disabled
                className="mt-4 w-full rounded-xl bg-white/10 py-3 text-sm font-semibold text-white/70"
              >
                تشغيل المحادثة (قريباً — ربط Assistant ID)
              </button>
            </section>

            {needsAccessToken && !authed ? (
              <form onSubmit={submitAccess} className="mt-6 rounded-2xl border border-white/10 bg-[#0f1219] p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound className="h-4 w-4 text-[#22f0ff]" />
                  رمز دخول البوابة
                </p>
                <p className="mt-1 text-xs text-white/45">
                  يصلك من الإدارة بعد الدفع — لحماية رفع ملفات قاعدة البيانات.
                </p>
                <input
                  value={accessInput}
                  onChange={(e) => setAccessInput(e.target.value)}
                  className="mt-3 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
                  dir="ltr"
                  placeholder="access token"
                  required
                />
                <button
                  type="submit"
                  disabled={busy === "access"}
                  className="mt-3 w-full rounded-lg bg-[#22f0ff] py-2.5 text-sm font-bold text-black"
                >
                  {busy === "access" ? "…" : "دخول"}
                </button>
              </form>
            ) : null}

            {authed ? (
              <>
                <form onSubmit={saveSettings} className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-[#0f1219] p-4">
                  <p className="text-sm font-semibold">أدوات الربط</p>
                  <label className="block text-xs text-white/50">
                    <span className="mb-1 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> رقم الهاتف
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
                      dir="ltr"
                      placeholder="+9665..."
                    />
                  </label>
                  <label className="block text-xs text-white/50">
                    <span className="mb-1 flex items-center gap-1">
                      <KeyRound className="h-3.5 w-3.5" /> Assistant ID
                    </span>
                    <input
                      value={assistantId}
                      onChange={(e) => setAssistantId(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
                      dir="ltr"
                      placeholder="asst_..."
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy === "settings"}
                    className="w-full rounded-lg border border-white/20 py-2.5 text-sm font-semibold"
                  >
                    {busy === "settings" ? "…" : "حفظ الربط"}
                  </button>
                </form>

                <section className="mt-6 rounded-2xl border border-white/10 bg-[#0f1219] p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Database className="h-4 w-4" /> رفع ملفات قاعدة البيانات
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    يمر عبر الخادم ثم يُخزَّن في S3 (أو محلياً في التجربة إن لم تُضبط AWS).
                  </p>
                  <label className="mt-4 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-white/20 bg-black/20 px-4 py-8 text-center">
                    <Upload className="h-8 w-8 text-white/40" />
                    <span className="mt-2 text-sm text-white/70">اختر ملف sql · db · sqlite · csv · json · zip</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".sql,.db,.sqlite,.sqlite3,.csv,.json,.zip,.gz,.bak"
                      disabled={busy === "upload"}
                      onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {tenant.uploads.length > 0 ? (
                    <ul className="mt-4 space-y-2 text-xs text-white/55">
                      {tenant.uploads.map((u) => (
                        <li key={u.id} className="rounded-lg bg-white/5 px-3 py-2" dir="ltr">
                          {u.fileName} · {(u.sizeBytes / 1024).toFixed(1)} KB · {u.storage}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              </>
            ) : null}
          </>
        )}

        {(message || error) && (
          <p
            className={`mt-6 text-center text-sm ${error ? "text-rose-300" : "text-emerald-300"}`}
            role="status"
          >
            {error || message}
          </p>
        )}
      </div>
    </div>
  );
}
