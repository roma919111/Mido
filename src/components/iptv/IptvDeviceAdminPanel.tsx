"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { expiryDateInputValue } from "@/lib/iptv-device-fields";
import { mediaPlayerDeviceUrl } from "@/lib/iptv-device-client";

type DeviceRow = {
  id: string;
  mac: string;
  devicePin: string;
  status: string;
  host?: string;
  username?: string;
  password?: string;
  customerNote?: string;
  customerPhone?: string;
  expiresAt?: string;
  expiresLabel?: string | null;
  daysLeft?: number | null;
  activatedAt?: string;
  createdAt: string;
  disabledReason?: "expired" | "admin";
};

export function IptvDeviceAdminPanel() {
  const [mac, setMac] = useState("");
  const [devicePin, setDevicePin] = useState("");
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [search, setSearch] = useState("");
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [orders, setOrders] = useState<
    Array<{ id: string; email: string; source?: string; paidAt: string; expiresAt: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    const { res, data } = await fetchJson<{ devices?: DeviceRow[]; error?: string }>("/api/iptv/device/activate");
    if (!res.ok) throw new Error(data.error ?? "Failed to load devices");
    setDevices(data.devices ?? []);
  }, []);

  useEffect(() => {
    void loadDevices().catch(() => undefined);
    void fetchJson<{ orders?: typeof orders }>("/api/billing/media-player/orders")
      .then(({ res, data }) => {
        if (res.ok) setOrders(data.orders ?? []);
      })
      .catch(() => undefined);
  }, [loadDevices]);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const { res, data } = await fetchJson<{ ok?: boolean; error?: string; expiresLabel?: string | null }>("/api/iptv/device/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac, devicePin, host, username, password, customerNote, customerPhone, expiresAt }),
      });
      if (!res.ok) throw new Error(data.error ?? "Activation failed");
      const expiry = data.expiresLabel;
      const activatedMac = mac.trim();
      const activatedPin = devicePin.trim();
      const playerUrl = mediaPlayerDeviceUrl(activatedMac, activatedPin);
      setMessage(
        expiry
          ? `تم تفعيل ${activatedMac} · ${activatedPin} · ينتهي ${expiry} · أرسل رابط المشغّل للزبون`
          : `تم تفعيل ${activatedMac} · ${activatedPin} · أرسل رابط المشغّل للزبون`,
      );
      await copyValue("last-player", playerUrl);
      setMac("");
      setDevicePin("");
      setPassword("");
      setCustomerNote("");
      setCustomerPhone("");
      setExpiresAt("");
      await loadDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التفعيل");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(row: DeviceRow) {
    if (!confirm(`إلغاء تفعيل الجهاز ${row.mac} · ${row.devicePin}؟`)) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const { res, data } = await fetchJson<{ ok?: boolean; error?: string }>("/api/iptv/device/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac: row.mac, devicePin: row.devicePin }),
      });
      if (!res.ok) throw new Error(data.error ?? "Deactivate failed");
      setMessage(`تم إلغاء تفعيل ${row.mac} · ${row.devicePin}`);
      await loadDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إلغاء التفعيل");
    } finally {
      setBusy(false);
    }
  }

  function fillFromDevice(row: DeviceRow) {
    setMac(row.mac);
    setDevicePin(row.devicePin);
    setHost(row.host ?? host);
    setUsername(row.username ?? username);
    setPassword(row.password ?? "");
    setCustomerNote(row.customerNote ?? "");
    setCustomerPhone(row.customerPhone ?? "");
    setExpiresAt(expiryDateInputValue(row.expiresAt));
  }

  function statusLabel(row: DeviceRow) {
    if (row.status === "active") return "مفعّل";
    if (row.status === "disabled" && row.disabledReason === "expired") return "ملغى تلقائياً — انتهى الاشتراك";
    if (row.status === "disabled") return "ملغى";
    return "بانتظار التفعيل";
  }

  function statusClass(status: string) {
    if (status === "active") return "text-emerald-400";
    if (status === "disabled") return "text-rose-400";
    return "text-amber-300";
  }

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return devices;
    const digits = query.replace(/\D/g, "");
    return devices.filter((row) => {
      const hay = [row.mac, row.devicePin, row.customerNote, row.customerPhone, row.username, row.host, row.expiresLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (hay.includes(query)) return true;
      return digits.length >= 3 && (row.customerPhone ?? "").replace(/\D/g, "").includes(digits);
    });
  }, [devices, search]);

  function daysLeftLabel(days: number | null | undefined) {
    if (days == null) return "غير محدد";
    if (days < 0) return "منتهي";
    if (days === 0) return "ينتهي اليوم";
    return `متبقي ${days.toLocaleString("en-US")} يوم`;
  }

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((cur) => (cur === key ? null : cur)), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="space-y-8" dir="rtl">
      <div>
        <h2 className="font-display text-xl font-bold">الأجهزة واشتراكات المشغّل</h2>
        <p className="mt-1 text-sm text-white/45">
          MAC ورقم الجهاز · الاستضافة واسم المستخدم وكلمة السر · الانتهاء وطلبات Stripe
        </p>
      </div>

      <form className="maxvr-admin-form space-y-4 rounded-2xl border border-white/10 bg-[#10141c] p-5" onSubmit={(e) => void handleActivate(e)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="iptv-field">
              <span>MAC Address</span>
              <input type="text" dir="ltr" placeholder="00:1A:79:XX:XX:XX" value={mac} onChange={(e) => setMac(e.target.value)} required />
            </label>
            <label className="iptv-field">
              <span>رقم الجهاز (4 أرقام)</span>
              <input type="text" dir="ltr" inputMode="numeric" maxLength={4} placeholder="4827" value={devicePin} onChange={(e) => setDevicePin(e.target.value)} required />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="iptv-field">
              <span>رقم هاتف الزبون</span>
              <input
                type="tel"
                dir="ltr"
                inputMode="tel"
                placeholder="973xxxxxxxx"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
              />
            </label>
            <label className="iptv-field">
              <span>موعد انتهاء الاشتراك</span>
              <input type="date" dir="ltr" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              <span className="text-xs text-white/40">اختياري — إن تركته فارغاً يُجلب من Xtream</span>
            </label>
          </div>

          <label className="iptv-field">
            <span>Host</span>
            <input type="text" dir="ltr" placeholder="http://server.com:8080" value={host} onChange={(e) => setHost(e.target.value)} required />
          </label>
          <label className="iptv-field">
            <span>Username</span>
            <input type="text" dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="iptv-field">
            <span>Password</span>
            <input type="text" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label className="iptv-field">
            <span>ملاحظة (اختياري)</span>
            <input type="text" value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} placeholder="اسم الزبون" />
          </label>

          {message ? <p className="text-emerald-400 text-sm">{message}</p> : null}
          {error ? <p className="iptv-error">{error}</p> : null}

          <button type="submit" className="iptv-login__btn w-full" disabled={busy}>
            {busy ? "جاري التفعيل…" : "تفعيل الاشتراك"}
          </button>
        </form>

        {orders.length ? (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">مدفوعات المشغّل</h2>
            <div className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                  <p dir="ltr">{order.email}</p>
                  <p>
                    المصدر: {order.source || "مباشر"} · ينتهي{" "}
                    {new Date(order.expiresAt).toLocaleDateString("ar-GB", {
                      calendar: "gregory",
                      numberingSystem: "latn",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">الأجهزة</h2>
            <label className="iptv-field min-w-[220px] flex-1 sm:max-w-xs">
              <span className="sr-only">بحث</span>
              <input
                type="search"
                placeholder="بحث برقم الهاتف أو MAC أو رقم الجهاز"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="space-y-2">
            {filteredDevices.map((row) => {
              const expired = (row.daysLeft ?? 1) < 0;
              return (
                <div
                  key={row.id}
                  className="maxvr-admin-device w-full rounded-xl border border-white/10 bg-white/5 p-3 text-right"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" className="text-right" onClick={() => fillFromDevice(row)}>
                      <code dir="ltr" className="text-cyan-300">
                        {row.mac} · {row.devicePin}
                      </code>
                    </button>
                    <span className={`text-xs ${statusClass(row.status)}`}>{statusLabel(row)}</span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-white/75">
                    {row.customerNote ? <p className="text-white/90">{row.customerNote}</p> : null}
                    <p>
                      الهاتف:{" "}
                      {row.customerPhone ? (
                        <a className="text-cyan-300" dir="ltr" href={`https://wa.me/${row.customerPhone.replace(/\D/g, "")}`}>
                          {row.customerPhone}
                        </a>
                      ) : (
                        <span className="text-white/40">غير مسجّل</span>
                      )}
                      {row.customerPhone ? (
                        <button type="button" className="mr-2 text-xs text-cyan-200" onClick={() => void copyValue(`${row.id}-phone`, row.customerPhone!)}>
                          {copied === `${row.id}-phone` ? "تم النسخ" : "نسخ"}
                        </button>
                      ) : null}
                    </p>
                    <p dir="ltr">
                      Host: <code className="text-cyan-200">{row.host || "—"}</code>
                      {row.host ? (
                        <button type="button" className="ms-2 text-xs text-cyan-200" onClick={() => void copyValue(`${row.id}-host`, row.host!)}>
                          {copied === `${row.id}-host` ? "copied" : "copy"}
                        </button>
                      ) : null}
                    </p>
                    <p dir="ltr">
                      User: <code className="text-cyan-200">{row.username || "—"}</code>
                      {row.username ? (
                        <button type="button" className="ms-2 text-xs text-cyan-200" onClick={() => void copyValue(`${row.id}-user`, row.username!)}>
                          {copied === `${row.id}-user` ? "copied" : "copy"}
                        </button>
                      ) : null}
                    </p>
                    <p dir="ltr">
                      Pass: <code className="text-cyan-200">{row.password || "—"}</code>
                      {row.password ? (
                        <button type="button" className="ms-2 text-xs text-cyan-200" onClick={() => void copyValue(`${row.id}-pass`, row.password!)}>
                          {copied === `${row.id}-pass` ? "copied" : "copy"}
                        </button>
                      ) : null}
                    </p>
                    <p className={expired ? "text-rose-300" : undefined}>
                      انتهاء الاشتراك: {row.expiresLabel ?? "غير محدد"}
                      {row.status === "active" ? ` · ${daysLeftLabel(row.daysLeft)}` : null}
                      {row.status === "active" ? " · يُلغى تلقائياً عند الانتهاء" : null}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100"
                      onClick={() => void copyValue(`${row.id}-player`, mediaPlayerDeviceUrl(row.mac, row.devicePin))}
                    >
                      {copied === `${row.id}-player` ? "تم نسخ رابط المشغّل" : "نسخ رابط المشغّل للزبون"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80"
                      onClick={() => fillFromDevice(row)}
                    >
                      تعبئة البيانات
                    </button>
                    {row.status !== "disabled" ? (
                      <button
                        type="button"
                        className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void handleDeactivate(row)}
                      >
                        إلغاء التفعيل
                      </button>
                    ) : (
                      <span className="text-xs text-white/40">أدخل البيانات أعلاه ثم اضغط تفعيل لإعادة التشغيل</span>
                    )}
                  </div>
                </div>
              );
            })}
            {!devices.length ? <p className="text-white/50 text-sm">لا توجد أجهزة بعد</p> : null}
            {devices.length > 0 && !filteredDevices.length ? (
              <p className="text-white/50 text-sm">لا توجد نتائج مطابقة لبحثك</p>
            ) : null}
          </div>
        </section>
    </div>
  );
}

