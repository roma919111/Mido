import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { LaunchState } from "../types";
import { beginOfficialLaunch, finishPlatformLaunch, keepStreamHubFocused } from "../lib/playback";
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
  const [platformLabel, setPlatformLabel] = useState("Netflix");

  useEffect(() => {
    if (!state) {
      setShowPopcorn(false);
      return;
    }

    setPlatformLabel(state.platformName);
    setStep(0);
    setShowPopcorn(false);
    const s1 = window.setTimeout(() => setStep(1), 300);
    const s2 = window.setTimeout(() => setStep(2), 700);

    return () => {
      window.clearTimeout(s1);
      window.clearTimeout(s2);
    };
  }, [state]);

  const finishPopcorn = useCallback(() => {
    if (state) finishPlatformLaunch(state);
    onDismiss();
  }, [state, onDismiss]);

  if (!state) return null;

  if (showPopcorn) {
    return (
      <OverlayPortal>
        <PopcornSplash title={state.title} platformName={platformLabel} onDone={finishPopcorn} />
      </OverlayPortal>
    );
  }

  const isApp = state.launchMode === "android-app";

  function handleOpenNow() {
    if (!state) return;
    flushSync(() => setShowPopcorn(true));
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        beginOfficialLaunch(state);
        keepStreamHubFocused();
      });
    });
  }

  const steps = [
    "تحضير رابط التشغيل",
    isApp ? `تطبيق ${state.platformName}` : state.platformName,
    "🍿 ثم التشغيل على المنصة",
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
          <p className="launch-overlay__list-tip">🍿 يظهر أولاً — ثم يُفتح {state.platformName}</p>

          <ul className="launch-overlay__steps">
            {steps.map((label, i) => (
              <li key={label} className={i <= step ? "done" : ""}>
                {i < step ? "✓" : i === step ? "→" : "○"} {label}
              </li>
            ))}
          </ul>

          <button type="button" className="btn btn--primary launch-overlay__open" onClick={handleOpenNow}>
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
