"use client";

import { useCallback, useEffect, useState } from "react";

type IptvCode = {
  code: string;
  label?: string;
  m3uUrl: string;
  active: boolean;
  createdAt: string;
};

export default function MaxAdminPage() {
  const [key, setKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [codes, setCodes] = useState<IptvCode[]>([]);
  const [m3uUrl, setM3uUrl] = useState("");
  const [label, setLabel] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        m3uUrl: m3uUrl.trim(),
      }),
    });
    const data = (await res.json()) as { record?: IptvCode; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setM3uUrl("");
    setLabel("");
    setCustomCode("");
    void load();
    if (data.record) {
      alert(`تم إنشاء الكود: ${data.record.code}\nأرسله للعميل على WhatsApp`);
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

  if (!savedKey) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">MAX IPTV — Admin</h1>
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

  const active = codes.filter((c) => c.active);
  const inactive = codes.filter((c) => !c.active);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">MAX IPTV — إدارة الاشتراكات</h1>
        <p className="mt-1 text-sm text-white/60">أنشئ كود → الصق M3U → أرسل الكود للعميل</p>
      </header>

      {error ? <p className="mb-4 rounded-lg bg-red-500/20 px-4 py-2 text-red-200">{error}</p> : null}

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
            placeholder="اسم العميل (اختياري)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            placeholder="كود مخصص (اختياري — يُولّد تلقائياً)"
            inputMode="numeric"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <button
            type="button"
            className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold"
            onClick={() => void createCode()}
          >
            إنشاء كود تفعيل
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-semibold text-emerald-300">✓ نشط ({active.length})</h2>
        {loading && !codes.length ? <p className="text-white/50">جاري التحميل…</p> : null}
        {!active.length ? (
          <p className="text-sm text-white/50">لا يوجد اشتراكات بعد</p>
        ) : (
          <ul className="space-y-3">
            {active.map((c) => (
              <li
                key={c.code}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-2xl font-bold tracking-widest">{c.code}</p>
                    <p className="text-sm text-white/70">{c.label ?? "—"}</p>
                    <p className="mt-1 truncate text-xs text-white/40">{c.m3uUrl}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl border border-red-400/40 px-4 py-2 text-red-300"
                    onClick={() => void toggleCode(c.code, false)}
                  >
                    إيقاف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {inactive.length ? (
        <section>
          <h2 className="mb-3 font-semibold text-white/50">موقوف ({inactive.length})</h2>
          <ul className="space-y-3">
            {inactive.map((c) => (
              <li key={c.code} className="rounded-xl border border-white/10 bg-black/20 p-4 opacity-70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-lg">{c.code}</p>
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
