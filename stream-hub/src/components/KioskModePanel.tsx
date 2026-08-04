import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { isStandaloneApp, isBrowserTab } from "../lib/display-mode";
import { isKioskEnabled, setKioskEnabled } from "../lib/kiosk-mode";

export function KioskModePanel() {
  const [enabled, setEnabled] = useState(isKioskEnabled);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setKioskEnabled(next);
  }

  const installed = isStandaloneApp() || Capacitor.isNativePlatform();

  return (
    <section className="kiosk-panel">
      <header className="kiosk-panel__head">
        <div>
          <h3 className="kiosk-panel__title">🖥️ وضع Kiosk</h3>
          <p className="kiosk-panel__lead">إخفاء شريط المتصفح — واجهة تطبيق كامل</p>
        </div>
        <label className="kiosk-panel__switch">
          <input type="checkbox" checked={enabled} onChange={handleToggle} />
          <span className="kiosk-panel__track" aria-hidden="true" />
        </label>
      </header>

      <ul className="kiosk-panel__list">
        <li>{enabled ? "✅" : "○"} ملء الشاشة بدون شريط عنوان</li>
        <li>{enabled ? "✅" : "○"} منع قائمة النقر بالزر الأيمن</li>
        <li>{enabled ? "✅" : "○"} إبقاء الشاشة مضاءة أثناء الاستخدام</li>
      </ul>

      {isBrowserTab() && !installed ? (
        <p className="kiosk-panel__hint">
          للتجربة الكاملة: ثبّت MAX من Chrome (⋮ → تثبيت التطبيق) ثم فعّل Kiosk.
        </p>
      ) : (
        <p className="kiosk-panel__hint">
          للخروج: حسابي → أوقف Kiosk · أو زر ← داخل MAX.
        </p>
      )}
    </section>
  );
}
