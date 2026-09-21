"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Mic, Search, X, Zap } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

type TenantRow = {
  id: string;
  commercialRegistrationNumber: string;
  registryNameAr: string;
  registryNameEn: string;
  activityLabel: string;
  slug: string;
  host: string;
  status: string;
  portalAccessToken?: string;
  uploads: unknown[];
  adminNote?: string;
  rejectedReason?: string;
};

type RegistryHit = {
  commercialRegistrationNumber: string;
  registryNameAr: string;
  registryNameEn: string;
  activityLabel: string;
  suggestedSlug: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "بانتظار الموافقة",
  approved: "موافق",
  awaiting_payment: "بانتظار الدفع",
  active: "مفعّل",
  rejected: "مرفوض",
};

export function VoiceTenantAdminPanel() {
  const [cr, setCr] = useState("4030123456");
  const [hit, setHit] = useState<RegistryHit | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [storageMode, setStorageMode] = useState("local");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => tenants.find((t) => t.id === selectedId) ?? null,
    [tenants, selectedId],
  );

  const load = useCallback(async () => {
    const { res, data } = await fetchJson<{
      tenants?: TenantRow[];
      storageMode?: string;
      error?: string;
    }>("/api/admin/voice-tenants", { credentials: "include" });
    if (!res.ok) {
      setError(data.error || "فشل التحميل");
      return;
    }
    setTenants(data.tenants || []);
    setStorageMode(data.storageMode || "local");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: string, extra: Record<string, unknown> = {}, key = action) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const { res, data } = await fetchJson<{ ok?: boolean; error?: string; hit?: RegistryHit; tenant?: TenantRow }>(
        "/api/admin/voice-tenants",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        },
      );
      if (!res.ok) throw new Error(data.error || "فشل");
      if (data.hit) setHit(data.hit);
      if (data.tenant) {
        setSelectedId(data.tenant.id);
        setMessage("تم التحديث");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل");
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("تم النسخ");
    } catch {
      setError("تعذر النسخ");
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-[#22f0ff]/25 bg-[#22f0ff]/5 p-4 text-sm">
        <p className="font-semibold text-[#22f0ff]">المساعد الصوتي · Fabi</p>
        <p className="mt-1 text-white/60">
          بحث السجل → موافقة → دفع → تفعيل{" "}
          <span dir="ltr" className="text-white/80">
            {"{slug}.vyronix.app"}
          </span>
          . التخزين: <span className="font-mono text-xs">{storageMode}</span>
          {storageMode === "local" ? " (اضبط AWS_S3_* على Railway للـ S3)" : ""}
        </p>
        <p className="mt-2 text-xs text-white/45">
          تجربة Los Mercados: CR <span dir="ltr">4030123456</span>
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#141821] p-4">
        <p className="text-sm font-semibold">بحث السجل التجاري</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={cr}
            onChange={(e) => setCr(e.target.value)}
            dir="ltr"
            className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
            placeholder="4030123456"
          />
          <button
            type="button"
            disabled={busy === "search"}
            onClick={() => void run("search", { crNumber: cr }, "search")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold"
          >
            <Search className="h-4 w-4" />
            بحث
          </button>
          <button
            type="button"
            disabled={busy === "create"}
            onClick={() => void run("create_request", { crNumber: cr }, "create")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#22f0ff] px-4 py-2 text-sm font-bold text-black"
          >
            <Mic className="h-4 w-4" />
            إنشاء طلب
          </button>
        </div>

        {hit ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
            <p>{hit.registryNameAr}</p>
            <p className="text-white/50">{hit.registryNameEn}</p>
            <p className="mt-1 text-xs text-white/40">{hit.activityLabel}</p>
            <p className="mt-2 text-xs" dir="ltr">
              {hit.suggestedSlug}.vyronix.app
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#141821] p-4">
          <p className="text-sm font-semibold">الطلبات ({tenants.length})</p>
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {tenants.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-right text-sm transition ${
                    selectedId === t.id
                      ? "border-[#22f0ff]/40 bg-[#22f0ff]/10"
                      : "border-white/10 bg-black/20 hover:border-white/20"
                  }`}
                >
                  <p className="font-semibold">{t.registryNameAr}</p>
                  <p className="text-xs text-white/45" dir="ltr">
                    {t.host}
                  </p>
                  <p className="mt-1 text-[11px] text-amber-200/80">
                    {STATUS_LABEL[t.status] || t.status}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#141821] p-4">
          {selected ? (
            <>
              <p className="font-display text-lg font-bold">{selected.registryNameAr}</p>
              <p className="text-xs text-white/45" dir="ltr">
                CR {selected.commercialRegistrationNumber}
              </p>
              <p className="mt-2 text-sm" dir="ltr">
                https://{selected.host}/
              </p>
              <p className="mt-1 text-xs text-white/40">
                معاينة: /tenant-portal/{selected.slug}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {selected.status === "pending_approval" ? (
                  <>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void run("approve", { tenantId: selected.id })}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100"
                    >
                      <Check className="h-3.5 w-3.5" /> موافقة
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void run("reject", { tenantId: selected.id, reason: "غير مكتمل" })}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-100"
                    >
                      <X className="h-3.5 w-3.5" /> رفض
                    </button>
                  </>
                ) : null}
                {selected.status === "awaiting_payment" || selected.status === "approved" ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void run("activate", { tenantId: selected.id })}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#22f0ff] px-3 py-2 text-xs font-bold text-black"
                  >
                    <Zap className="h-3.5 w-3.5" /> تأكيد الدفع وتفعيل
                  </button>
                ) : null}
              </div>

              {selected.status === "active" && selected.portalAccessToken ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
                  <p className="text-white/50">رمز دخول البوابة (أرسله للمشترك)</p>
                  <p className="mt-2 break-all font-mono text-[11px]" dir="ltr">
                    {selected.portalAccessToken}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-[#22f0ff]"
                    onClick={() =>
                      void copy(
                        `https://${selected.host}/?access=${encodeURIComponent(selected.portalAccessToken!)}`,
                      )
                    }
                  >
                    نسخ رابط الدخول
                  </button>
                </div>
              ) : null}

              {selected.rejectedReason ? (
                <p className="mt-3 text-xs text-rose-300">{selected.rejectedReason}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-white/45">اختر طلباً من القائمة</p>
          )}
        </div>
      </div>

      {(message || error) && (
        <p className={`text-sm ${error ? "text-rose-300" : "text-emerald-300"}`}>{error || message}</p>
      )}
    </div>
  );
}
