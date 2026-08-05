import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { PlatformId } from "../types";
import { openPlatformNow } from "../lib/platform-open";
import { isPlatformAppInstalled } from "../lib/platform-launch-native";
import { PLATFORMS } from "../lib/platforms";

const ORDER: PlatformId[] = ["netflix", "shahid", "tod"];

const HINTS: Record<PlatformId, string> = {
  netflix: "أفلام · مسلسلات · Netflix",
  shahid: "محتوى عربي · MBC Shahid",
  tod: "رياضة · beIN · TOD",
};

type PlatformLauncherProps = {
  onOpened?: (platform: PlatformId, mode: string) => void;
};

export function PlatformLauncher({ onOpened }: PlatformLauncherProps) {
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

  async function handleOpen(platform: PlatformId) {
    if (busy) return;
    setBusy(platform);
    setMsg(null);
    const result = await openPlatformNow(platform);
    setBusy(null);

    if (result === "app") {
      setMsg(`✓ ${PLATFORMS[platform].name} — سجّل دخولك في التطبيق`);
    } else if (result === "store") {
      setMsg(`📥 ثبّت ${PLATFORMS[platform].name} من المتجر ثم افتحه مرة أخرى`);
    } else if (result === "browser") {
      setMsg(`🌐 ${PLATFORMS[platform].name} في المتصفح`);
    } else {
      setMsg(`⚠️ تعذّر فتح ${PLATFORMS[platform].name}`);
    }

    onOpened?.(platform, result);
    window.setTimeout(() => setMsg(null), 5000);
  }

  return (
    <section className="platform-launcher">
      <header className="platform-launcher__head">
        <h1>اختر منصتك</h1>
        <p>ضغطة واحدة — تثبيت أو تشغيل · بدون خطوات إضافية</p>
      </header>

      {msg ? <p className="platform-launcher__msg">{msg}</p> : null}

      <div className="platform-launcher__grid">
        {ORDER.map((platform) => {
          const meta = PLATFORMS[platform];
          const isInstalled = installed[platform];
          const isBusy = busy === platform;

          return (
            <button
              key={platform}
              type="button"
              className="platform-launcher__tile"
              style={{ "--tile-color": meta.color } as React.CSSProperties}
              disabled={busy !== null}
              onClick={() => void handleOpen(platform)}
            >
              <span className="platform-launcher__logo">{meta.name.charAt(0)}</span>
              <strong>{meta.name}</strong>
              <span className="platform-launcher__hint">{HINTS[platform]}</span>
              <span className="platform-launcher__status">
                {isBusy
                  ? "جاري الفتح…"
                  : isInstalled
                    ? "✓ مثبت — اضغط OK"
                    : "📥 يفتح Play Store"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
