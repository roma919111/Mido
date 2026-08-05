import { useState } from "react";
import type { PlatformId } from "../types";
import { openPlatformNow } from "../lib/platform-open";
import { PLATFORMS } from "../lib/platforms";

const ORDER: PlatformId[] = ["netflix", "shahid", "tod"];

export function OttQuickBar() {
  const [busy, setBusy] = useState<PlatformId | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function open(platform: PlatformId) {
    if (busy) return;
    setBusy(platform);
    setMsg(`جاري فتح ${PLATFORMS[platform].name}…`);
    await openPlatformNow(platform);
    setMsg(null);
    setBusy(null);
  }

  return (
    <section className="ott-bar">
      <h2 className="ott-bar__title">منصات البث (Netflix / شاهد / TOD)</h2>
      <p className="ott-bar__hint">تفتح في التطبيق أو المتصفح — سجّل دخولك مرة واحدة في Netflix</p>
      {msg ? <p className="ott-bar__msg">{msg}</p> : null}
      <div className="ott-bar__grid">
        {ORDER.map((platform) => {
          const meta = PLATFORMS[platform];
          return (
            <button
              key={platform}
              type="button"
              className="ott-bar__btn"
              style={{ "--ott-color": meta.color } as React.CSSProperties}
              disabled={busy !== null}
              onClick={() => void open(platform)}
            >
              <span className="ott-bar__name">{meta.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
