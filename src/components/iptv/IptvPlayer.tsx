"use client";

import { useEffect, useRef } from "react";

type IptvPlayerProps = {
  url: string;
  name: string;
  onBack: () => void;
};

export function IptvPlayer({ url, name, onBack }: IptvPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.src = url;
    void video.play().catch(() => undefined);
    return () => {
      video.removeAttribute("src");
      video.load();
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
