"use client";

import { useCallback, useEffect, useState } from "react";

type Device = {
  deviceId: string;
  mac?: string;
  label?: string;
  activated: boolean;
  registeredAt: string;
  activatedAt?: string;
  version?: string;
};

export default function MaxAdminPage() {
  const [key, setKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [manualId, setManualId] = useState("");
  const [manualLabel, setManualLabel] = useState("");
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
      const res = await fetch("/api/max/activations", { headers: headers() });
      if (!res.ok) throw new Error("Unauthorized or failed to load");
      const data = (await res.json()) as { devices: Device[] };
      setDevices(data.devices);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [savedKey, headers]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(id);
  }, [load]);

  async function activate(deviceId: string, label?: string) {
    setError(null);
    const res = await fetch("/api/max/activate", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ deviceId, label }),
    });
    if (!res.ok) {
      setError("Activation failed");
      return;
    }
    void load();
  }

  async function deactivate(deviceId: string) {
    setError(null);
    const res = await fetch(`/api/max/activate?deviceId=${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      setError("Deactivation failed");
      return;
    }
    void load();
  }

  if (!savedKey) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">MAX — تفعيل العملاء</h1>
        <p className="text-sm text-white/60">أدخل مفتاح Admin (MAX_ADMIN_KEY)</p>
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

  const pending = devices.filter((d) => !d.activated);
  const active = devices.filter((d) => d.activated);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl p-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">MAX Media Player — تفعيل عن بُعد</h1>
          <p className="mt-1 text-sm text-white/60">فعّل العميل برقم الجهاز (Device ID)</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-white/15 px-3 py-2 text-sm"
          onClick={() => void load()}
        >
          تحديث
        </button>
      </header>

      {error ? <p className="mb-4 rounded-lg bg-red-500/20 px-4 py-2 text-red-200">{error}</p> : null}

      <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 font-semibold">تفعيل يدوي</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            placeholder="Device ID (14 رقم)"
            value={manualId}
            onChange={(e) => setManualId(e.target.value.replace(/\D/g, ""))}
          />
          <input
            className="min-w-[160px] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            placeholder="اسم العميل (اختياري)"
            value={manualLabel}
            onChange={(e) => setManualLabel(e.target.value)}
          />
          <button
            type="button"
            className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold"
            onClick={() => void activate(manualId, manualLabel)}
          >
            ✅ تفعيل
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-semibold text-amber-300">⏳ بانتظار التفعيل ({pending.length})</h2>
        {loading && !devices.length ? <p className="text-white/50">جاري التحميل…</p> : null}
        {!pending.length ? (
          <p className="text-sm text-white/50">لا يوجد أجهزة جديدة — العميل يثبت MAX ويظهر هنا</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((d) => (
              <li
                key={d.deviceId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
              >
                <div>
                  <p className="font-mono text-lg">{d.deviceId}</p>
                  <p className="text-xs text-white/50">
                    MAC: {d.mac ?? "—"} · {new Date(d.registeredAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold"
                  onClick={() => void activate(d.deviceId)}
                >
                  ✅ تفعيل
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-emerald-300">✓ مفعّل ({active.length})</h2>
        {!active.length ? (
          <p className="text-sm text-white/50">لا يوجد عملاء مفعّلين بعد</p>
        ) : (
          <ul className="space-y-3">
            {active.map((d) => (
              <li
                key={d.deviceId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div>
                  <p className="font-mono">{d.deviceId}</p>
                  <p className="text-sm text-white/70">{d.label ?? "—"}</p>
                  <p className="text-xs text-white/40">
                    فُعّل: {d.activatedAt ? new Date(d.activatedAt).toLocaleString() : "—"}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-red-400/40 px-4 py-2 text-red-300"
                  onClick={() => void deactivate(d.deviceId)}
                >
                  إيقاف
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
