import { useState } from "react";
import {
  getLaunchPreference,
  launchPreferenceLabel,
  setLaunchPreference,
  type LaunchPreference,
} from "../lib/launch-preference";

export function LaunchModePanel() {
  const [mode, setMode] = useState<LaunchPreference>(() => getLaunchPreference());

  function select(next: LaunchPreference) {
    setLaunchPreference(next);
    setMode(next);
  }

  return (
    <section className="launch-mode-panel">
      <h3 className="launch-mode-panel__title">طريقة فتح المنصات</h3>
      <p className="launch-mode-panel__hint">
        الافتراضي على TV: <strong>ذكي</strong> — MAX فقط في البداية، Netflix/شاهد من Play Store
        عند ▶.
      </p>
      <div className="launch-mode-panel__options">
        <button
          type="button"
          className={mode === "smart" ? "active" : ""}
          onClick={() => select("smart")}
        >
          ✨ {launchPreferenceLabel("smart")}
        </button>
        <button
          type="button"
          className={mode === "web" ? "active" : ""}
          onClick={() => select("web")}
        >
          🌐 {launchPreferenceLabel("web")}
        </button>
        <button
          type="button"
          className={mode === "app" ? "active" : ""}
          onClick={() => select("app")}
        >
          📱 {launchPreferenceLabel("app")}
        </button>
      </div>
    </section>
  );
}
