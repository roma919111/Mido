import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { enterPlaybackMode, exitPlaybackMode } from "../lib/fullscreen";

type IptvPlayerProps = {
  url: string;
  name: string;
  onBack: () => void;
};

export function IptvPlayer({ url, name, onBack }: IptvPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    enterPlaybackMode();
    return () => {
      void exitPlaybackMode();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      void video.play().catch(() => undefined);
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
      });
    } else {
      video.src = url;
    }

    return () => {
      hls?.destroy();
    };
  }, [url]);

  return (
    <div className="iptv-player">
      <header className="iptv-player__bar">
        <button type="button" className="iptv-player__back" onClick={onBack}>
          ← القنوات
        </button>
        <span className="iptv-player__title">{name}</span>
      </header>
      <video ref={videoRef} className="iptv-player__video" controls playsInline autoPlay />
    </div>
  );
}
