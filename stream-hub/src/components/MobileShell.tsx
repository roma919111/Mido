import type { ReactNode } from "react";

type MobileShellProps = {
  children: ReactNode;
};

/**
 * On laptop/desktop: shows app inside a phone frame for mobile UX testing.
 * On real phones: full-screen native layout.
 */
export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="mobile-lab">
      <div className="mobile-lab__aside" aria-hidden>
        <p className="mobile-lab__title">Stream Hub</p>
        <p className="mobile-lab__subtitle">معاينة موبايل على اللابتوب</p>
        <ul className="mobile-lab__tips">
          <li>390×844 — مقاس iPhone</li>
          <li>▶ تشغيل → 🍿 ثم المنصة الرسمية</li>
        </ul>
      </div>

      <div className="phone-frame">
        <div className="phone-frame__bezel">
          <div className="phone-frame__speaker" />
          <div className="phone-frame__screen">{children}</div>
          <div className="phone-frame__home-indicator" />
        </div>
      </div>
    </div>
  );
}
