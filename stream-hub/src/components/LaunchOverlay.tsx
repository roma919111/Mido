import type { LaunchState } from "../types";

type LaunchOverlayProps = {
  state: LaunchState | null;
  onCancel: () => void;
};

export function LaunchOverlay({ state, onCancel }: LaunchOverlayProps) {
  if (!state) return null;

  return (
    <div className="launch-overlay">
      <div className="launch-overlay__card">
        <div className="launch-overlay__spinner" />
        <h2>جاري التشغيل</h2>
        <p>
          <strong>{state.title}</strong>
          <br />
          عبر {state.platformName}
        </p>
        <p className="launch-overlay__hint">
          سيتم فتح المنصة الرسمية للتشغيل. ارجع للتطبيق بالزر الخلفي.
        </p>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
