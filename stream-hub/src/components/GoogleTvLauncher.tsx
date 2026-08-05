import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  isAndroidDevice,
  isBrowserTab,
  isChromeBrowser,
  isIosDevice,
  isStandaloneApp,
} from "../lib/display-mode";

/** Allow catalog in browser — install gate is optional. */
export function mustUseGoogleTvLauncher(): boolean {
  if (import.meta.env.DEV) return false;
  return isBrowserTab() && !Capacitor.isNativePlatform();
}

type GoogleTvLauncherProps = {
  children: ReactNode;
};

export function GoogleTvLauncher({ children }: GoogleTvLauncherProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(!mustUseGoogleTvLauncher());

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    const id = window.setInterval(() => {
      if (isStandaloneApp()) {
        setInstalled(true);
        document.documentElement.classList.add("gtv-launcher-active");
      }
    }, 400);

    if (isStandaloneApp()) {
      document.documentElement.classList.add("gtv-launcher-active");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.clearInterval(id);
    };
  }, []);

  if (installed) return <>{children}</>;

  const android = isAndroidDevice();
  const ios = isIosDevice();
  const androidChrome = android && isChromeBrowser();

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }
    setShowHelp(true);
  }

  const steps = androidChrome
    ? ["افتح MAX في Chrome", "⋮ → «تثبيت التطبيق»", "افتح MAX من الشاشة الرئيسية — مثل Google TV"]
    : ios
      ? ["Safari → Share ⬆", "«Add to Home Screen»", "افتح MAX من الأيقونة — بدون Safari"]
      : ["ثبّت التطبيق من المتصفح", "Add to Home Screen / Install app", "افتح من الشاشة الرئيسية"];

  return (
    <div className="gtv-launcher-screen">
      <div className="gtv-launcher-screen__glow" aria-hidden="true" />
      <div className="gtv-launcher-screen__content">
        <div className="gtv-launcher-screen__logo">
          <span className="gtv-launcher-screen__max">MAX</span>
          <span className="gtv-launcher-screen__sub">MEDIA PLAYER</span>
        </div>

        <p className="gtv-launcher-screen__badge">Google TV Experience</p>
        <h1>واجهة Google TV — بدون متصفح</h1>
        <p className="gtv-launcher-screen__lead">
          Google TV <strong>تطبيق</strong> على الشاشة — <strong>لا تعمل داخل Safari أو Chrome</strong>.
          ثبّت MAX كتطبيق لتحصل على نفس التجربة: شاشة كاملة، صفوف المحتوى، وتشغيل Netflix.
        </p>

        <ol className="gtv-launcher-screen__steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        {showHelp ? (
          <p className="gtv-launcher-screen__help">
            {android
              ? "على Android TV: ثبّت APK أو استخدم Chrome على الموبايل للتثبيت ثم Cast."
              : "بعد التثبيت ستظهر واجهة MAX بملء الشاشة بدون أي شريط متصفح."}
          </p>
        ) : null}

        <div className="gtv-launcher-screen__actions">
          <button type="button" className="gtv-launcher-screen__primary" onClick={() => void handleInstall()}>
            {deferredPrompt ? "⬇ تثبيت — مثل Google TV" : "📲 كيف أثبّت التطبيق؟"}
          </button>
          <button
            type="button"
            className="gtv-launcher-screen__ghost"
            onClick={() => {
              document.documentElement.classList.add("gtv-launcher-active");
              setInstalled(true);
            }}
          >
            ▶ متابعة في المتصفح — تصفّح الأفلام
          </button>
        </div>

        <p className="gtv-launcher-screen__note">
          📺 Android TV / Google TV Box: استخدم تطبيق MAX المثبّت (APK) — واجهة TV كاملة بدون متصفح.
        </p>
      </div>
    </div>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
