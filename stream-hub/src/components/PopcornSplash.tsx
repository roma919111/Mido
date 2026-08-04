import { useEffect, useRef, useState } from "react";

export const POPCORN_DURATION_MS = 3000;

type PopcornSplashProps = {
  title: string;
  onDone: () => void;
};

const KERNELS = ["🍿", "🍿", "✨", "🍿", "🎬", "🍿", "✨", "🍿"];

export function PopcornSplash({ title, onDone }: PopcornSplashProps) {
  const [secondsLeft, setSecondsLeft] = useState(3);
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
  }, []);

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
        <h2>بالعافية!</h2>
        <p className="popcorn-splash__title">{title}</p>
        <p className="popcorn-splash__timer">{secondsLeft || "▶"}</p>
      </div>
    </div>
  );
}
