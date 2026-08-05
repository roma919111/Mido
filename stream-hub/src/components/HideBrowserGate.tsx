import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import { OverlayPortal } from "./OverlayPortal";
import {
  isAndroidDevice,
  isBrowserTab,
  isChromeBrowser,
  isIosDevice,
  isStandaloneApp,
} from "../lib/display-mode";
import { enterKioskMode, isKioskEnabled, setKioskEnabled } from "../lib/kiosk-mode";
import { isFullscreen } from "../lib/fullscreen";

const GATE_KEY = "max.hideBrowserGateOk";

function isGateOk(): boolean {
  return sessionStorage.getItem(GATE_KEY) === "1" || isStandaloneApp() || Capacitor.isNativePlatform();
}

function markGateOk(): void {
  sessionStorage.setItem(GATE_KEY, "1");
}

type HideBrowserGateProps = {
  /** When true the gate covers the whole app until the user installs or hides chrome. */
  blocking?: boolean;
};

export function HideBrowserGate({ blocking = false }: HideBrowserGateProps) {
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [fullscreen, setFullscreen] = useState(isFullscreen);

  useEffect(() => {
    if (!isBrowserTab()) return;
    setOpen(!isGateOk());

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    const id = window.setInterval(() => {
      if (isStandaloneApp()) {
        markGateOk();
        setOpen(false);
      }
      setFullscreen(isFullscreen());
    }, 500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.clearInterval(id);
    };
  }, []);

  if (!open || !isBrowserTab()) return null;

  const ios = isIosDevice();
  const androidChrome = isAndroidDevice() && isChromeBrowser();

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      markGateOk();
      setOpen(false);
      return;
    }
    setShowHelp(true);
  }

  async function handleHideChrome() {
    setKioskEnabled(true);
    await enterKioskMode();
    setFullscreen(isFullscreen());
    if (isFullscreen() || isKioskEnabled()) {
      markGateOk();
      setOpen(false);
    }
  }

  function handleContinueSafari() {
    markGateOk();
    setOpen(false);
  }

  const installHelp = androidChrome
    ? "Chrome: ⋮ → «تثبيت التطبيق» / Add to Home screen"
    : ios
      ? "Safari: Share ⬆ → «Add to Home Screen»"
      : "من المتصفح: Install app / Add to Home screen";

  const panel = (
    <div className={`hide-browser-gate${blocking ? " hide-browser-gate--blocking" : ""}`} role="dialog" aria-modal="true">
      <div className="hide-browser-gate__card">
        <p className="hide-browser-gate__badge">بدون شريط متصفح</p>
        <h2>أخفِ الشريط العلوي</h2>
        <p className="hide-browser-gate__lead">
          {ios
            ? "Safari لا يسمح بإخفاء الشريط إلا بتثبيت MAX على الشاشة الرئيسية."
            : "ثبّت التطبيق أو فعّل ملء الشاشة — يختفي شريط Chrome."}
        </p>

        {showHelp ? <p className="hide-browser-gate__help">{installHelp}</p> : null}

        <div className="hide-browser-gate__actions">
          <button type="button" className="hide-browser-gate__primary" onClick={() => void handleInstall()}>
            {deferredPrompt ? "⬇ تثبيت MAX الآن" : "📲 تثبيت على الشاشة الرئيسية"}
          </button>

          {!ios ? (
            <button type="button" className="hide-browser-gate__secondary" onClick={() => void handleHideChrome()}>
              ⛶ إخفاء الشريط الآن
            </button>
          ) : null}

          {!blocking || ios ? (
            <button type="button" className="hide-browser-gate__ghost" onClick={handleContinueSafari}>
              متابعة في Safari (الشريط يظهر)
            </button>
          ) : null}
        </div>

        {ios ? (
          <p className="hide-browser-gate__note">
            💡 ثبّت تطبيق Netflix من App Store — MAX يفتحه ويبقى هنا بدون تبويب Netflix.
          </p>
        ) : null}

        {!ios && fullscreen ? (
          <p className="hide-browser-gate__ok">✅ وضع ملء الشاشة مفعّل</p>
        ) : null}
      </div>
    </div>
  );

  return blocking ? <OverlayPortal>{panel}</OverlayPortal> : panel;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
