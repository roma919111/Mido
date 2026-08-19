"use client";

import { useMemo } from "react";
import {
  adminEconomicsSummary,
  buildAdminModelEconomics,
} from "@/lib/admin-model-economics";

function usd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function AdminModelEconomicsTable() {
  const rows = useMemo(() => buildAdminModelEconomics(), []);
  const summary = useMemo(() => adminEconomicsSummary(rows), [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = map.get(row.modelName) || [];
      list.push(row);
      map.set(row.modelName, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-[#10141c] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">اقتصاديات الموديلات</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/50">
            تكلفة المزود مقابل سعر البيع للعميل · $1 ={" "}
            {summary.creditsPerUsd.toLocaleString("en-US")} كريدت · هامش BytePlus/PixVerse
            ×{summary.profitMarkup} · OpenArt ×{summary.openArtMultiplier}
          </p>
        </div>
        <div className="rounded-xl border border-[#22f0ff]/25 bg-[#22f0ff]/8 px-3 py-2 text-xs">
          <span className="text-white/50">{summary.modelCount} موديل · </span>
          <span className="font-semibold text-[#22f0ff]">
            متوسط الهامش {pct(summary.avgMarginPct)}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {grouped.map(([modelName, modelRows]) => (
          <div
            key={modelName}
            className="overflow-hidden rounded-2xl border border-white/8 bg-black/20"
          >
            <div className="border-b border-white/8 px-4 py-3">
              <p className="font-semibold text-white">{modelName}</p>
              <p className="text-[11px] text-white/40" dir="ltr">
                {modelRows[0]?.modelId}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-white/8 text-white/45">
                    <th className="px-3 py-2 text-start font-medium">التكوين</th>
                    <th className="px-3 py-2 text-start font-medium">تكلفة</th>
                    <th className="px-3 py-2 text-start font-medium">بيع</th>
                    <th className="px-3 py-2 text-start font-medium">ربح</th>
                    <th className="px-3 py-2 text-start font-medium">هامش</th>
                    <th className="px-3 py-2 text-start font-medium">كريدت</th>
                    <th className="px-3 py-2 text-start font-medium">مصدر</th>
                  </tr>
                </thead>
                <tbody>
                  {modelRows.map((row) => (
                    <tr
                      key={`${row.modelId}-${row.scenario}`}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-3 py-2 text-white/85">{row.scenario}</td>
                      <td className="px-3 py-2 tabular-nums text-amber-200/90" dir="ltr">
                        {usd(row.costUsd)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-[#22f0ff]" dir="ltr">
                        {usd(row.sellUsd)}
                      </td>
                      <td
                        className={`px-3 py-2 tabular-nums ${
                          row.profitUsd >= 0 ? "text-emerald-300" : "text-rose-300"
                        }`}
                        dir="ltr"
                      >
                        {usd(row.profitUsd)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-white/70" dir="ltr">
                        {pct(row.marginPct)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-white/80" dir="ltr">
                        {row.walletCredits.toLocaleString("en-US")}
                      </td>
                      <td className="max-w-[12rem] px-3 py-2 text-[10px] leading-snug text-white/40">
                        {row.providerNote}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
