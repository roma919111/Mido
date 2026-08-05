import { useEffect, useRef, useState } from "react";
import { POPCORN_DURATION_MS } from "../lib/playback";

type PopcornSplashProps = {
  title: string;
  platformName: string;
  onDone: () => void;
};

const KERNELS = [
  "🍿", "🍿", "✨", "🍿", "🎬", "🍿", "✨", "🍿",
  "🍿", "✨", "🍿", "🎬", "✨", "🍿", "🍿", "✨",
];

export function PopcornSplash({ title, platformName, onDone }: PopcornSplashProps) {
  const totalSeconds = Math.ceil(POPCORN_DURATION_MS / 1000);
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
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
  }, [totalSeconds]);

  return (
    <div
      className="popcorn-splash"
      style={{ "--popcorn-duration": `${POPCORN_DURATION_MS}ms` } as React.CSSProperties}
      role="status"
      aria-live="polite"
    >
      <div className="popcorn-splash__glow" aria-hidden="true" />
      <div className="popcorn-splash__burst" aria-hidden="true">
        {KERNELS.map((emoji, i) => (
          <span key={i} className="popcorn-splash__bit" style={{ "--i": i } as React.CSSProperties}>
            {emoji}
          </span>
        ))}
      </div>

      <div className="popcorn-splash__core">
        <div className="popcorn-splash__bucket">🍿</div>
        <h2>جاري التشغيل</h2>
        <p className="popcorn-splash__title">{title}</p>
        <p className="popcorn-splash__subtitle">
          🍿 {totalSeconds} ثوانٍ — يُفتح {platformName} بملء الشاشة في تطبيقه · ✕ للإلغاء
        </p>
        <p className="popcorn-splash__timer">{secondsLeft || "▶"}</p>
      </div>
    </div>
  );
}
