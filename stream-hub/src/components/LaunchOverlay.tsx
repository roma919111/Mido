import { useEffect, useState } from "react";
import type { LaunchState } from "../types";
import { cancelLaunch, openLaunchTarget } from "../lib/playback";

type LaunchOverlayProps = {
  state: LaunchState | null;
  onCancel: () => void;
  onDismiss: () => void;
};

export function LaunchOverlay({ state, onCancel, onDismiss }: LaunchOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!state) return;

    const totalSec = Math.ceil(state.countdownMs / 1000);
    setSecondsLeft(totalSec);
    setStep(0);

    const tick = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    const s1 = window.setTimeout(() => setStep(1), 400);
    const s2 = window.setTimeout(() => setStep(2), 900);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(s1);
      window.clearTimeout(s2);
    };
  }, [state]);

  if (!state) return null;

  const isApp = state.launchMode === "android-app";
  const progress = state.countdownMs
    ? ((state.countdownMs / 1000 - secondsLeft) / (state.countdownMs / 1000)) * 100
    : 100;

  function handleOpenNow() {
    cancelLaunch();
    openLaunchTarget(state!);
    onDismiss();
  }

  const steps = [
    "تحضير الرابط المباشر للفيلم",
    isApp ? `فتح تطبيق ${state.platformName}` : `فتح ${state.platformName}`,
    "اضغط ▶ Play إن لم يبدأ تلقائياً",
  ];

  return (
    <div className="launch-overlay">
      <div className="launch-overlay__card">
        <div className="launch-overlay__count">{secondsLeft || "▶"}</div>
        <div className="launch-overlay__progress">
          <div className="launch-overlay__progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <h2>جاري التشغيل</h2>
        <p className="launch-overlay__title">{state.title}</p>
        <p className="launch-overlay__via">عبر {state.launchLabel}</p>
        <p className="launch-overlay__hint">{state.deepLinkHint}</p>

        <ul className="launch-overlay__steps">
          {steps.map((label, i) => (
            <li key={label} className={i <= step ? "done" : ""}>
              {i < step ? "✓" : i === step ? "→" : "○"} {label}
            </li>
          ))}
        </ul>

        <button type="button" className="btn btn--primary launch-overlay__open" onClick={handleOpenNow}>
          فتح الآن
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
