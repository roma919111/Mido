"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Save } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import {
  DEFAULT_VERONIX_PRICING,
  buildPricingBreakdown,
  normalizePricingConfig,
  setActivePricingConfig,
  tokenUsdPer1k,
  type PricingTierRow,
  type VeronixPricingConfig,
} from "@/lib/byteplus-pricing";

function money(n: number, digits = 6): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(digits)}`;
}

function fmtCredits(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function fmtTokens(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function AdminPricingCalculator({
  onSaved,
}: {
  onSaved?: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<VeronixPricingConfig>({
    ...DEFAULT_VERONIX_PRICING,
  });
  const [rows, setRows] = useState<PricingTierRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const preview = useMemo(() => {
    const cfg = normalizePricingConfig(draft);
    return {
      cfg,
      rate: tokenUsdPer1k(cfg),
      rows: buildPricingBreakdown(cfg),
    };
  }, [draft]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { res, data } = await fetchJson<{
        config?: VeronixPricingConfig;
        rows?: PricingTierRow[];
        error?: string;
      }>("/api/admin/pricing");
      if (!res.ok) throw new Error(data.error || "تعذر تحميل التسعيرة");
      const cfg = normalizePricingConfig(data.config);
      setDraft(cfg);
      setActivePricingConfig(cfg);
      setRows(data.rows || buildPricingBreakdown(cfg));
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل التسعيرة");
      setDraft({ ...DEFAULT_VERONIX_PRICING });
      setRows(buildPricingBreakdown(DEFAULT_VERONIX_PRICING));
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const cfg = normalizePricingConfig(draft);
      const { res, data } = await fetchJson<{
        config?: VeronixPricingConfig;
        rows?: PricingTierRow[];
        error?: string;
      }>("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      const saved = normalizePricingConfig(data.config);
      setDraft(saved);
      setActivePricingConfig(saved);
      setRows(data.rows || buildPricingBreakdown(saved));
      onSaved?.("تم اعتماد تسعيرة الباكيج — تتحدث تكاليف العملاء فوراً");
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setBusy(false);
    }
  }

  const perSec = preview.rows.filter((r) => r.kind === "video_per_sec");
  const clips = preview.rows.filter((r) => r.kind === "video_clip");
  const images = preview.rows.filter((r) => r.kind === "image");

  function field(
    key: keyof VeronixPricingConfig,
    label: string,
    hint?: string,
  ) {
    return (
      <label className="block space-y-1 text-xs text-white/55">
        <span>{label}</span>
        <input
          type="number"
          step="any"
          value={draft[key]}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              [key]: Number(e.target.value),
            }))
          }
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22f0ff]/40"
        />
        {hint ? <span className="block text-[10px] text-white/35">{hint}</span> : null}
      </label>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-[#10141c] p-4 sm:p-5" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#22f0ff]/90">
            <Calculator className="h-3.5 w-3.5" />
            Pricing
          </p>
          <h2 className="mt-1 font-display text-xl font-extrabold">
            حاسبة التكلفة والربح
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            أدخل سعر باكيج المصدر وعدد التوكنات — تُحسب التكلفة لكل ثانية، سعر البيع
            (+هامش الربح)، والكريدت الذي يدفعه الزبون.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || !loaded}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          اعتماد وحفظ
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-50">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {field("packUsd", "سعر الباكيج (USD)", "مثال: 29.4 من BytePlus")}
        {field("packTokens", "التوكنات في الباكيج", "مثال: 14000000")}
        {field(
          "profitMarkup",
          "مضاعف البيع",
          "1.55 = ربح 55٪ فوق تكلفة المصدر",
        )}
        {field("imageCostUsd", "تكلفة الصورة (USD)", "تكلفة Seedream للوحدة")}
        {field("fps", "الإطارات / ثانية", "ثابت عادة 24 في Seedance Mini")}
        {field("creditUsd", "قيمة الكريدت (USD)", "وحدة محفظة الزبون")}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
          <p className="text-[11px] text-white/45">سعر 1K توكن (تكلفة)</p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums text-[#22f0ff]">
            {money(preview.rate, 6)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
          <p className="text-[11px] text-white/45">هامش الربح</p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums">
            {((preview.cfg.profitMarkup - 1) * 100).toFixed(0)}%
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
          <p className="text-[11px] text-white/45">معادلة التوكن</p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">
            (W × H × FPS × المدة) ÷ 1024
          </p>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-white">التكلفة المعتمدة / ثانية</h3>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-xs sm:text-sm" dir="rtl">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="px-3 py-2 font-medium">الفئة</th>
                <th className="px-3 py-2 font-medium">توكن/ث</th>
                <th className="px-3 py-2 font-medium">تكلفة</th>
                <th className="px-3 py-2 font-medium">بيع</th>
                <th className="px-3 py-2 font-medium">ربح</th>
                <th className="px-3 py-2 font-medium">كريدت الزبون</th>
              </tr>
            </thead>
            <tbody>
              {perSec.map((r) => (
                <tr key={r.id} className="border-t border-white/8">
                  <td className="px-3 py-2 font-semibold">{r.label}</td>
                  <td className="px-3 py-2 tabular-nums text-white/70">
                    {fmtTokens(r.tokens)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-white/70">
                    {money(r.costUsd)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#22f0ff]">
                    {money(r.sellUsd)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-emerald-300">
                    {money(r.profitUsd)} ({r.profitPct.toFixed(0)}%)
                  </td>
                  <td className="px-3 py-2 tabular-nums font-semibold">
                    {fmtCredits(r.credits)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-white">أسعار المقاطع (حسب المدة)</h3>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-xs sm:text-sm" dir="rtl">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="px-3 py-2 font-medium">الفئة</th>
                <th className="px-3 py-2 font-medium">توكن</th>
                <th className="px-3 py-2 font-medium">تكلفة</th>
                <th className="px-3 py-2 font-medium">بيع</th>
                <th className="px-3 py-2 font-medium">ربح</th>
                <th className="px-3 py-2 font-medium">كريدت الزبون</th>
              </tr>
            </thead>
            <tbody>
              {clips.map((r) => (
                <tr key={r.id} className="border-t border-white/8">
                  <td className="px-3 py-2 font-semibold">{r.label}</td>
                  <td className="px-3 py-2 tabular-nums text-white/70">
                    {fmtTokens(r.tokens)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-white/70">
                    {money(r.costUsd)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#22f0ff]">
                    {money(r.sellUsd)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-emerald-300">
                    {money(r.profitUsd)}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-semibold">
                    {fmtCredits(r.credits)}
                  </td>
                </tr>
              ))}
              {images.map((r) => (
                <tr key={r.id} className="border-t border-white/8">
                  <td className="px-3 py-2 font-semibold">{r.label}</td>
                  <td className="px-3 py-2 text-white/40">—</td>
                  <td className="px-3 py-2 tabular-nums text-white/70">
                    {money(r.costUsd, 4)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#22f0ff]">
                    {money(r.sellUsd, 4)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-emerald-300">
                    {money(r.profitUsd, 4)}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-semibold">
                    {fmtCredits(r.credits)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-white/35">
          الأرقام أعلاه تتحدّث مباشرة عند تغيير سعر الباكيج/التوكنات. اضغط «اعتماد وحفظ»
          لتطبيقها على خصم كريدت الزبائن.
          {rows.length ? " · القيم المحفوظة حالياً معتمدة على السيرفر." : ""}
        </p>
      </div>
    </section>
  );
}
