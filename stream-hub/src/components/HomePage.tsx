import { useEffect, useRef, useState } from "react";
import { enterAppShellMode, exitAppShellMode } from "../lib/app-shell";
import { enterKioskMode, isKioskEnabled } from "../lib/kiosk-mode";
import { isCustomerMode, setPreferredPlatform } from "../lib/customer-mode";
import { openPlatformNow } from "../lib/platform-open";
import { useTvRemote } from "../hooks/useTvRemote";
import { PlatformLauncher } from "./PlatformLauncher";
import type { PlatformId } from "../types";

type HomePageProps = {
  onLogout?: () => void;
};

export function HomePage({ onLogout }: HomePageProps) {
  const [toast, setToast] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const customer = isCustomerMode();

  useTvRemote(mainRef);

  useEffect(() => {
    enterAppShellMode();
    return () => exitAppShellMode();
  }, []);

  useEffect(() => {
    if (isKioskEnabled()) void enterKioskMode();
  }, []);

  async function handlePlatformOpen(platform: PlatformId) {
    setPreferredPlatform(platform);
    setToast(`جاري فتح ${platform}…`);
    await openPlatformNow(platform);
    setToast(null);
  }

  return (
    <div className="gtv-shell">
      {!customer ? (
        <header className="gtv-header gtv-header--simple">
          <div className="gtv-header__brand">
            <span className="gtv-header__max">MAX</span> MEDIA PLAYER
            <span className="gtv-header__version">v{__APP_VERSION__}</span>
          </div>
          {onLogout ? (
            <button type="button" className="gtv-header__logout" onClick={onLogout}>
              خروج
            </button>
          ) : null}
        </header>
      ) : (
        <header className="gtv-header gtv-header--minimal">
          <span className="gtv-header__max">MAX</span>
        </header>
      )}

      {toast ? <p className="gtv-toast">{toast}</p> : null}

      <main ref={mainRef} tabIndex={-1} className="gtv-main gtv-main--center">
        <PlatformLauncher
          onOpen={(platform) => void handlePlatformOpen(platform)}
        />
        {customer ? (
          <p className="customer-footnote">
            للتبديل بين المنصات: افتح MAX من قائمة التطبيقات · زر Home للخروج
          </p>
        ) : null}
      </main>
    </div>
  );
}
