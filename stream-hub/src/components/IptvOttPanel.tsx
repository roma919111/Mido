import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { PlatformId } from "../types";
import { enterKioskMode } from "../lib/kiosk-mode";
import { enterPlaybackMode } from "../lib/fullscreen";
import { ottRowsForPlatform, platformUrl } from "../lib/ott-catalog";
import { isPlatformAppInstalled } from "../lib/platform-launch-native";
import { openPlatformLocked } from "../lib/platform-open";
import { PLATFORMS } from "../lib/platforms";
import { IptvOttCatalogRow } from "./IptvOttCatalogRow";

const ORDER: PlatformId[] = ["netflix", "shahid", "tod"];

const TAGLINES: Record<PlatformId, string> = {
  netflix: "deeplink → Netflix · واجهة MAX مقفولة",
  shahid: "deeplink → شاهد · واجهة MAX مقفولة",
  tod: "deeplink → TOD · واجهة MAX مقفولة",
};

export function IptvOttPanel() {
  const [installed, setInstalled] = useState<Record<PlatformId, boolean>>({
    netflix: false,
    shahid: false,
    tod: false,
  });
  const [busyPlatform, setBusyPlatform] = useState<PlatformId | null>(null);
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
  }, [busyPlatform]);

  function showMsg(text: string) {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 5000);
  }

  async function openLocked(platform: PlatformId, url?: string) {
    if (busyPlatform) return;
    setBusyPlatform(platform);
    enterPlaybackMode();
    await enterKioskMode();
    showMsg(`جاري فتح ${PLATFORMS[platform].name}…`);
    const result = await openPlatformLocked(platform, url);
    if (result === "app") {
      showMsg(`${PLATFORMS[platform].name} — التشغيل في التطبيق · ارجع ← MAX`);
    } else if (result === "browser") {
      showMsg(`${PLATFORMS[platform].name} — deeplink · ارجع ← MAX`);
    } else {
      showMsg(`تعذر الفتح — جرّب مرة أخرى`);
    }
    setBusyPlatform(null);
  }

  return (
    <div className="max-show__ott">
      <header className="max-show__ott-head">
        <h1>البرامج الرسمية</h1>
        <p>▶ deeplink للفيلم · واجهة MAX تبقى مقفولة · زر ← MAX للرجوع</p>
      </header>

      {msg ? <p className="max-show__ott-msg">{msg}</p> : null}

      {ORDER.map((platform) => {
        const meta = PLATFORMS[platform];
        const rows = ottRowsForPlatform(platform);
        const isInstalled = installed[platform];
        const isBusy = busyPlatform === platform;

        if (!rows.length) return null;

        return (
          <section key={platform} className="max-show__ott-platform">
            <div className="max-show__ott-platform-head">
              <div>
                <h2 style={{ color: meta.color }}>{meta.name}</h2>
                <p>{TAGLINES[platform]}</p>
              </div>
              <button
                type="button"
                className="max-show__ott-open-app"
                style={{ "--ott-color": meta.color } as React.CSSProperties}
                disabled={busyPlatform !== null}
                onClick={() => void openLocked(platform)}
              >
                {isBusy ? "…" : isInstalled ? `▶ ${meta.name}` : `📲 ${meta.name}`}
              </button>
            </div>

            {rows.map((row) => (
              <IptvOttCatalogRow
                key={row.id}
                title={row.title}
                items={row.items}
                platform={platform}
                onPlay={(item, p) => {
                  const url = platformUrl(item, p);
                  if (url) void openLocked(p, url);
                }}
                busy={busyPlatform !== null}
              />
            ))}
          </section>
        );
      })}

      <p className="max-show__ott-note">
        IPTV (Live/Movies) يُشغَّل داخل MAX بالكامل. Netflix/شاهد/TOD: deeplink يفتح التطبيق
        الرسمي — DRM يمنع التشغيل داخل MAX. بوسترات من TMDB.
      </p>
    </div>
  );
}
