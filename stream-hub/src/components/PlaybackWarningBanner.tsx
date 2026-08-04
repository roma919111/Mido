import { Capacitor } from "@capacitor/core";
import { getPlaybackEnvironment } from "../lib/browser-capabilities";

export function PlaybackWarningBanner() {
  const env = getPlaybackEnvironment(Capacitor.isNativePlatform());

  if (!env.warning) return null;

  return (
    <div className="playback-warning" role="status">
      <strong>⚠️ لماذا يظهر «رفض» في المتصفح؟</strong>
      <p>{env.warning}</p>
      <p className="playback-warning__tip">{env.recommendation}</p>
    </div>
  );
}
