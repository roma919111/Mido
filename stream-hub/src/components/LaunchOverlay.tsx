import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { LaunchState } from "../types";
import { getPlaybackEnvironment } from "../lib/browser-capabilities";
import { openLaunchTarget } from "../lib/playback";

type LaunchOverlayProps = {
  state: LaunchState | null;
  onCancel: () => void;
  onDismiss: () => void;
};

export function LaunchOverlay({ state, onCancel, onDismiss }: LaunchOverlayProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!state) return;

    setStep(0);
    const s1 = window.setTimeout(() => setStep(1), 300);
    const s2 = window.setTimeout(() => setStep(2), 700);

    return () => {
      window.clearTimeout(s1);
      window.clearTimeout(s2);
    };
  }, [state]);

  if (!state) return null;

  const env = getPlaybackEnvironment(Capacitor.isNativePlatform());
  const isApp = state.launchMode === "android-app";

  function handleOpenNow() {
    openLaunchTarget(state!);
    onDismiss();
  }

  const steps = [
    "تحضير الرابط المباشر للفيلم",
    isApp ? `جاهز — تطبيق ${state.platformName}` : `جاهز — ${state.platformName}`,
    "اضغط «فتح الآن» للانتقال",
  ];

  return (
    <div className="launch-overlay">
      <div className="launch-overlay__card">
        <div className="launch-overlay__count">▶</div>

        <h2>جاهز للتشغيل</h2>
        <p className="launch-overlay__title">{state.title}</p>
        <p className="launch-overlay__via">عبر {state.launchLabel}</p>
        <p className="launch-overlay__hint">{state.deepLinkHint}</p>
        <p className="launch-overlay__list-tip">
          بعد فتح Netflix: ارجع هنا → 📋 قائمتي → ▶ للمتابعة
        </p>

        {env.warning ? (
          <div className="launch-overlay__warn">
            <p>{env.warning}</p>
            <p>{env.recommendation}</p>
          </div>
        ) : null}

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
