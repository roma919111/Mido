import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useState } from "react";
import type { PlatformId } from "../types";
import {
  isPlatformAppInstalled,
  launchNativePlatformApp,
  openPlatformPlayStore,
} from "../lib/platform-launch-native";
import { openPlatformViaBrowser } from "../lib/platform-smart-launch";
import { PLATFORMS } from "../lib/platforms";

const PLATFORM_ORDER: PlatformId[] = ["netflix", "shahid", "tod"];

export function PlatformSubscriptionPanel() {
  const [installed, setInstalled] = useState<Record<PlatformId, boolean>>({
    netflix: false,
    shahid: false,
    tod: false,
  });

  const refresh = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    const next: Record<PlatformId, boolean> = { netflix: false, shahid: false, tod: false };
    for (const id of PLATFORM_ORDER) {
      next[id] = await isPlatformAppInstalled(id);
    }
    setInstalled(next);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 3000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void refresh();
    });
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!Capacitor.isNativePlatform()) {
    return (
      <section className="platform-subscription-panel">
        <h3 className="platform-subscription-panel__title">اشتراك المنصات</h3>
        <p className="platform-subscription-panel__hint">
          على المتصفح: سجّل دخولك في netflix.com / shahid.mbc.net عند أول تشغيل — لا حاجة
          لـ Play Store.
        </p>
      </section>
    );
  }

  return (
    <section className="platform-subscription-panel">
      <h3 className="platform-subscription-panel__title">اشتراك المنصات — Google Play</h3>
      <p className="platform-subscription-panel__hint">
        ثبّت التطبيق الرسمي عند الحاجة. بعد التثبيت سجّل دخولك مرة واحدة في التطبيق.
      </p>

      <div className="platform-subscription-panel__list">
        {PLATFORM_ORDER.map((platform) => {
          const meta = PLATFORMS[platform];
          const isInstalled = installed[platform];

          return (
            <article
              key={platform}
              className="platform-subscription-card"
              style={{ "--platform-color": meta.color } as React.CSSProperties}
            >
              <header>
                <strong>{meta.name}</strong>
                <span className={isInstalled ? "is-installed" : "is-missing"}>
                  {isInstalled ? "✓ مثبت" : "غير مثبت"}
                </span>
              </header>

              <div className="platform-subscription-card__actions">
                {!isInstalled ? (
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => void openPlatformPlayStore(platform)}>
                    📥 ثبّت من Play Store
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => void launchNativePlatformApp(platform, meta.homeUrl)}
                  >
                    ▶ افتح {meta.name}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void openPlatformViaBrowser(meta.homeUrl)}
                >
                  🌐 المتصفح
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
