import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { PlatformId } from "../types";
import { openPlatformNow } from "../lib/platform-open";
import { isPlatformAppInstalled } from "../lib/platform-launch-native";
import { PLATFORMS } from "../lib/platforms";

const ORDER: PlatformId[] = ["netflix", "shahid", "tod"];

const HINTS: Record<PlatformId, string> = {
  netflix: "اضغط OK",
  shahid: "اضغط OK",
  tod: "اضغط OK",
};

type PlatformLauncherProps = {
  onOpen?: (platform: PlatformId) => void | Promise<void>;
};

export function PlatformLauncher({ onOpen }: PlatformLauncherProps) {
  const [installed, setInstalled] = useState<Record<PlatformId, boolean>>({
    netflix: false,
    shahid: false,
    tod: false,
  });
  const [busy, setBusy] = useState<PlatformId | null>(null);

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
    if (onOpen) {
      await onOpen(platform);
    } else {
      await openPlatformNow(platform);
    }
    setBusy(null);
  }

  return (
    <section className="platform-launcher">
      <header className="platform-launcher__head">
        <h1>ماذا تريد أن تشاهد؟</h1>
        <p>ضغطة واحدة — بدون كلمة مرور · بدون إعدادات</p>
      </header>

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
                {isBusy ? "…" : isInstalled ? "▶ تشغيل" : "📥 تثبيت + تشغيل"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
