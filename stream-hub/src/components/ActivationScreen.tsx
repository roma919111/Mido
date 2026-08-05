import { useEffect, useState } from "react";
import { getDeviceId, getDeviceMac } from "../lib/device-id";
import {
  fetchActivationStatus,
  getActivationPollMs,
  registerForActivation,
} from "../lib/activation";

type ActivationScreenProps = {
  onActivated: () => void;
};

export function ActivationScreen({ onActivated }: ActivationScreenProps) {
  const deviceId = getDeviceId();
  const deviceMac = getDeviceMac(deviceId);
  const [status, setStatus] = useState("جاري الاتصال بالسيرفر…");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    async function poll() {
      setChecking(true);
      const result = await fetchActivationStatus(deviceId);
      setChecking(false);
      if (cancelled) return;

      if (result.activated) {
        setStatus("✓ تم التفعيل — مرحباً");
        window.setTimeout(onActivated, 600);
        return true;
      }
      setStatus("بانتظار تفعيل اشتراكك من المزود…");
      return false;
    }

    async function start() {
      await registerForActivation();
      if (cancelled) return;
      const done = await poll();
      if (done || cancelled) return;
      intervalId = window.setInterval(() => void poll(), getActivationPollMs());
    }

    void start();
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [deviceId, onActivated]);

  return (
    <div className="activation-screen">
      <div className="activation-screen__card">
        <div className="activation-screen__logo">MAX</div>
        <h1>MAX Media Player</h1>
        <p className="activation-screen__lead">جهازك بانتظار التفعيل</p>

        <div className="activation-screen__id-box">
          <span className="activation-screen__id-label">Device ID</span>
          <strong className="activation-screen__id">{deviceId}</strong>
          <span className="activation-screen__mac">MAC: {deviceMac}</span>
        </div>

        <p className={`activation-screen__status ${checking ? "is-checking" : ""}`}>{status}</p>

        <p className="activation-screen__hint">
          أرسل Device ID للمزود (WhatsApp) — سيتم التفعيل عن بُعد خلال دقائق.
        </p>
      </div>
    </div>
  );
}
