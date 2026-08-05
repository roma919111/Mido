import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { closeAdminSession, isAdminSessionOpen, isDeviceDelivered } from "../lib/admin-mode";
import { getCustomerLabel } from "../lib/admin-mode";
import { enterAppShellMode, exitAppShellMode } from "../lib/app-shell";
import { enterKioskMode, isKioskEnabled } from "../lib/kiosk-mode";
import { isCustomerMode, setPreferredPlatform } from "../lib/customer-mode";
import { openPlatformNow } from "../lib/platform-open";
import { useTvRemote } from "../hooks/useTvRemote";
import { AdminPage } from "./AdminPage";
import { AdminUnlockModal } from "./AdminUnlockModal";
import { PlatformLauncher } from "./PlatformLauncher";
import type { PlatformId } from "../types";

type HomePageProps = {
  onLogout?: () => void;
  forceAdmin?: boolean;
  onAdminClosed?: () => void;
};

export function HomePage({ onLogout, forceAdmin = false, onAdminClosed }: HomePageProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(forceAdmin || isAdminSessionOpen());
  const [showUnlock, setShowUnlock] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const customer = isCustomerMode();
  const delivered = isDeviceDelivered();
  const customerLabel = getCustomerLabel();

  useTvRemote(mainRef);

  useEffect(() => {
    enterAppShellMode();
    return () => exitAppShellMode();
  }, []);

  useEffect(() => {
    if (isKioskEnabled()) void enterKioskMode();
  }, []);

  useEffect(() => {
    if (logoTaps < 5) return;
    setLogoTaps(0);
    setShowUnlock(true);
  }, [logoTaps]);

  function onLogoTap() {
    if (!delivered) return;
    setLogoTaps((n) => n + 1);
  }

  async function handlePlatformOpen(platform: PlatformId) {
    setPreferredPlatform(platform);
    setToast(`جاري فتح ${platform}…`);
    await openPlatformNow(platform);
    setToast(null);
  }

  if (showAdmin) {
    return (
      <div className="gtv-shell">
        <main ref={mainRef} tabIndex={-1} className="gtv-main gtv-main--padded">
          <AdminPage
            onDelivered={() => {
              setShowAdmin(false);
              onAdminClosed?.();
            }}
            onClose={
              delivered
                ? () => {
                    closeAdminSession();
                    setShowAdmin(false);
                    onAdminClosed?.();
                  }
                : undefined
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="gtv-shell">
      <header className={`gtv-header ${customer ? "gtv-header--minimal" : "gtv-header--simple"}`}>
        <button type="button" className="gtv-header__brand-btn" onClick={onLogoTap}>
          <span className="gtv-header__max">MAX</span>
          {!customer ? <span className="gtv-header__version"> v{__APP_VERSION__}</span> : null}
        </button>
        {customerLabel ? <span className="gtv-header__customer">{customerLabel}</span> : null}
        {!customer && onLogout ? (
          <button type="button" className="gtv-header__logout" onClick={onLogout}>
            خروج
          </button>
        ) : null}
        {delivered && Capacitor.isNativePlatform() ? (
          <button type="button" className="gtv-header__admin-hint" onClick={() => setShowUnlock(true)}>
            ⚙
          </button>
        ) : null}
      </header>

      {toast ? <p className="gtv-toast">{toast}</p> : null}

      <main ref={mainRef} tabIndex={-1} className="gtv-main gtv-main--center">
        <PlatformLauncher onOpen={(platform) => void handlePlatformOpen(platform)} />
        {customer ? (
          <p className="customer-footnote">زر Home للخروج · MAX للتبديل بين المنصات</p>
        ) : null}
      </main>

      {showUnlock ? (
        <AdminUnlockModal
          onUnlocked={() => {
            setShowUnlock(false);
            setShowAdmin(true);
          }}
          onCancel={() => setShowUnlock(false)}
        />
      ) : null}
    </div>
  );
}
