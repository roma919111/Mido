import type { PlatformId } from "../types";
import { PLATFORMS } from "../lib/platforms";
import { OverlayPortal } from "./OverlayPortal";

export type PlatformInstallPromptProps = {
  platform: PlatformId;
  title: string;
  onInstallPlayStore: () => void;
  onOpenBrowser: () => void;
  onCancel: () => void;
};

export function PlatformInstallPrompt({
  platform,
  title,
  onInstallPlayStore,
  onOpenBrowser,
  onCancel,
}: PlatformInstallPromptProps) {
  const meta = PLATFORMS[platform];

  return (
    <OverlayPortal>
      <div className="platform-install-prompt" role="dialog" aria-modal="true">
        <div className="platform-install-prompt__card">
          <p className="platform-install-prompt__badge">تثبيت عند الحاجة</p>
          <h2>{meta.name} غير مثبت</h2>
          <p className="platform-install-prompt__lead">
            لتشغيل «{title}» — ثبّت تطبيق {meta.name} الرسمي من Google Play، أو تابع في
            المتصفح بدون تثبيت.
          </p>

          <div className="platform-install-prompt__actions">
            <button type="button" className="platform-install-prompt__primary" onClick={onInstallPlayStore}>
              📥 ثبّت {meta.name} من Play Store
            </button>
            <button type="button" className="platform-install-prompt__secondary" onClick={onOpenBrowser}>
              🌐 متابعة في المتصفح
            </button>
            <button type="button" className="platform-install-prompt__ghost" onClick={onCancel}>
              إلغاء
            </button>
          </div>

          <p className="platform-install-prompt__note">
            بعد التثبيت من Play Store، ارجع لـ MAX — سيُفتح الفيلم تلقائياً.
          </p>
        </div>
      </div>
    </OverlayPortal>
  );
}
