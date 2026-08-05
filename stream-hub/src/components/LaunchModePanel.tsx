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
        الافتراضي: المتصفح داخل MAX — الزبون لا يحتاج تحميل Netflix أو شاهد أو TOD.
      </p>
      <div className="launch-mode-panel__options">
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
