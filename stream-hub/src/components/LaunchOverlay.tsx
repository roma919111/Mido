import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { LaunchState } from "../types";
import { getPlaybackEnvironment } from "../lib/browser-capabilities";
import { openLaunchTarget } from "../lib/playback";
import { OverlayPortal } from "./OverlayPortal";
import { PopcornSplash } from "./PopcornSplash";

type LaunchOverlayProps = {
  state: LaunchState | null;
  onCancel: () => void;
  onDismiss: () => void;
};

export function LaunchOverlay({ state, onCancel, onDismiss }: LaunchOverlayProps) {
  const [step, setStep] = useState(0);
  const [showPopcorn, setShowPopcorn] = useState(false);

  useEffect(() => {
    if (!state) {
      setShowPopcorn(false);
      return;
    }

    setStep(0);
    setShowPopcorn(false);
    const s1 = window.setTimeout(() => setStep(1), 300);
    const s2 = window.setTimeout(() => setStep(2), 700);

    return () => {
      window.clearTimeout(s1);
      window.clearTimeout(s2);
    };
  }, [state]);

  const finishOpen = useCallback(() => {
    if (!state) return;
    openLaunchTarget(state);
    onDismiss();
  }, [state, onDismiss]);

  if (!state) return null;

  if (showPopcorn) {
    return (
      <OverlayPortal>
        <PopcornSplash title={state.title} onDone={finishOpen} />
      </OverlayPortal>
    );
  }

  const env = getPlaybackEnvironment(Capacitor.isNativePlatform());
  const isApp = state.launchMode === "android-app";

  const steps = [
    "تحضير الرابط المباشر للفيلم",
    isApp ? `جاهز — تطبيق ${state.platformName}` : `جاهز — ${state.platformName}`,
    "اضغط «فتح الآن» — يظهر 🍿 ثم يفتح",
  ];

  return (
    <OverlayPortal>
      <div className="launch-overlay">
        <div className="launch-overlay__card">
          <div className="launch-overlay__count">▶</div>

          <h2>جاهز للتشغيل</h2>
          <p className="launch-overlay__title">{state.title}</p>
          <p className="launch-overlay__via">عبر {state.launchLabel}</p>
          <p className="launch-overlay__hint">{state.deepLinkHint}</p>
          <p className="launch-overlay__list-tip">
            لن يُفتح Netflix إلا بعد «فتح الآن» + 🍿 (3 ثوانٍ)
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

          <button
            type="button"
            className="btn btn--primary launch-overlay__open"
            onClick={() => setShowPopcorn(true)}
          >
            فتح الآن 🍿
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            إلغاء
          </button>
        </div>
      </div>
    </OverlayPortal>
  );
}
