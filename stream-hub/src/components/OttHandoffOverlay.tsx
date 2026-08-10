import type { PlatformId } from "../types";
import { PLATFORMS } from "../lib/platforms";
import { ottHandoffLabel } from "../lib/playback-bridge";

type OttHandoffOverlayProps = {
  platform: PlatformId;
  title: string;
  onDismiss: () => void;
};

/**
 * Shown while official OTT app handles DRM in a separate task.
 * MAX dashboard stays mounted — user returns via system back or MAX button.
 */
export function OttHandoffOverlay({ platform, title, onDismiss }: OttHandoffOverlayProps) {
  const meta = PLATFORMS[platform];

  return (
    <div className="max-handoff" role="status" aria-live="polite">
      <div className="max-handoff__card">
        <span className="max-handoff__badge" style={{ background: meta.color }}>
          {meta.name}
        </span>
        <p className="max-handoff__title">{title}</p>
        <p className="max-handoff__hint">{ottHandoffLabel(platform)}</p>
        <p className="max-handoff__note">
          المحتوى المحمي (DRM) يُشغَّل عبر التطبيق الرسمي في الخلفية — لا يمكن عرضه داخل
          مشغّل MAX مباشرةً.
        </p>
        <button type="button" className="max-handoff__dismiss" onClick={onDismiss}>
          إخفاء — البقاء في MAX
        </button>
      </div>
    </div>
  );
}
