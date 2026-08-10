import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { enterPlaybackMode, exitPlaybackMode } from "../lib/fullscreen";

export type CustomVideoContainerProps = {
  title: string;
  streamUrl: string;
  posterUrl?: string;
  onClose: () => void;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Walled-garden custom player for direct streams (IPTV / licensed HLS).
 * Remote-friendly controls — no third-party OTT UI exposed.
 */
export function CustomVideoContainer({
  title,
  streamUrl,
  posterUrl,
  onClose,
}: CustomVideoContainerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

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
      video.src = streamUrl;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
    } else {
      video.src = streamUrl;
    }

    void video.play().catch(() => setPlaying(false));

    return () => {
      hls?.destroy();
    };
  }, [streamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => setPosition(video.currentTime);
    const onMeta = () => setDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function seekTo(ratio: number) {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = ratio * duration;
  }

  function handleKey(e: React.KeyboardEvent) {
    const video = videoRef.current;
    if (!video) return;
    switch (e.key) {
      case " ":
      case "Enter":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        break;
      case "ArrowLeft":
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case "Escape":
      case "Backspace":
        onClose();
        break;
      default:
        break;
    }
  }

  const progress = duration > 0 ? position / duration : 0;

  return (
    <div
      className="max-player"
      role="dialog"
      aria-label={title}
      tabIndex={0}
      onKeyDown={handleKey}
    >
      <video
        ref={videoRef}
        className="max-player__video"
        poster={posterUrl}
        playsInline
        autoPlay
      />

      <div className="max-player__chrome">
        <header className="max-player__top">
          <button type="button" className="max-player__back" onClick={onClose}>
            ← MAX
          </button>
          <h2 className="max-player__title">{title}</h2>
        </header>

        <div className="max-player__controls">
          <button type="button" className="max-player__btn" onClick={togglePlay}>
            {playing ? "⏸" : "▶"}
          </button>

          <span className="max-player__time">
            {formatTime(position)} / {formatTime(duration)}
          </span>

          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            className="max-player__seek"
            aria-label="Seek"
            onChange={(e) => seekTo(Number(e.target.value))}
          />

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            className="max-player__volume"
            aria-label="Volume"
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              if (videoRef.current) videoRef.current.volume = v;
            }}
          />
        </div>
      </div>
    </div>
  );
}
