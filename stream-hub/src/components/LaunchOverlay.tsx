import type { LaunchState } from "../types";
import { openLaunchTarget } from "../lib/playback";

type LaunchOverlayProps = {
  state: LaunchState | null;
  onCancel: () => void;
  onDismiss: () => void;
};

export function LaunchOverlay({ state, onCancel, onDismiss }: LaunchOverlayProps) {
  if (!state) return null;

  const isAppLaunch = state.launchMode === "android-app";

  function handleOpenNow() {
    if (!state) return;
    openLaunchTarget(state);
    onDismiss();
  }

  return (
    <div className="launch-overlay">
      <div className="launch-overlay__card">
        <div className="launch-overlay__spinner" />
        <h2>جاري فتح {state.launchLabel}</h2>
        <p>
          <strong>{state.title}</strong>
        </p>

        <p className="launch-overlay__hint">
          {isAppLaunch ? (
            <>
              <strong>نفس أسلوب Google TV:</strong> التصفح هنا، التشغيل في تطبيق{" "}
              {state.platformName} الرسمي.
              <br />
              ارجع بزر «رجوع» بعد المشاهدة.
            </>
          ) : (
            <>
              سيتم فتح {state.platformName}. سجّل الدخول مرة واحدة على هذا الجهاز.
            </>
          )}
        </p>

        <button type="button" className="btn btn--primary launch-overlay__open" onClick={handleOpenNow}>
          ▶ فتح {state.platformName}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
