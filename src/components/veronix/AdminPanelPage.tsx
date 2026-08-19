"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  Check,
  Coins,
  Lock,
  MonitorPlay,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Unlock,
  Users,
} from "lucide-react";
import { AppHeader, type CustomerUser } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { fetchJson } from "@/lib/fetch-json";
import { AdminModelEconomicsTable } from "./AdminModelEconomicsTable";
import { loginHref } from "@/lib/auth-next";
import { IptvDeviceAdminPanel } from "@/components/iptv/IptvDeviceAdminPanel";

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

type AdminTab = "ai" | "player";

function readAdminTab(tabParam: string | null, hash = ""): AdminTab {
  const hashId = hash.replace(/^#/, "");
  if (tabParam === "player" || tabParam === "devices" || tabParam === "operator") return "player";
  if (hashId === "player" || hashId === "devices") return "player";
  return "ai";
}

export function AdminPanelPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const [hash, setHash] = useState("");
  const tab = readAdminTab(tabParam, hash);
  const [playerMounted, setPlayerMounted] = useState(tab === "player");
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
  const [byteplusAuth, setByteplusAuth] = useState<{
    ok: boolean;
    vyronix?: { ok: boolean; errorMessage?: string; keyHint?: string };
    seedance2?: { ok: boolean; errorMessage?: string; keyHint?: string };
  } | null>(null);

  const loadByteplusProbe = useCallback(async () => {
    const { res, data } = await fetchJson<{
      ok?: boolean;
      probes?: {
        vyronix?: { ok: boolean; errorMessage?: string; keyHint?: string };
        seedance2?: { ok: boolean; errorMessage?: string; keyHint?: string };
      };
    }>("/api/admin/byteplus-probe", { credentials: "include" });
    if (res.ok) {
      setByteplusAuth({
        ok: Boolean(data.ok),
        vyronix: data.probes?.vyronix,
        seedance2: data.probes?.seedance2,
      });
    }
  }, []);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) || null,
    [users, selectedId],
  );

  useEffect(() => {
    const current = window.location.hash.replace(/^#/, "");
    setHash(window.location.hash);
    if ((current === "player" || current === "devices") && tabParam !== "player") {
      router.replace("/admin?tab=player");
    }
  }, [router, tabParam]);

  useEffect(() => {
    if (tab === "player") setPlayerMounted(true);
  }, [tab]);

  function setTab(next: AdminTab) {
    setHash("");
    router.replace(next === "player" ? "/admin?tab=player" : "/admin");
  }

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
        void loadByteplusProbe();
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
          <Link href={loginHref("/admin")} className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
            تسجيل الدخول
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <AppHeader user={me} />
      <main className="mx-auto max-w-6xl px-4 pb-bottom-nav pt-6 sm:px-6" dir="rtl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-[#22f0ff]/90">
              <Shield className="h-3.5 w-3.5" />
              لوحة المالك
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold">لوحة التحكم</h1>
            <p className="mt-1 text-sm text-white/45">
              {tab === "player"
                ? "اشتراكات الأجهزة · MAC ورقم الجهاز · الاستضافة · الانتهاء"
                : "إدارة المشتركين · الكريدت · القفل · الباقات · التجربة المجانية"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void load(q);
              void loadByteplusProbe();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/80"
          >
            <RefreshCw className="h-4 w-4" />
            تحديث
          </button>
        </div>

        <div
          className="mt-6 flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#141821] p-1 sm:flex-row"
          role="tablist"
          aria-label="أقسام لوحة التحكم"
        >
          {(
            [
              ["ai", "قسم الذكاء الاصطناعي والكريدت", Sparkles],
              ["player", "قسم اشتراكات المشغّل", MonitorPlay],
            ] as const
          ).map(([id, label, Icon]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={id === "player" ? "player" : "ai"}
                onClick={() => setTab(id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-white text-black" : "text-white/60 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-center leading-snug">{label}</span>
              </button>
            );
          })}
        </div>

        <div hidden={tab !== "ai"} id="ai">
        {byteplusAuth && !byteplusAuth.ok ? (
          <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <p className="font-semibold">⚠️ Seedance / Veronix — مفتاح API غير صالح</p>
            <p className="mt-1 text-rose-100/85">
              VYRONIX: {byteplusAuth.vyronix?.ok ? "✅" : `❌ ${byteplusAuth.vyronix?.errorMessage || "فشل"}`}
              {byteplusAuth.vyronix?.keyHint ? ` · ${byteplusAuth.vyronix.keyHint}` : ""}
            </p>
            <p className="mt-1 text-rose-100/85">
              Seedance 2.0: {byteplusAuth.seedance2?.ok ? "✅" : `❌ ${byteplusAuth.seedance2?.errorMessage || "فشل"}`}
              {byteplusAuth.seedance2?.keyHint ? ` · ${byteplusAuth.seedance2.keyHint}` : ""}
            </p>
            <p className="mt-2 text-xs text-rose-100/70">
              أنشئ ARK API Key من console.byteplus.com → ModelArk → API Key Management، ثم حدّث
              BYTEPLUS_API_KEY على Railway.
            </p>
          </div>
        ) : null}

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
                    {[1_000, 4_000, 10_000, 15_000].map((n) => (
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

        <AdminModelEconomicsTable />
        </div>

        {(tab === "player" || playerMounted) && (
          <section hidden={tab !== "player"} id="player" className="mt-6">
            <IptvDeviceAdminPanel />
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
