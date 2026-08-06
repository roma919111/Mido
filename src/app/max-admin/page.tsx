"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type IptvCode = {
  code: string;
  label?: string;
  phone?: string;
  notes?: string;
  m3uUrl: string;
  active: boolean;
  createdAt: string;
  expiresAt?: string | null;
  planDays?: number;
};

const PLAYER_URL_KEY = "max.playerPublicUrl";

const PLANS: { days: number | null; label: string }[] = [
  { days: 30, label: "30 يوم" },
  { days: 90, label: "3 أشهر" },
  { days: 365, label: "سنة" },
  { days: null, label: "بدون انتهاء" },
];

function defaultPlayerUrl(): string {
  return process.env.NEXT_PUBLIC_MAX_PLAYER_URL?.trim() || "http://localhost:5173";
}

function customerLink(code: string, playerBase: string): string {
  return `${playerBase.replace(/\/$/, "")}/?code=${encodeURIComponent(code)}`;
}

function whatsAppText(code: string, link: string, label?: string, expiresAt?: string | null): string {
  const name = label?.trim() ? ` ${label.trim()}` : "";
  const expiry = expiresAt
    ? `\n• صالح حتى: ${new Date(expiresAt).toLocaleDateString("ar")}`
    : "\n• اشتراك مفتوح";
  return (
    `مرحباً${name}! 👋\n\n` +
    `MAX SHOW TV جاهز — اضغط الرابط:\n${link}\n` +
    expiry +
    `\n\n• القنوات + الأفلام + المسلسلات\n• Netflix / شاهد / TOD بزر واحد\n• بدون إعداد — افتح واستمتع`
  );
}

function formatExpiry(expiresAt?: string | null): string {
  if (!expiresAt) return "مفتوح";
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "منتهي";
  if (days <= 7) return `${days} يوم متبقي`;
  return new Date(expiresAt).toLocaleDateString("ar");
}

export default function MaxAdminPage() {
  const [key, setKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [playerUrl, setPlayerUrl] = useState(defaultPlayerUrl);
  const [codes, setCodes] = useState<IptvCode[]>([]);
  const [m3uUrl, setM3uUrl] = useState("");
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [planDays, setPlanDays] = useState<number | null>(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(PLAYER_URL_KEY);
    if (stored) setPlayerUrl(stored);
  }, []);

  function savePlayerUrl(url: string) {
    setPlayerUrl(url);
    localStorage.setItem(PLAYER_URL_KEY, url);
  }

  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(savedKey ? { "x-max-admin-key": savedKey } : {}),
    }),
    [savedKey],
  );

  const load = useCallback(async () => {
    if (!savedKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/max/iptv/codes", { headers: headers() });
      if (!res.ok) throw new Error("Unauthorized");
      const data = (await res.json()) as { codes: IptvCode[] };
      setCodes(data.codes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [savedKey, headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const now = Date.now();
    let active = 0;
    let expiring = 0;
    let expired = 0;
    for (const c of codes) {
      if (!c.active) continue;
      if (!c.expiresAt) {
        active += 1;
        continue;
      }
      const days = Math.ceil((new Date(c.expiresAt).getTime() - now) / (1000 * 60 * 60 * 24));
      if (days < 0) expired += 1;
      else if (days <= 7) expiring += 1;
      else active += 1;
    }
    return { active, expiring, expired, total: codes.length };
  }, [codes]);

  async function copyText(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("تعذر النسخ — انسخ يدوياً");
    }
  }

  async function createCode() {
    if (!m3uUrl.trim()) {
      setError("أدخل رابط M3U");
      return;
    }
    setError(null);
    const res = await fetch("/api/max/iptv/codes", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        code: customCode || undefined,
        label: label || undefined,
        phone: phone || undefined,
        m3uUrl: m3uUrl.trim(),
        planDays,
      }),
    });
    const data = (await res.json()) as { record?: IptvCode; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setM3uUrl("");
    setLabel("");
    setPhone("");
    setCustomCode("");
    void load();
    if (data.record) {
      const link = customerLink(data.record.code, playerUrl);
      await copyText(
        whatsAppText(data.record.code, link, data.record.label, data.record.expiresAt),
        "new",
      );
    }
  }

  async function toggleCode(code: string, active: boolean) {
    await fetch("/api/max/iptv/codes", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ code, active }),
    });
    void load();
  }

  async function renewCode(code: string, days: number) {
    await fetch("/api/max/iptv/codes", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ code, renewDays: days }),
    });
    void load();
  }

  if (!savedKey) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">MAX SHOW TV — Admin</h1>
        <p className="text-sm text-white/60">أدخل MAX_ADMIN_KEY</p>
        <input
          type="password"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Admin key"
        />
        <button
          type="button"
          className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold"
          onClick={() => setSavedKey(key.trim())}
        >
          دخول
        </button>
      </main>
    );
  }

  const activeList = codes.filter((c) => c.active);
  const inactiveList = codes.filter((c) => !c.active);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">MAX SHOW TV — إدارة الاشتراكات</h1>
        <p className="mt-1 text-sm text-white/60">نموذج عمل احترافي: M3U + كود + رابط WhatsApp</p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-300">{stats.active}</p>
          <p className="text-xs text-white/55">نشط</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center">
          <p className="text-2xl font-bold text-amber-300">{stats.expiring}</p>
          <p className="text-xs text-white/55">ينتهي قريباً</p>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
          <p className="text-2xl font-bold text-red-300">{stats.expired}</p>
          <p className="text-xs text-white/55">منتهي</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-white/55">إجمالي</p>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4 text-sm leading-relaxed text-white/75">
        <h2 className="mb-2 font-semibold text-sky-200">📋 سير العمل الاحترافي</h2>
        <ol className="list-decimal pr-5 space-y-1">
          <li>اشتري M3U من مزود مرخّص (قانوني)</li>
          <li>أنشئ اشتراك هنا → كود + مدة</li>
          <li>انسخ رسالة WhatsApp وأرسلها للزبون</li>
          <li>الزبون يفتح الرابط — واجهة جاهزة بدون إعداد</li>
          <li>Netflix/شاهد/TOD: الزبون يسجّل اشتراكه الرسمي مرة واحدة</li>
          <li>عند التجديد: اضغط «+30 يوم» أو «+90 يوم»</li>
        </ol>
      </section>

      {error ? <p className="mb-4 rounded-lg bg-red-500/20 px-4 py-2 text-red-200">{error}</p> : null}
      {copied ? (
        <p className="mb-4 rounded-lg bg-emerald-500/20 px-4 py-2 text-emerald-200">✓ تم النسخ</p>
      ) : null}

      <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-2 font-semibold">🔗 رابط المشغّل للزبائن</h2>
        <input
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
          value={playerUrl}
          onChange={(e) => savePlayerUrl(e.target.value)}
          placeholder="https://max.yourdomain.com"
        />
      </section>

      <section className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <h2 className="mb-3 font-semibold">➕ عميل جديد</h2>
        <div className="flex flex-col gap-2">
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            placeholder="رابط M3U (من مزودك المرخّص)"
            value={m3uUrl}
            onChange={(e) => setM3uUrl(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            placeholder="اسم العميل"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            placeholder="WhatsApp / هاتف (اختياري)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            placeholder="كود مخصص (اختياري)"
            inputMode="numeric"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <div className="flex flex-wrap gap-2">
            {PLANS.map((plan) => (
              <button
                key={plan.label}
                type="button"
                className={`rounded-xl px-4 py-2 text-sm ${
                  planDays === plan.days
                    ? "bg-emerald-600 font-semibold"
                    : "border border-white/15 bg-black/20"
                }`}
                onClick={() => setPlanDays(plan.days)}
              >
                {plan.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold"
            onClick={() => void createCode()}
          >
            إنشاء + نسخ رسالة WhatsApp
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-semibold text-emerald-300">✓ الاشتراكات ({activeList.length})</h2>
        {loading && !codes.length ? <p className="text-white/50">جاري التحميل…</p> : null}
        {!activeList.length ? (
          <p className="text-sm text-white/50">لا يوجد اشتراكات بعد</p>
        ) : (
          <ul className="space-y-3">
            {activeList.map((c) => {
              const link = customerLink(c.code, playerUrl);
              const expiryLabel = formatExpiry(c.expiresAt);
              const isExpired = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
              return (
                <li
                  key={c.code}
                  className={`rounded-xl border p-4 ${
                    isExpired
                      ? "border-red-500/30 bg-red-500/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-2xl font-bold tracking-widest">{c.code}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          isExpired ? "bg-red-500/30" : "bg-emerald-500/20"
                        }`}
                      >
                        {expiryLabel}
                      </span>
                    </div>
                    <p className="text-sm text-white/70">{c.label ?? "—"}</p>
                    {c.phone ? <p className="text-xs text-white/45">{c.phone}</p> : null}
                    <p className="mt-2 break-all text-xs text-sky-300/90">{link}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl bg-sky-700 px-3 py-2 text-sm"
                      onClick={() => void copyText(link, `link-${c.code}`)}
                    >
                      📋 الرابط
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-emerald-700 px-3 py-2 text-sm"
                      onClick={() =>
                        void copyText(whatsAppText(c.code, link, c.label, c.expiresAt), `wa-${c.code}`)
                      }
                    >
                      💬 WhatsApp
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-indigo-700 px-3 py-2 text-sm"
                      onClick={() => void renewCode(c.code, 30)}
                    >
                      +30 يوم
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-indigo-700 px-3 py-2 text-sm"
                      onClick={() => void renewCode(c.code, 90)}
                    >
                      +90 يوم
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-red-400/40 px-3 py-2 text-sm text-red-300"
                      onClick={() => void toggleCode(c.code, false)}
                    >
                      إيقاف
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {inactiveList.length ? (
        <section>
          <h2 className="mb-3 font-semibold text-white/50">موقوف ({inactiveList.length})</h2>
          <ul className="space-y-3">
            {inactiveList.map((c) => (
              <li key={c.code} className="rounded-xl border border-white/10 bg-black/20 p-4 opacity-70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg">{c.code}</p>
                    <p className="text-sm text-white/50">{c.label ?? "—"}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-700 px-4 py-2"
                    onClick={() => void toggleCode(c.code, true)}
                  >
                    تفعيل
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
