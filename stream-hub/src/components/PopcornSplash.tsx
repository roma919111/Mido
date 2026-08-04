import { useEffect, useRef, useState } from "react";
import { enterFullscreen, exitFullscreen } from "../lib/fullscreen";
import { POPCORN_DURATION_MS } from "../lib/playback";

type PopcornSplashProps = {
  title: string;
  platformName: string;
  onDone: () => void;
  needsTap?: boolean;
  onTapOpen?: () => void;
};

const KERNELS = ["🍿", "🍿", "✨", "🍿", "🎬", "🍿", "✨", "🍿"];

export function PopcornSplash({
  title,
  platformName,
  onDone,
  needsTap = false,
  onTapOpen,
}: PopcornSplashProps) {
  const [secondsLeft, setSecondsLeft] = useState(3);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    void enterFullscreen();

    const tick = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    const done = window.setTimeout(() => {
      onDoneRef.current();
    }, POPCORN_DURATION_MS);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
  }, []);

  useEffect(() => {
    if (!needsTap) return;
    void exitFullscreen().then(() => void enterFullscreen());
  }, [needsTap]);

  return (
    <div className="popcorn-splash" role="status" aria-live="polite">
      <div className="popcorn-splash__burst" aria-hidden="true">
        {KERNELS.map((emoji, i) => (
          <span key={i} className="popcorn-splash__bit" style={{ "--i": i } as React.CSSProperties}>
            {emoji}
          </span>
        ))}
      </div>

      <div className="popcorn-splash__core">
        <div className="popcorn-splash__bucket">🍿</div>
        <h2>{needsTap ? "جاهز!" : "جاري التشغيل"}</h2>
        <p className="popcorn-splash__title">{title}</p>
        <p className="popcorn-splash__subtitle">
          {needsTap ? `اضغط ▶ لفتح ${platformName}` : `يتصل بـ ${platformName}…`}
        </p>

        {needsTap ? (
          <button type="button" className="popcorn-splash__open" onClick={onTapOpen}>
            ▶ {platformName}
          </button>
        ) : (
          <p className="popcorn-splash__timer">{secondsLeft || "▶"}</p>
        )}
      </div>
    </div>
  );
}
