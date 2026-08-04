import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { LaunchState } from "../types";
import { enterFullscreen } from "../lib/fullscreen";
import {
  beginOfficialLaunch,
  confirmPlatformLaunch,
  finishPlatformLaunch,
} from "../lib/playback";
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
  const [needsTap, setNeedsTap] = useState(false);
  const [tapDestination, setTapDestination] = useState<string | null>(null);
  const [platformLabel, setPlatformLabel] = useState("Netflix");

  useEffect(() => {
    if (!state) {
      setShowPopcorn(false);
      setNeedsTap(false);
      setTapDestination(null);
      return;
    }

    setPlatformLabel(state.platformName);
    setStep(0);
    setShowPopcorn(false);
    setNeedsTap(false);
    setTapDestination(null);
    const s1 = window.setTimeout(() => setStep(1), 300);
    const s2 = window.setTimeout(() => setStep(2), 700);

    return () => {
      window.clearTimeout(s1);
      window.clearTimeout(s2);
    };
  }, [state]);

  const finishPopcorn = useCallback(async () => {
    if (!state) return;
    const result = await finishPlatformLaunch(state);
    if (result.opened) {
      onDismiss();
      return;
    }
    setNeedsTap(true);
    setTapDestination(result.destination);
  }, [state, onDismiss]);

  const handleTapOpen = useCallback(async () => {
    if (!tapDestination) return;
    const opened = await confirmPlatformLaunch(tapDestination);
    if (opened) onDismiss();
  }, [tapDestination, onDismiss]);

  if (!state) return null;

  if (showPopcorn) {
    return (
      <OverlayPortal>
        <PopcornSplash
          title={state.title}
          platformName={platformLabel}
          onDone={() => void finishPopcorn()}
          needsTap={needsTap}
          onTapOpen={() => void handleTapOpen()}
        />
      </OverlayPortal>
    );
  }

  const isApp = state.launchMode === "android-app";

  function handleOpenNow() {
    if (!state) return;
    void enterFullscreen();
    flushSync(() => setShowPopcorn(true));
    beginOfficialLaunch(state);
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
          <p className="launch-overlay__list-tip">🍿 ملء الشاشة — ثم {state.platformName}</p>

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
