"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adoptServerIdentity,
  buildWhatsAppShareUrl,
  checkDeviceStatus,
  connectDevice,
  copyText,
  identityFromLocationSearch,
  loadOrCreateDeviceIdentity,
  mediaPlayerDeviceUrl,
  registerDevice,
  saveDeviceIdentity,
} from "@/lib/iptv-device-client";
import { bindIptvSession, type IptvLoginResult, saveSessionId } from "@/lib/iptv-client";
import { IptvApp } from "./IptvApp";
import { IptvBrandMark } from "./IptvBrandMark";

type GateStatus = "loading" | "pending" | "connecting" | "active" | "disabled";

export function MaxVronixMediaApp() {
  const [mac, setMac] = useState("");
  const [devicePin, setDevicePin] = useState("");
  const [status, setStatus] = useState<GateStatus>("loading");
  const [login, setLogin] = useState<IptvLoginResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [xtHost, setXtHost] = useState("");
  const [xtUser, setXtUser] = useState("");
  const [xtPass, setXtPass] = useState("");
  const identityRef = useRef<{ mac: string; devicePin: string } | null>(null);
  const startSessionRef = useRef<Promise<boolean> | null>(null);
  const activatedRef = useRef(false);
  const [restoreMac, setRestoreMac] = useState("");
  const [restorePin, setRestorePin] = useState("");
  const [showRestore, setShowRestore] = useState(false);

  const adoptIdentity = useCallback((nextMac: string, nextPin: string) => {
    const identity = saveDeviceIdentity({ mac: nextMac, devicePin: nextPin });
    identityRef.current = identity;
    setMac(identity.mac);
    setDevicePin(identity.devicePin);
    return identity;
  }, []);

  const startSession = useCallback(async (identityMac: string, identityPin: string, silent = false) => {
    if (startSessionRef.current) {
      return startSessionRef.current;
    }

    const job = (async () => {
      if (!silent) setStatus("connecting");
      setError(null);
      try {
        const result = await connectDevice(identityMac, identityPin);
        if (result.mac && result.devicePin) {
          adoptIdentity(result.mac, result.devicePin);
        }
        saveSessionId(result.sessionId);
        bindIptvSession(result.sessionId, async () => {
          const identity = identityRef.current;
          if (!identity) return null;
          const next = await connectDevice(identity.mac, identity.devicePin);
          if (next.mac && next.devicePin) adoptIdentity(next.mac, next.devicePin);
          saveSessionId(next.sessionId);
          setLogin(next);
          return next.sessionId;
        });
        setLogin(result);
        setStatus("active");
        activatedRef.current = true;
        return true;
      } catch (e) {
        if (activatedRef.current) {
          setStatus("active");
          setError(e instanceof Error ? e.message : "فشل إعادة الاتصال — اضغط تحقق مرة أخرى");
        } else {
          setStatus("pending");
          setError(e instanceof Error ? e.message : "فشل تشغيل الاشتراك — حاول مرة أخرى");
        }
        return false;
      }
    })();

    startSessionRef.current = job;
    try {
      return await job;
    } finally {
      if (startSessionRef.current === job) startSessionRef.current = null;
    }
  }, [adoptIdentity]);

  const boot = useCallback(async () => {
    const fromUrl = identityFromLocationSearch();
    const identity = fromUrl ? saveDeviceIdentity(fromUrl) : await loadOrCreateDeviceIdentity();
    identityRef.current = identity;
    setMac(identity.mac);
    setDevicePin(identity.devicePin);
    if (fromUrl && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("mac");
      url.searchParams.delete("pin");
      url.searchParams.delete("devicePin");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    try {
      const registered = await registerDevice(identity.mac, identity.devicePin);
      const registeredIdentity = adoptServerIdentity(identity, registered, { allowMacChange: Boolean(fromUrl) });
      identityRef.current = registeredIdentity;
      setMac(registeredIdentity.mac);
      setDevicePin(registeredIdentity.devicePin);

      const result = await checkDeviceStatus(registeredIdentity.mac, registeredIdentity.devicePin);
      const current = adoptServerIdentity(registeredIdentity, result, { allowMacChange: Boolean(fromUrl) });
      identityRef.current = current;
      setMac(current.mac);
      setDevicePin(current.devicePin);
      if (result.status === "active") {
        await startSession(current.mac, current.devicePin);
        return;
      }
      if (result.status === "disabled") {
        setStatus("disabled");
        setError("تم إيقاف هذا الجهاز — تواصل مع الدعم");
        return;
      }
      setStatus("pending");
      setShowRestore(true);
      setRestoreMac(current.mac);
      setRestorePin(current.devicePin);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الاتصال");
      setStatus("pending");
      setShowRestore(true);
    }
  }, [startSession]);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") setPaid(true);
    const sessionId = params.get("session_id")?.trim();
    if (!sessionId) return;
    void fetch("/api/billing/media-player/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (status !== "pending" || !mac || !devicePin) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const result = await checkDeviceStatus(mac, devicePin);
          const current = identityRef.current ?? { mac, devicePin };
          const next = adoptServerIdentity(current, result);
          identityRef.current = next;
          setMac(next.mac);
          setDevicePin(next.devicePin);
          if (result.status === "active") {
            await startSession(next.mac, next.devicePin, true);
          }
        } catch {
          /* keep polling */
        }
      })();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [status, mac, devicePin, startSession, adoptIdentity]);

  async function handleCopy(label: string, value: string) {
    const ok = await copyText(value);
    setCopied(ok ? label : null);
    window.setTimeout(() => setCopied(null), 2000);
  }

  async function handleCheckNow(override?: { mac: string; devicePin: string }) {
    const currentMac = override?.mac || mac;
    const currentPin = override?.devicePin || devicePin;
    if (!currentMac || !currentPin) return;
    setChecking(true);
    setError(null);
    try {
      const registered = await registerDevice(currentMac, currentPin);
      const registeredIdentity = override
        ? adoptIdentity(registered.mac, registered.devicePin)
        : adoptServerIdentity({ mac: currentMac, devicePin: currentPin }, registered);
      const result = await checkDeviceStatus(registeredIdentity.mac, registeredIdentity.devicePin);
      const current = adoptServerIdentity(registeredIdentity, result, { allowMacChange: Boolean(override) });
      identityRef.current = current;
      setMac(current.mac);
      setDevicePin(current.devicePin);
      if (result.status === "active") {
        const opened = await startSession(current.mac, current.devicePin);
        if (!opened) setShowRestore(true);
        return;
      }
      if (result.status === "disabled") {
        setStatus("disabled");
        setError("تم إيقاف هذا الجهاز — تواصل مع الدعم");
        return;
      }
      setStatus("pending");
      setShowRestore(true);
      setRestoreMac(current.mac);
      setRestorePin(current.devicePin);
      setError("هذا المعرّف غير مفعّل بعد. إن أرسلت MAC ورقم جهاز مختلفين للدعم، أدخلهما بالأسفل.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل التحقق");
      setShowRestore(true);
    } finally {
      setChecking(false);
    }
  }

  async function handleRestore() {
    const nextMac = restoreMac.trim() || mac;
    const nextPin = restorePin.trim() || devicePin;
    if (!nextMac || !nextPin) {
      setError("أدخل MAC ورقم الجهاز كما أرسلتهما للدعم");
      return;
    }
    await handleCheckNow({ mac: nextMac, devicePin: nextPin });
  }

  function handleDeviceRefresh() {
    const id = identityRef.current;
    if (!id) return;
    setLogin(null);
    void startSession(id.mac, id.devicePin);
  }

  if (status === "loading" || status === "connecting" || (status === "active" && !login)) {
    return (
      <div className="mstv-app mstv-app--login">
        <div className="mstv-app__stage">
          <p className="mstv-empty">{status === "loading" ? "جاري التحميل…" : "جاري تشغيل الاشتراك…"}</p>
          {error ? <p className="iptv-error">{error}</p> : null}
        </div>
      </div>
    );
  }

  if (status === "active" && login) {
    return (
      <IptvApp
        bootstrap={login}
        authMode="device"
        deviceLabel={`${mac} · ${devicePin}`}
        onDeviceExit={handleDeviceRefresh}
      />
    );
  }

  const whatsappUrl =
    mac && devicePin ? buildWhatsAppShareUrl(mac, devicePin, { host: xtHost, username: xtUser, password: xtPass }) : "#";

  return (
    <div className="mstv-app mstv-app--login">
      <div className="mstv-app__stage">
        <div className="mstv-app__dots mstv-app__dots--cyan" aria-hidden="true" />
        <div className="mstv-app__dots mstv-app__dots--magenta" aria-hidden="true" />
        <div className="iptv-login mstv-login-panel maxvr-gate">
          <IptvBrandMark />

          {paid ? (
            <p className="maxvr-gate__paid">
              تم استلام الاشتراك السنوي (40 ر.س). أدخل Host و Username و Password لاشتراكك ثم أرسلها عبر واتساب للتفعيل.
            </p>
          ) : null}

          <p className="iptv-login__sub">MAC ورقم الجهاز ثابتان على هذا المتصفح. أرسل Host و Username و Password معهما للتفعيل.</p>

          <label className="maxvr-gate__block">
            <span className="maxvr-gate__label">Host</span>
            <input
              className="maxvr-gate__input"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="http://server.example:8080"
              value={xtHost}
              onChange={(e) => setXtHost(e.target.value)}
            />
          </label>
          <label className="maxvr-gate__block">
            <span className="maxvr-gate__label">Username</span>
            <input
              className="maxvr-gate__input"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              value={xtUser}
              onChange={(e) => setXtUser(e.target.value)}
            />
          </label>
          <label className="maxvr-gate__block">
            <span className="maxvr-gate__label">Password</span>
            <input
              className="maxvr-gate__input"
              dir="ltr"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              value={xtPass}
              onChange={(e) => setXtPass(e.target.value)}
            />
          </label>

          <div className="maxvr-gate__block">
            <span className="maxvr-gate__label">رابط جهازك — أرسله للدعم أو افتحه بعد التفعيل</span>
            <div className="maxvr-gate__row">
              <code className="maxvr-gate__value" dir="ltr">
                {mediaPlayerDeviceUrl(mac, devicePin)}
              </code>
              <button
                type="button"
                className="maxvr-gate__copy"
                onClick={() => void handleCopy("device-link", mediaPlayerDeviceUrl(mac, devicePin))}
              >
                {copied === "device-link" ? "✓" : "نسخ"}
              </button>
            </div>
          </div>

          <div className="maxvr-gate__block">
            <span className="maxvr-gate__label">MAC Address</span>
            <div className="maxvr-gate__row">
              <code className="maxvr-gate__value" dir="ltr">
                {mac}
              </code>
              <button type="button" className="maxvr-gate__copy" onClick={() => void handleCopy("mac", mac)}>
                {copied === "mac" ? "✓" : "نسخ"}
              </button>
            </div>
          </div>

          <div className="maxvr-gate__block">
            <span className="maxvr-gate__label">رقم الجهاز</span>
            <div className="maxvr-gate__row">
              <code className="maxvr-gate__value maxvr-gate__value--pin" dir="ltr">
                {devicePin}
              </code>
              <button type="button" className="maxvr-gate__copy" onClick={() => void handleCopy("pin", devicePin)}>
                {copied === "pin" ? "✓" : "نسخ"}
              </button>
            </div>
          </div>

          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="maxvr-gate__whatsapp">
            إرسال بيانات الاشتراك عبر واتساب
          </a>

          <p className="maxvr-gate__hint">
            MAC Address ورقم الجهاز لا يتغيران على نفس المتصفح. أرسلهما مع Host و Username و Password. الدعم يفعّل هذا الجهاز مرة واحدة.
          </p>

          {error ? <p className="iptv-error">{error}</p> : null}

          <button type="button" className="iptv-login__btn maxvr-gate__check" disabled={checking} onClick={() => void handleCheckNow()}>
            {checking ? "جاري التحقق…" : "تحقق من التفعيل"}
          </button>

          {status === "pending" ? <p className="maxvr-gate__waiting">في انتظار التفعيل… (يتم التحقق تلقائياً)</p> : null}

          <div className="maxvr-gate__block" style={{ marginTop: 18 }}>
            <span className="maxvr-gate__label">سبق التفعيل ولم يعمل؟ أدخل MAC ورقم الجهاز من رسالة واتساب</span>
            <input
              className="maxvr-gate__input"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="00:1A:79:XX:XX:XX"
              value={restoreMac || mac}
              onChange={(e) => {
                setShowRestore(true);
                setRestoreMac(e.target.value);
              }}
            />
            <input
              className="maxvr-gate__input"
              dir="ltr"
              inputMode="numeric"
              maxLength={4}
              placeholder="رقم الجهاز"
              value={restorePin || devicePin}
              onChange={(e) => {
                setShowRestore(true);
                setRestorePin(e.target.value);
              }}
              style={{ marginTop: 8 }}
            />
            <button
              type="button"
              className="iptv-login__btn maxvr-gate__check"
              disabled={checking}
              onClick={() => void handleRestore()}
              style={{ marginTop: 10 }}
            >
              فتح المشغّل بهذا المعرّف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
