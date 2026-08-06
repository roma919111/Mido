import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { PlatformId } from "../types";
import { isPlatformAppInstalled } from "../lib/platform-launch-native";
import { openPlatformNow } from "../lib/platform-open";
import { PLATFORMS } from "../lib/platforms";

const ORDER: PlatformId[] = ["netflix", "shahid", "tod"];

const TAGLINES: Record<PlatformId, string> = {
  netflix: "أفلام ومسلسلات عالمية",
  shahid: "محتوى عربي — MBC",
  tod: "رياضة وبث مباشر",
};

export function IptvOttPanel() {
  const [installed, setInstalled] = useState<Record<PlatformId, boolean>>({
    netflix: false,
    shahid: false,
    tod: false,
  });
  const [busy, setBusy] = useState<PlatformId | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void (async () => {
      const next: Record<PlatformId, boolean> = { netflix: false, shahid: false, tod: false };
      for (const id of ORDER) {
        next[id] = await isPlatformAppInstalled(id);
      }
      setInstalled(next);
    })();
  }, [busy]);

  async function open(platform: PlatformId) {
    if (busy) return;
    setBusy(platform);
    setMsg(`جاري فتح ${PLATFORMS[platform].name}…`);
    const result = await openPlatformNow(platform);
    if (result === "app") {
      setMsg(`${PLATFORMS[platform].name} — تم فتح التطبيق`);
    } else if (result === "store") {
      setMsg(`حمّل ${PLATFORMS[platform].name} من Play Store ثم سجّل دخولك`);
    } else if (result === "browser") {
      setMsg(`${PLATFORMS[platform].name} — في المتصفح · سجّل دخولك مرة واحدة`);
    } else {
      setMsg(`تعذر فتح ${PLATFORMS[platform].name} — جرّب مرة أخرى`);
    }
    setBusy(null);
    window.setTimeout(() => setMsg(null), 4000);
  }

  return (
    <section className="max-show__ott">
      <header className="max-show__ott-head">
        <h1>البرامج الرسمية</h1>
        <p>Netflix · شاهد · TOD — تفتح في تطبيقها الرسمي أو المتصفح</p>
      </header>

      {msg ? <p className="max-show__ott-msg">{msg}</p> : null}

      <div className="max-show__ott-grid">
        {ORDER.map((platform) => {
          const meta = PLATFORMS[platform];
          const isInstalled = installed[platform];
          const isBusy = busy === platform;

          return (
            <button
              key={platform}
              type="button"
              className="max-show__ott-tile"
              style={{ "--ott-color": meta.color } as React.CSSProperties}
              disabled={busy !== null}
              onClick={() => void open(platform)}
            >
              <span className="max-show__ott-logo">{meta.name.charAt(0)}</span>
              <strong>{meta.name}</strong>
              <span className="max-show__ott-tagline">{TAGLINES[platform]}</span>
              <span className="max-show__ott-status">
                {isBusy ? "…" : isInstalled ? "▶ فتح التطبيق" : "📲 تطبيق أو متصفح"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="max-show__ott-note">
        MAX يربطك بالتطبيقات الرسمية فقط — لا يمكن تشغيل Netflix داخل MAX. سجّل دخولك مرة واحدة
        في كل تطبيق.
      </p>
    </section>
  );
}
