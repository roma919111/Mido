import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { CatalogItem, PlatformId } from "../types";
import { ottRowsForPlatform } from "../lib/ott-catalog";
import { platformUrl } from "../lib/ott-catalog";
import { isPlatformAppInstalled } from "../lib/platform-launch-native";
import { openPlatformNow } from "../lib/platform-open";
import { PLATFORMS } from "../lib/platforms";
import { IptvOttCatalogRow } from "./IptvOttCatalogRow";

const ORDER: PlatformId[] = ["netflix", "shahid", "tod"];

const TAGLINES: Record<PlatformId, string> = {
  netflix: "أفلام ومسلسلات عالمية — اضغط ▶ للتشغيل في Netflix",
  shahid: "محتوى عربي — اضغط ▶ للتشغيل في شاهد",
  tod: "رياضة وبث مباشر — اضغط ▶ للتشغيل في TOD",
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
    window.setTimeout(() => setMsg(null), 4000);
  }

  async function openApp(platform: PlatformId) {
    if (busyPlatform) return;
    setBusyPlatform(platform);
    showMsg(`جاري فتح ${PLATFORMS[platform].name}…`);
    await openPlatformNow(platform);
    setBusyPlatform(null);
  }

  async function playTitle(item: CatalogItem, platform: PlatformId) {
    const url = platformUrl(item, platform);
    if (!url || busyPlatform) return;
    setBusyPlatform(platform);
    showMsg(`جاري فتح «${item.title}» على ${PLATFORMS[platform].name}…`);
    await openPlatformNow(platform, url);
    setBusyPlatform(null);
  }

  return (
    <div className="max-show__ott">
      <header className="max-show__ott-head">
        <h1>البرامج الرسمية</h1>
        <p>بوسترات + روابط مباشرة — التشغيل في تطبيق Netflix / شاهد / TOD الرسمي</p>
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
                onClick={() => void openApp(platform)}
              >
                {isBusy ? "…" : isInstalled ? `▶ فتح ${meta.name}` : `📲 ${meta.name}`}
              </button>
            </div>

            {rows.map((row) => (
              <IptvOttCatalogRow
                key={row.id}
                title={row.title}
                items={row.items}
                platform={platform}
                onPlay={(item, p) => void playTitle(item, p)}
                busy={busyPlatform !== null}
              />
            ))}
          </section>
        );
      })}

      <p className="max-show__ott-note">
        المحتوى يُشغَّل في التطبيق الرسمي — تحتاج اشتراك Netflix/شاهد/TOD من المنصة نفسها. MAX
        يعرض قائمة المحتوى ويفتح الرابط المباشر.
      </p>
    </div>
  );
}
