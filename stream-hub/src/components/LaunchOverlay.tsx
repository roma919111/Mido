import type { LaunchState } from "../types";
import { openLaunchTarget } from "../lib/playback";

type LaunchOverlayProps = {
  state: LaunchState | null;
  blocked?: boolean;
  onCancel: () => void;
  onDismiss: () => void;
};

export function LaunchOverlay({ state, blocked, onCancel, onDismiss }: LaunchOverlayProps) {
  if (!state) return null;

  function handleOpenNow() {
    if (!state) return;
    openLaunchTarget(state);
    onDismiss();
  }

  return (
    <div className="launch-overlay">
      <div className="launch-overlay__card">
        <div className="launch-overlay__spinner" />
        <h2>جاري فتح {state.platformName}</h2>
        <p>
          <strong>{state.title}</strong>
        </p>

        {blocked ? (
          <p className="launch-overlay__warn">
            المتصفح منع الفتح التلقائي. اضغط الزر أدناه لفتح المنصة الرسمية.
          </p>
        ) : (
          <p className="launch-overlay__hint">
            إذا لم يفتح تلقائياً خلال ثوانٍ، اضغط «فتح الآن».
            <br />
            يجب أن تكون مسجّل الدخول في {state.platformName} على هذا الجهاز.
          </p>
        )}

        <button type="button" className="btn btn--primary launch-overlay__open" onClick={handleOpenNow}>
          ▶ فتح {state.platformName} الآن
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
