"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Check,
  Coins,
  Lock,
  RefreshCw,
  Search,
  Shield,
  Unlock,
  Users,
} from "lucide-react";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { AdminPricingCalculator } from "./AdminPricingCalculator";
import { fetchJson } from "@/lib/fetch-json";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  credits: number;
  planId: string | null;
  freeVeronixUsed: boolean;
  locked: boolean;
  lockedReason?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  hasStripe: boolean;
  assetCount: number;
  videoCount: number;
  imageCount: number;
  runningCount: number;
};

type Stats = {
  users: number;
  paidUsers: number;
  lockedUsers: number;
  totalCredits: number;
  assets: number;
  videos: number;
  images: number;
  running: number;
};

const PLAN_LABEL: Record<string, string> = {
  free: "أساسية",
  mini: "برو",
  pro: "الترا",
};

export function AdminPanelPage() {
  const [me, setMe] = useState<CustomerUser | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("10000");
  const [lockReason, setLockReason] = useState("مخالفة شروط الاستخدام");
  const [note, setNote] = useState("");

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) || null,
    [users, selectedId],
  );

  const load = useCallback(async (search = q) => {
    setError(null);
    const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
    const { res, data } = await fetchJson<{
      stats?: Stats;
      users?: AdminUser[];
      error?: string;
    }>(`/api/admin/panel${qs}`);
    if (!res.ok) {
      setError(data.error || "غير مصرح — سجّل بحساب المالك");
      setStats(null);
      setUsers([]);
      return;
    }
    setStats(data.stats || null);
    setUsers(data.users || []);
  }, [q]);

  useEffect(() => {
    void (async () => {
      const { data } = await fetchJson<{ user: CustomerUser | null }>("/api/auth/customer/me");
      setMe(data.user);
      try {
        const { res, data: panel } = await fetchJson<{
          stats?: Stats;
          users?: AdminUser[];
          error?: string;
        }>("/api/admin/panel");
        if (!res.ok) {
          setError(panel.error || "غير مصرح — سجّل بحساب المالك");
          return;
        }
        setStats(panel.stats || null);
        setUsers(panel.users || []);
      } catch {
        setError("تعذر تحميل لوحة التحكم");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    if (!selected) {
      setNote("");
      return;
    }
    setNote(selected.adminNote || "");
  }, [selected]);

  async function runAction(
    action: string,
    extra: Record<string, unknown> = {},
    busyKey = action,
  ) {
    if (!selected) return;
    setBusy(busyKey);
    setMessage(null);
    setError(null);
    try {
      const { res, data } = await fetchJson<{
        ok?: boolean;
        error?: string;
        credits?: number;
        planId?: string;
        locked?: boolean;
        freeVeronixUsed?: boolean;
        adminNote?: string;
      }>("/api/admin/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId: selected.id, ...extra }),
      });
      if (!res.ok) throw new Error(data.error || "فشل الإجراء");
      setMessage("تم حفظ التغيير");
      await load(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الإجراء");
    } finally {
      setBusy(null);
    }
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen bg-[#0b0d12] text-white">
        <AppHeader user={me} />
        <main className="mx-auto max-w-lg px-4 py-16 text-center" dir="rtl">
          <Shield className="mx-auto h-10 w-10 text-rose-300" />
          <h1 className="mt-4 font-display text-2xl font-bold">لوحة المالك</h1>
          <p className="mt-3 text-sm text-white/55">{error}</p>
          <Link href="/login" className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
            تسجيل الدخول
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <AppHeader user={me} />
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6" dir="rtl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#22f0ff]/90">
              <Shield className="h-3.5 w-3.5" />
              Owner Console
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold">لوحة التحكم</h1>
            <p className="mt-1 text-sm text-white/45">
              إدارة المشتركين · الكريدت · القفل · الباقات · التجربة المجانية
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(q)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/80"
          >
            <RefreshCw className="h-4 w-4" />
            تحديث
          </button>
        </div>

        {stats && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "المشتركون", value: stats.users, icon: Users },
              { label: "مدفوعون", value: stats.paidUsers, icon: Check },
              { label: "مقفلون", value: stats.lockedUsers, icon: Ban },
              { label: "كريدت إجمالي", value: stats.totalCredits, icon: Coins },
              { label: "أصول", value: stats.assets },
              { label: "فيديو", value: stats.videos },
              { label: "صور", value: stats.images },
              { label: "قيد التوليد", value: stats.running },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-[#141821] px-4 py-3"
              >
                <p className="text-xs text-white/45">{s.label}</p>
                <p className="mt-1 font-display text-xl font-bold tabular-nums">
                  {s.value.toLocaleString("en-US")}
                </p>
              </div>
            ))}
          </div>
        )}

        {(message || error) && (
          <p
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-rose-400/30 bg-rose-400/10 text-rose-50"
                : "border-cyan-400/20 bg-cyan-400/10 text-cyan-50"
            }`}
          >
            {error || message}
          </p>
        )}

        <AdminPricingCalculator
          onSaved={(msg) => {
            setError(null);
            setMessage(msg);
          }}
        />

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-[#10141c] p-4">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
              <Search className="h-4 w-4 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void load(q);
                }}
                placeholder="بحث بالإيميل أو الاسم…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={() => void load(q)}
                className="rounded-full bg-white/10 px-3 py-1 text-xs"
              >
                بحث
              </button>
            </div>

            <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedId(u.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-right transition ${
                    selectedId === u.id
                      ? "border-[#22f0ff]/50 bg-[rgba(34,240,255,0.08)]"
                      : "border-white/8 bg-white/[0.03] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{u.email}</p>
                      <p className="mt-0.5 text-xs text-white/45">
                        {PLAN_LABEL[u.planId || "free"] || u.planId || "—"} ·{" "}
                        {u.credits.toLocaleString("en-US")} كريدت · {u.assetCount} أصل
                      </p>
                    </div>
                    {u.locked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] text-rose-200">
                        <Lock className="h-3 w-3" /> مقفل
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
              {!users.length && (
                <p className="py-8 text-center text-sm text-white/40">لا نتائج</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#10141c] p-4">
            {!selected ? (
              <p className="py-16 text-center text-sm text-white/40">
                اختر مشتركاً من القائمة
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-white/40">المشترك</p>
                  <p className="font-semibold">{selected.email}</p>
                  <p className="text-xs text-white/45">
                    {selected.name} · {selected.id.slice(0, 8)}…
                  </p>
                  {selected.lockedReason ? (
                    <p className="mt-2 text-xs text-rose-200">سبب القفل: {selected.lockedReason}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    الباقة: {PLAN_LABEL[selected.planId || "free"] || "—"}
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    كريدت: {selected.credits.toLocaleString("en-US")}
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    تجربة مجانية: {selected.freeVeronixUsed ? "مستخدمة" : "متاحة"}
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    Stripe: {selected.hasStripe ? "نعم" : "لا"}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs text-white/50">كريدت سريع</p>
                  <div className="flex flex-wrap gap-2">
                    {[10_000, 50_000, 150_000, 260_000].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void runAction("add_credits", { amount: n }, `add-${n}`)
                        }
                        className="rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        +{n.toLocaleString("en-US")}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void runAction("add_credits", { amount: -10_000 }, "sub-10k")
                      }
                      className="rounded-full border border-rose-400/30 px-3 py-1.5 text-xs text-rose-100 disabled:opacity-50"
                    >
                      −10,000
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void runAction(
                          "add_credits",
                          { amount: Math.floor(Number(creditAmount) || 0) },
                          "add-custom",
                        )
                      }
                      className="rounded-xl bg-white px-3 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      إضافة
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void runAction(
                          "set_credits",
                          { amount: Math.floor(Number(creditAmount) || 0) },
                          "set-custom",
                        )
                      }
                      className="rounded-xl border border-white/20 px-3 text-sm disabled:opacity-50"
                    >
                      تعيين
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs text-white/50">تغيير الباقة</p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["free", "أساسية"],
                        ["mini", "برو"],
                        ["pro", "الترا"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        disabled={Boolean(busy) || selected.planId === id}
                        onClick={() => void runAction("set_plan", { planId: id }, `plan-${id}`)}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-40"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs text-white/50">قفل الحساب</p>
                  <input
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    className="mb-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                    placeholder="سبب القفل"
                  />
                  <div className="flex flex-wrap gap-2">
                    {!selected.locked ? (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void runAction("lock", { reason: lockReason }, "lock")
                        }
                        className="inline-flex items-center gap-1 rounded-full bg-rose-500/90 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        قفل الحساب
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void runAction("unlock", {}, "unlock")}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                      >
                        <Unlock className="h-3.5 w-3.5" />
                        فتح الحساب
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void runAction(
                          "set_trial",
                          { freeVeronixUsed: false },
                          "trial-reset",
                        )
                      }
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      إعادة التجربة المجانية
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void runAction(
                          "set_trial",
                          { freeVeronixUsed: true },
                          "trial-used",
                        )
                      }
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      اعتبار التجربة مستخدمة
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs text-white/50">ملاحظة داخلية</p>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void runAction("set_note", { note }, "note")}
                    className="mt-2 rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    حفظ الملاحظة
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
